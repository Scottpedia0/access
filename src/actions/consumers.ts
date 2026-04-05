"use server";

import {
  AuditAction,
  ConsumerKind,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hashConsumerToken, issueConsumerToken } from "@/lib/security/tokens";
import { getAuditActorFromSession, requireSession } from "@/lib/session";
import { makeSlug } from "@/lib/utils";

const consumerSchema = z.object({
  consumerId: z.string().uuid().optional(),
  name: z.string().min(2),
  slug: z.string().optional(),
  kind: z.nativeEnum(ConsumerKind),
  notes: z.string().optional().default(""),
});

export type ConsumerFormState = {
  error?: string;
  redirectTo?: string;
  issuedToken?: string;
  tokenPrefix?: string;
};

export type RotateConsumerTokenState = {
  error?: string;
  issuedToken?: string;
  tokenPrefix?: string;
};

async function getAvailableConsumerSlug(raw: string, currentId?: string) {
  const base = makeSlug(raw) || "consumer";
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.consumer.findFirst({
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

function parseGrantIds(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}

function getGrantRows(consumerId: string, serviceIds: string[], secretIds: string[]) {
  const serviceGrantRows: Prisma.AccessGrantCreateManyInput[] = serviceIds.map((serviceId) => ({
    consumerId,
    serviceId,
    canReadMetadata: true,
    canReadDocs: true,
    canReadSecrets: true,
    active: true,
  }));

  const secretGrantRows: Prisma.AccessGrantCreateManyInput[] = secretIds.map((secretId) => ({
    consumerId,
    secretId,
    canReadMetadata: false,
    canReadDocs: false,
    canReadSecrets: true,
    active: true,
  }));

  return [...serviceGrantRows, ...secretGrantRows];
}

export async function saveConsumerAction(
  _previousState: ConsumerFormState,
  formData: FormData,
): Promise<ConsumerFormState> {
  try {
    const session = await requireSession();
    const actor = getAuditActorFromSession(session);
    const parsed = consumerSchema.parse({
      consumerId: formData.get("consumerId") || undefined,
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
      kind: formData.get("kind"),
      notes: formData.get("notes") || "",
    });

    const serviceGrantIds = parseGrantIds(formData, "serviceGrantIds");
    const secretGrantIds = parseGrantIds(formData, "secretGrantIds");
    const slug = await getAvailableConsumerSlug(parsed.slug || parsed.name, parsed.consumerId);
    const isTrusted = formData.get("isTrusted") === "on";
    const isActive = formData.get("active") === "on";

    let redirectTo = "";
    let issuedToken: string | undefined;
    let tokenPrefix: string | undefined;

    await prisma.$transaction(async (tx) => {
      const tokenData = parsed.consumerId ? null : issueConsumerToken();

      const consumer = parsed.consumerId
        ? await tx.consumer.update({
            where: { id: parsed.consumerId },
            data: {
              name: parsed.name.trim(),
              slug,
              kind: parsed.kind,
              isTrusted,
              active: isActive,
              notes: parsed.notes.trim(),
            },
          })
        : await tx.consumer.create({
            data: {
              name: parsed.name.trim(),
              slug,
              kind: parsed.kind,
              isTrusted,
              active: isActive,
              notes: parsed.notes.trim(),
              tokenPrefix: tokenData!.tokenPrefix,
              tokenHash: hashConsumerToken(tokenData!.token),
              lastIssuedAt: new Date(),
            },
          });

      await tx.accessGrant.deleteMany({
        where: {
          consumerId: consumer.id,
        },
      });

      const grantRows = getGrantRows(consumer.id, serviceGrantIds, secretGrantIds);

      if (grantRows.length > 0) {
        await tx.accessGrant.createMany({
          data: grantRows,
        });
      }

      await tx.auditEvent.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          actorLabel: actor.actorLabel,
          consumerId: consumer.id,
          action: parsed.consumerId
            ? AuditAction.CONSUMER_UPDATED
            : AuditAction.CONSUMER_CREATED,
          metadataJson: {
            name: consumer.name,
            kind: consumer.kind,
            isTrusted: consumer.isTrusted,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          actorLabel: actor.actorLabel,
          consumerId: consumer.id,
          action: AuditAction.ACCESS_GRANTS_UPDATED,
          metadataJson: {
            serviceGrantIds,
            secretGrantIds,
          },
        },
      });

      redirectTo = `/consumers/${consumer.id}`;
      issuedToken = tokenData?.token;
      tokenPrefix = tokenData?.tokenPrefix;
    });

    revalidatePath("/consumers");
    if (redirectTo) {
      revalidatePath(redirectTo);
    }

    return {
      redirectTo,
      issuedToken,
      tokenPrefix,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save consumer.",
    };
  }
}

export async function rotateConsumerTokenAction(
  _previousState: RotateConsumerTokenState,
  formData: FormData,
): Promise<RotateConsumerTokenState> {
  try {
    const session = await requireSession();
    const actor = getAuditActorFromSession(session);
    const consumerId = z.string().uuid().parse(formData.get("consumerId"));
    const tokenData = issueConsumerToken();

    await prisma.consumer.update({
      where: { id: consumerId },
      data: {
        tokenPrefix: tokenData.tokenPrefix,
        tokenHash: hashConsumerToken(tokenData.token),
        lastIssuedAt: new Date(),
      },
    });

    await createAuditEvent({
      actor,
      action: AuditAction.CONSUMER_TOKEN_ROTATED,
      consumerId,
      metadataJson: {
        tokenPrefix: tokenData.tokenPrefix,
      },
    });

    revalidatePath(`/consumers/${consumerId}`);

    return {
      issuedToken: tokenData.token,
      tokenPrefix: tokenData.tokenPrefix,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not rotate token.",
    };
  }
}
