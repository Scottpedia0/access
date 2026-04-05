"use server";

import { AuditAction, ResourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getAuditActorFromSession, requireSession } from "@/lib/session";

const resourceSchema = z.object({
  resourceId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  label: z.string().min(2),
  resourceType: z.nativeEnum(ResourceType),
  pathOrUrl: z.string().min(2),
  notes: z.string().optional().default(""),
});

export async function upsertResourceAction(formData: FormData) {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);

  const parsed = resourceSchema.parse({
    resourceId: formData.get("resourceId") || undefined,
    serviceId: formData.get("serviceId"),
    label: formData.get("label"),
    resourceType: formData.get("resourceType"),
    pathOrUrl: formData.get("pathOrUrl"),
    notes: formData.get("notes") || "",
  });

  const resource = parsed.resourceId
    ? await prisma.linkedResource.update({
        where: { id: parsed.resourceId },
        data: {
          label: parsed.label.trim(),
          resourceType: parsed.resourceType,
          pathOrUrl: parsed.pathOrUrl.trim(),
          notes: parsed.notes.trim(),
        },
        include: { service: { select: { slug: true } } },
      })
    : await prisma.linkedResource.create({
        data: {
          serviceId: parsed.serviceId,
          label: parsed.label.trim(),
          resourceType: parsed.resourceType,
          pathOrUrl: parsed.pathOrUrl.trim(),
          notes: parsed.notes.trim(),
        },
        include: { service: { select: { slug: true } } },
      });

  await createAuditEvent({
    actor,
    action: parsed.resourceId
      ? AuditAction.RESOURCE_UPDATED
      : AuditAction.RESOURCE_CREATED,
    serviceId: resource.serviceId,
    metadataJson: {
      label: resource.label,
      resourceType: resource.resourceType,
      pathOrUrl: resource.pathOrUrl,
    },
  });

  revalidatePath(`/services/${resource.service.slug}`);
  redirect(`/services/${resource.service.slug}`);
}
