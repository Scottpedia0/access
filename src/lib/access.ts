import { type AccessGrant, type Consumer, type Secret, type Service, VisibilityMode } from "@prisma/client";
import type { NextRequest } from "next/server";

import { getCurrentSession, getAuditActorFromSession } from "@/lib/session";
import { isValidGlobalAgentToken } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { extractTokenPrefix, verifyConsumerToken } from "@/lib/security/tokens";

type ConsumerWithGrants = Consumer & {
  accessGrants: AccessGrant[];
};

export type RequestActor =
  | {
      kind: "global";
      auditActor: {
        actorType: "SYSTEM";
        actorId: string;
        actorLabel: string;
      };
    }
  | {
      kind: "user";
      auditActor: ReturnType<typeof getAuditActorFromSession>;
    }
  | {
      kind: "consumer";
      auditActor: {
        actorType: "CONSUMER";
        actorId: string;
        actorLabel: string;
      };
      consumer: ConsumerWithGrants;
    };

async function findConsumerByBearerToken(token: string) {
  const tokenPrefix = extractTokenPrefix(token);

  if (!tokenPrefix) {
    return null;
  }

  const consumer = await prisma.consumer.findUnique({
    where: {
      tokenPrefix,
    },
    include: {
      accessGrants: true,
    },
  });

  if (!consumer?.active || !consumer.tokenHash) {
    return null;
  }

  return verifyConsumerToken(token, consumer.tokenHash) ? consumer : null;
}

export async function authenticateRequestActor(request: NextRequest): Promise<RequestActor | null> {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.replace("Bearer ", "").trim();

    if (isValidGlobalAgentToken(token)) {
      return {
        kind: "global",
        auditActor: {
          actorType: "SYSTEM",
          actorId: "global-agent-token",
          actorLabel: "Global agent token",
        },
      };
    }

    const consumer = await findConsumerByBearerToken(token);

    if (!consumer) {
      return null;
    }

    return {
      kind: "consumer",
      auditActor: {
        actorType: "CONSUMER",
        actorId: consumer.id,
        actorLabel: consumer.name,
      },
      consumer,
    };
  }

  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return null;
  }

  return {
    kind: "user",
    auditActor: getAuditActorFromSession(session),
  };
}

function hasGrant(
  consumer: ConsumerWithGrants,
  predicate: (grant: AccessGrant) => boolean,
) {
  return consumer.accessGrants.some((grant) => grant.active && predicate(grant));
}

export function canReadServiceMetadata(actor: RequestActor, service: Pick<Service, "id" | "visibilityMode">) {
  if (actor.kind === "user" || actor.kind === "global") {
    return true;
  }

  if (service.visibilityMode === VisibilityMode.TRUSTED_AGENTS && actor.consumer.isTrusted) {
    return true;
  }

  return hasGrant(
    actor.consumer,
    (grant) =>
      grant.serviceId === service.id &&
      (grant.canReadMetadata || grant.canReadDocs || grant.canReadSecrets),
  );
}

export function canReadServiceDocs(actor: RequestActor, service: Pick<Service, "id" | "visibilityMode">) {
  if (actor.kind === "user" || actor.kind === "global") {
    return true;
  }

  if (service.visibilityMode === VisibilityMode.TRUSTED_AGENTS && actor.consumer.isTrusted) {
    return true;
  }

  return hasGrant(
    actor.consumer,
    (grant) =>
      grant.serviceId === service.id && (grant.canReadDocs || grant.canReadMetadata || grant.canReadSecrets),
  );
}

export function canReadSecret(
  actor: RequestActor,
  secret: Pick<Secret, "id" | "serviceId" | "visibilityMode">,
) {
  if (actor.kind === "user" || actor.kind === "global") {
    return true;
  }

  if (secret.visibilityMode === VisibilityMode.TRUSTED_AGENTS && actor.consumer.isTrusted) {
    return true;
  }

  return hasGrant(
    actor.consumer,
    (grant) =>
      (grant.secretId === secret.id || grant.serviceId === secret.serviceId) &&
      grant.canReadSecrets,
  );
}
