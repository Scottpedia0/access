"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getAuditActorFromSession, requireSession } from "@/lib/session";

const docSchema = z.object({
  docId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  title: z.string().min(2),
  markdownBody: z.string().optional().default(""),
});

export async function upsertDocAction(formData: FormData) {
  const session = await requireSession();
  const actor = getAuditActorFromSession(session);

  const parsed = docSchema.parse({
    docId: formData.get("docId") || undefined,
    serviceId: formData.get("serviceId"),
    title: formData.get("title"),
    markdownBody: formData.get("markdownBody") || "",
  });

  const doc = parsed.docId
    ? await prisma.serviceDoc.update({
        where: { id: parsed.docId },
        data: {
          title: parsed.title.trim(),
          markdownBody: parsed.markdownBody.trim(),
        },
        include: { service: { select: { slug: true } } },
      })
    : await prisma.serviceDoc.create({
        data: {
          serviceId: parsed.serviceId,
          title: parsed.title.trim(),
          markdownBody: parsed.markdownBody.trim(),
        },
        include: { service: { select: { slug: true } } },
      });

  await createAuditEvent({
    actor,
    action: parsed.docId ? AuditAction.DOC_UPDATED : AuditAction.DOC_CREATED,
    serviceId: doc.serviceId,
    metadataJson: {
      title: doc.title,
    },
  });

  revalidatePath(`/services/${doc.service.slug}`);
  redirect(`/services/${doc.service.slug}`);
}
