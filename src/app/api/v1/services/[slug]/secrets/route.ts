import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { authenticateRequestActor, canReadSecret } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { decryptSecretValue } from "@/lib/security/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await authenticateRequestActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      secrets: true,
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const secrets = service.secrets.filter((secret) => canReadSecret(actor, secret));

  if (!secrets.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.kind === "consumer") {
    await prisma.consumer.update({
      where: { id: actor.consumer.id },
      data: { lastUsedAt: new Date() },
    });
  }

  await createAuditEvent({
    actor: actor.auditActor,
    action: AuditAction.SERVICE_SECRETS_RETRIEVED,
    serviceId: service.id,
    consumerId: actor.kind === "consumer" ? actor.consumer.id : null,
    metadataJson: {
      slug: service.slug,
      count: secrets.length,
      globalAccess: actor.kind === "global",
    },
  });

  return NextResponse.json({
    service: {
      id: service.id,
      name: service.name,
      slug: service.slug,
    },
    secrets: secrets.map((secret) => ({
      id: secret.id,
      label: secret.label,
      envVarName: secret.envVarName,
      value: decryptSecretValue(secret.encryptedValue),
      description: secret.description,
      updatedAt: secret.updatedAt,
    })),
  });
}
