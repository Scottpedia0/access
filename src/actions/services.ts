"use server";

import {
  AuditAction,
  ResourceType,
  RiskLevel,
  ServiceStatus,
  VisibilityMode,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { encryptSecretValue } from "@/lib/security/encryption";
import { getAuditActorFromSession, requireSession } from "@/lib/session";
import { makeSlug, normalizeEnvVarName, parseTagInput } from "@/lib/utils";

const serviceSchema = z.object({
  serviceId: z.string().uuid().optional(),
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  riskLevel: z.nativeEnum(RiskLevel),
  notesSummary: z.string().optional().default(""),
  status: z.nativeEnum(ServiceStatus),
  visibilityMode: z.nativeEnum(VisibilityMode),
});

const quickSecretSchema = z.object({
  label: z.string().optional().default(""),
  envVarName: z.string().optional().default(""),
  value: z.string().optional().default(""),
});

const quickCaptureSchema = z.object({
  name: z.string().min(2),
  notes: z.string().optional().default(""),
  resourceLines: z.string().optional().default(""),
  secretsJson: z.string(),
});

export async function getAvailableServiceSlug(raw: string, currentId?: string) {
  const base = makeSlug(raw) || "service";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.service.findFirst({
      where: {
        slug: candidate,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix++}`;
  }

  return candidate;
}

function deriveKeyLabel(rawLabel: string, index: number, total: number) {
  const trimmed = rawLabel.trim();

  if (trimmed) {
    return trimmed;
  }

  if (total === 1) {
    return "Primary key";
  }

  return `Key ${index + 1}`;
}

function deriveEnvVarName(serviceName: string, rawEnvVarName: string, label: string) {
  const trimmed = rawEnvVarName.trim();

  if (trimmed) {
    return normalizeEnvVarName(trimmed);
  }

  const serviceSlug = makeSlug(serviceName).replaceAll("-", "_").toUpperCase();
  const labelPart = normalizeEnvVarName(label || "API_KEY");
  return normalizeEnvVarName(`${serviceSlug}_${labelPart}`);
}

function inferResourceType(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return ResourceType.URL;
  }

  if (value.startsWith("/") || value.startsWith("~/")) {
    return ResourceType.LOCAL_PATH;
  }

  if (value.includes("/")) {
    return ResourceType.REPO_PATH;
  }

  return ResourceType.INTERNAL_NOTE;
}

export async function upsertServiceAction(formData: FormData) {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);

  const parsed = serviceSchema.parse({
    serviceId: formData.get("serviceId") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") || "",
    category: formData.get("category") || "",
    tags: formData.get("tags") || "",
    riskLevel: formData.get("riskLevel"),
    notesSummary: formData.get("notesSummary") || "",
    status: formData.get("status"),
    visibilityMode: formData.get("visibilityMode"),
  });

  const slug = await getAvailableServiceSlug(parsed.slug || parsed.name, parsed.serviceId);
  const data = {
    name: parsed.name.trim(),
    slug,
    description: parsed.description.trim(),
    category: parsed.category.trim(),
    tags: parseTagInput(parsed.tags),
    riskLevel: parsed.riskLevel,
    notesSummary: parsed.notesSummary.trim(),
    status: parsed.status,
    visibilityMode: parsed.visibilityMode,
  };

  const service = parsed.serviceId
    ? await prisma.service.update({
        where: { id: parsed.serviceId },
        data,
      })
    : await prisma.service.create({
        data,
      });

  await createAuditEvent({
    actor,
    action: parsed.serviceId ? AuditAction.SERVICE_UPDATED : AuditAction.SERVICE_CREATED,
    serviceId: service.id,
    metadataJson: {
      name: service.name,
      slug: service.slug,
      visibilityMode: service.visibilityMode,
      riskLevel: service.riskLevel,
    },
  });

  revalidatePath("/services");
  revalidatePath(`/services/${service.slug}`);
  redirect(`/services/${service.slug}`);
}

export async function quickCaptureServiceAction(formData: FormData) {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);

  const parsed = quickCaptureSchema.parse({
    name: formData.get("name"),
    notes: formData.get("notes") || "",
    resourceLines: formData.get("resourceLines") || "",
    secretsJson: formData.get("secretsJson"),
  });

  const rawSecrets = z.array(quickSecretSchema).parse(JSON.parse(parsed.secretsJson));
  const enteredSecrets = rawSecrets.filter((secret) => secret.value.trim());

  if (enteredSecrets.length === 0) {
    throw new Error("Add at least one key before saving.");
  }

  const normalizedSecrets = enteredSecrets.map((secret, index, all) => {
    const label = deriveKeyLabel(secret.label, index, all.length);
    const envVarName = deriveEnvVarName(parsed.name, secret.envVarName, label);

    return {
      label,
      envVarName,
      encryptedValue: encryptSecretValue(secret.value.trim()),
    };
  });

  const envVarNames = normalizedSecrets.map((secret) => secret.envVarName);
  const duplicateEnvVarName = envVarNames.find(
    (envVarName, index) => envVarNames.indexOf(envVarName) !== index,
  );

  if (duplicateEnvVarName) {
    throw new Error(`Duplicate env var name in this service: ${duplicateEnvVarName}`);
  }

  const existingEnvVar = await prisma.secret.findFirst({
    where: {
      envVarName: {
        in: envVarNames,
      },
    },
    select: {
      envVarName: true,
      service: {
        select: {
          name: true,
        },
      },
    },
  });

  if (existingEnvVar) {
    throw new Error(
      `${existingEnvVar.envVarName} already exists on ${existingEnvVar.service.name}.`,
    );
  }

  const notes = parsed.notes.trim();
  const slug = await getAvailableServiceSlug(parsed.name);
  const resourceLines = parsed.resourceLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const service = await prisma.$transaction(async (tx) => {
    const createdService = await tx.service.create({
      data: {
        name: parsed.name.trim(),
        slug,
        description: "",
        category: "",
        tags: [],
        riskLevel: RiskLevel.MEDIUM,
        notesSummary: notes.slice(0, 220),
        status: ServiceStatus.ACTIVE,
        visibilityMode: VisibilityMode.OWNER_ONLY,
      },
    });

    for (const secret of normalizedSecrets) {
      await tx.secret.create({
        data: {
          serviceId: createdService.id,
          label: secret.label,
          envVarName: secret.envVarName,
          encryptedValue: secret.encryptedValue,
          description: "",
          category: "api_key",
          visibilityMode: VisibilityMode.OWNER_ONLY,
          active: true,
          deprecated: false,
          notes: "",
        },
      });
    }

    if (notes) {
      await tx.serviceDoc.create({
        data: {
          serviceId: createdService.id,
          title: "Notes",
          markdownBody: notes,
        },
      });
    }

    for (const line of resourceLines) {
      await tx.linkedResource.create({
        data: {
          serviceId: createdService.id,
          label: line,
          resourceType: inferResourceType(line),
          pathOrUrl: line,
          notes: "",
        },
      });
    }

    return createdService;
  });

  await createAuditEvent({
    actor,
    action: AuditAction.SERVICE_CREATED,
    serviceId: service.id,
    metadataJson: {
      name: service.name,
      slug: service.slug,
      quickCapture: true,
      keyCount: normalizedSecrets.length,
    },
  });

  for (const secret of normalizedSecrets) {
    const createdSecret = await prisma.secret.findUnique({
      where: {
        envVarName: secret.envVarName,
      },
      select: {
        id: true,
      },
    });

    if (createdSecret) {
      await createAuditEvent({
        actor,
        action: AuditAction.SECRET_CREATED,
        serviceId: service.id,
        secretId: createdSecret.id,
        metadataJson: {
          label: secret.label,
          envVarName: secret.envVarName,
          quickCapture: true,
        },
      });
    }
  }

  revalidatePath("/services");
  revalidatePath(`/services/${service.slug}`);
  redirect(`/services/${service.slug}`);
}
