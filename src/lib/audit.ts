import { ActorType, AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AuditActor = {
  actorType: ActorType;
  actorId: string;
  actorLabel?: string | null;
};

export async function createAuditEvent(input: {
  actor: AuditActor;
  action: AuditAction;
  serviceId?: string | null;
  secretId?: string | null;
  consumerId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
}) {
  return prisma.auditEvent.create({
    data: {
      actorType: input.actor.actorType,
      actorId: input.actor.actorId,
      actorLabel: input.actor.actorLabel ?? null,
      action: input.action,
      serviceId: input.serviceId ?? null,
      secretId: input.secretId ?? null,
      consumerId: input.consumerId ?? null,
      metadataJson: input.metadataJson,
    },
  });
}
