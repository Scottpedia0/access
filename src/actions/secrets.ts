"use server";

import { AuditAction, VisibilityMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { decryptSecretValue, encryptSecretValue } from "@/lib/security/encryption";
import { getAuditActorFromSession, requireSession } from "@/lib/session";
import { normalizeEnvVarName } from "@/lib/utils";

const secretSchema = z.object({
  secretId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  label: z.string().min(2),
  envVarName: z.string().min(2),
  secretValue: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  visibilityMode: z.nativeEnum(VisibilityMode),
  notes: z.string().optional().default(""),
});

export async function upsertSecretAction(formData: FormData) {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);

  const parsed = secretSchema.parse({
    secretId: formData.get("secretId") || undefined,
    serviceId: formData.get("serviceId"),
    label: formData.get("label"),
    envVarName: formData.get("envVarName"),
    secretValue: formData.get("secretValue") || "",
    description: formData.get("description") || "",
    category: formData.get("category") || "",
    visibilityMode: formData.get("visibilityMode"),
    notes: formData.get("notes") || "",
  });

  const existing = parsed.secretId
    ? await prisma.secret.findUnique({
        where: { id: parsed.secretId },
        include: { service: { select: { slug: true } } },
      })
    : null;

  if (parsed.secretId && !existing) {
    throw new Error("Secret not found.");
  }

  if (!parsed.secretId && !parsed.secretValue.trim()) {
    throw new Error("A secret value is required when creating a new secret.");
  }

  const encryptedValue =
    parsed.secretValue.trim().length > 0
      ? encryptSecretValue(parsed.secretValue.trim())
      : existing!.encryptedValue;

  const secret = parsed.secretId
    ? await prisma.secret.update({
        where: { id: parsed.secretId },
        data: {
          label: parsed.label.trim(),
          envVarName: normalizeEnvVarName(parsed.envVarName),
          encryptedValue,
          description: parsed.description.trim(),
          category: parsed.category.trim(),
          visibilityMode: parsed.visibilityMode,
          notes: parsed.notes.trim(),
          active: formData.get("active") === "on",
          deprecated: formData.get("deprecated") === "on",
          ...(parsed.secretValue.trim()
            ? {
                lastRotatedAt: formData.get("rotateNow") === "on" ? new Date() : new Date(),
              }
            : {}),
        },
        include: { service: { select: { slug: true } } },
      })
    : await prisma.secret.create({
        data: {
          serviceId: parsed.serviceId,
          label: parsed.label.trim(),
          envVarName: normalizeEnvVarName(parsed.envVarName),
          encryptedValue,
          description: parsed.description.trim(),
          category: parsed.category.trim(),
          visibilityMode: parsed.visibilityMode,
          notes: parsed.notes.trim(),
          active: formData.get("active") === "on",
          deprecated: formData.get("deprecated") === "on",
        },
        include: { service: { select: { slug: true } } },
      });

  await createAuditEvent({
    actor,
    action: parsed.secretId ? AuditAction.SECRET_UPDATED : AuditAction.SECRET_CREATED,
    serviceId: secret.serviceId,
    secretId: secret.id,
    metadataJson: {
      label: secret.label,
      envVarName: secret.envVarName,
      visibilityMode: secret.visibilityMode,
      active: secret.active,
      deprecated: secret.deprecated,
    },
  });

  revalidatePath(`/services/${secret.service.slug}`);
  redirect(`/services/${secret.service.slug}`);
}

export type RevealSecretState = {
  error?: string;
  value?: string;
  envLine?: string;
};

export async function revealSecretAction(
  _previousState: RevealSecretState,
  formData: FormData,
): Promise<RevealSecretState> {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);
  const secretId = z.string().uuid().parse(formData.get("secretId"));

  const secret = await prisma.secret.findUnique({
    where: { id: secretId },
    include: {
      service: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!secret) {
    return { error: "Secret not found." };
  }

  const value = decryptSecretValue(secret.encryptedValue);

  await prisma.secret.update({
    where: { id: secret.id },
    data: {
      lastRevealedAt: new Date(),
    },
  });

  await createAuditEvent({
    actor,
    action: AuditAction.SECRET_REVEALED,
    serviceId: secret.serviceId,
    secretId: secret.id,
    metadataJson: {
      envVarName: secret.envVarName,
    },
  });

  revalidatePath(`/services/${secret.service.slug}`);

  return {
    value,
    envLine: `${secret.envVarName}=${value}`,
  };
}
