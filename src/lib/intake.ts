import { ActorType, AuditAction, RiskLevel, ServiceStatus, VisibilityMode } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditEvent } from "@/lib/audit";
import { isValidSharedIntakeToken } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decryptSecretValue, encryptSecretValue } from "@/lib/security/encryption";
import { makeSlug, normalizeEnvVarName } from "@/lib/utils";

export type SharedIntakeResult = {
  status: "created" | "updated" | "duplicate";
  success: string;
  serviceName: string;
  envVarName: string;
};

export type SharedIntakeInput = {
  intakeToken: string;
  serviceName: string;
  secretValue: string;
  envVarName?: string;
  label?: string;
  description?: string;
  notes?: string;
  actorId: string;
  actorLabel: string;
  source: "link" | "api";
};

function getNextSecretLabel(existingCount: number) {
  return existingCount === 0 ? "API key" : `API key ${existingCount + 1}`;
}

async function getAvailableEnvVarName(baseName: string) {
  const normalizedBase = normalizeEnvVarName(baseName);
  let candidate = normalizedBase;
  let suffix = 2;

  while (
    await prisma.secret.findUnique({
      where: {
        envVarName: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${normalizedBase}_${suffix++}`;
  }

  return candidate;
}

async function getAvailableServiceSlug(raw: string) {
  const base = makeSlug(raw) || "service";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.service.findFirst({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${base}-${suffix++}`;
  }

  return candidate;
}

export async function submitSharedIntake(input: SharedIntakeInput): Promise<SharedIntakeResult> {
  if (!isValidSharedIntakeToken(input.intakeToken)) {
    throw new Error("This request is missing a valid intake token.");
  }

  const serviceName = input.serviceName.trim();
  const submittedSecretValue = input.secretValue.trim();
  const providedEnvVarName = input.envVarName?.trim()
    ? normalizeEnvVarName(input.envVarName)
    : null;
  const providedLabel = input.label?.trim() || null;
  const description = input.description?.trim() || "";
  const notes = input.notes?.trim() || "";

  if (!serviceName || serviceName.length < 2) {
    throw new Error("Service name is too short.");
  }

  if (!submittedSecretValue) {
    throw new Error("Paste the key first.");
  }

  const intakeActor = {
    actorType: ActorType.SYSTEM,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
  } as const;

  const matchedService = await prisma.service.findFirst({
    where: {
      OR: [
        {
          slug: makeSlug(serviceName),
        },
        {
          name: {
            equals: serviceName,
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      secrets: true,
    },
  });

  const duplicateSecret = matchedService?.secrets.find((secret) => {
    try {
      return decryptSecretValue(secret.encryptedValue) === submittedSecretValue;
    } catch {
      return false;
    }
  });

  if (matchedService && duplicateSecret) {
    return {
      status: "duplicate",
      success: "Already saved. Ready to use.",
      serviceName: matchedService.name,
      envVarName: duplicateSecret.envVarName,
    };
  }

  const serviceSlug = matchedService ? matchedService.slug : await getAvailableServiceSlug(serviceName);
  const existingSecret =
    providedEnvVarName && matchedService
      ? matchedService.secrets.find((secret) => secret.envVarName === providedEnvVarName) ?? null
      : null;

  if (providedEnvVarName && !existingSecret) {
    const conflictingSecret = await prisma.secret.findUnique({
      where: {
        envVarName: providedEnvVarName,
      },
      include: {
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (conflictingSecret) {
      throw new Error(`${providedEnvVarName} already exists on ${conflictingSecret.service.name}.`);
    }
  }

  const label = providedLabel ?? existingSecret?.label ?? getNextSecretLabel(matchedService?.secrets.length ?? 0);
  const envVarName =
    existingSecret?.envVarName ??
    providedEnvVarName ??
    (await getAvailableEnvVarName(
      `${makeSlug(serviceName).replaceAll("-", "_").toUpperCase()}_API_KEY`,
    ));

  const result = await prisma.$transaction(async (tx) => {
    const service =
      matchedService ??
      (await tx.service.create({
        data: {
          name: serviceName,
          slug: serviceSlug,
          description: "",
          category: "",
          tags: [],
          riskLevel: RiskLevel.MEDIUM,
          notesSummary: "Submitted through the shared intake flow.",
          status: ServiceStatus.ACTIVE,
          visibilityMode: VisibilityMode.OWNER_ONLY,
        },
      }));

    if (existingSecret) {
      const secret = await tx.secret.update({
        where: { id: existingSecret.id },
        data: {
          label,
          encryptedValue: encryptSecretValue(submittedSecretValue),
          description,
          notes,
          deprecated: false,
          active: true,
          lastRotatedAt: new Date(),
        },
      });

      return {
        service,
        secret,
        createdService: !matchedService,
        action: "updated" as const,
      };
    }

    const secret = await tx.secret.create({
      data: {
        serviceId: service.id,
        label,
        envVarName,
        encryptedValue: encryptSecretValue(submittedSecretValue),
        description,
        category: "api_key",
        visibilityMode: VisibilityMode.OWNER_ONLY,
        active: true,
        deprecated: false,
        notes,
      },
    });

    return {
      service,
      secret,
      createdService: !matchedService,
      action: "created" as const,
    };
  });

  if (result.createdService) {
    await createAuditEvent({
      actor: intakeActor,
      action: AuditAction.SERVICE_CREATED,
      serviceId: result.service.id,
      metadataJson: {
        name: result.service.name,
        slug: result.service.slug,
        sharedIntake: true,
        source: input.source,
      },
    });
  }

  await createAuditEvent({
    actor: intakeActor,
    action: result.action === "updated" ? AuditAction.SECRET_UPDATED : AuditAction.SECRET_CREATED,
    serviceId: result.service.id,
    secretId: result.secret.id,
    metadataJson: {
      label: result.secret.label,
      envVarName: result.secret.envVarName,
      sharedIntake: true,
      source: input.source,
      updatedExisting: result.action === "updated",
    },
  });

  revalidatePath("/services");
  revalidatePath(`/services/${result.service.slug}`);
  revalidatePath("/settings");

  return {
    status: result.action,
    success:
      result.action === "updated"
        ? "Updated. Ready to use."
        : "Saved. Available now.",
    serviceName: result.service.name,
    envVarName: result.secret.envVarName,
  };
}
