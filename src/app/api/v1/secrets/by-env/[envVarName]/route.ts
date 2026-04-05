import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { authenticateRequestActor, canReadSecret } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { decryptSecretValue } from "@/lib/security/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ envVarName: string }> },
) {
  const actor = await authenticateRequestActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { envVarName } = await params;
  const secret = await prisma.secret.findUnique({
    where: {
      envVarName,
    },
    include: {
      service: true,
    },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  if (!canReadSecret(actor, secret)) {
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
    action: AuditAction.SECRET_RETRIEVED,
    serviceId: secret.serviceId,
    secretId: secret.id,
    consumerId: actor.kind === "consumer" ? actor.consumer.id : null,
    metadataJson: {
      envVarName: secret.envVarName,
      service: secret.service.slug,
      globalAccess: actor.kind === "global",
    },
  });

  return NextResponse.json({
    secret: {
      id: secret.id,
      label: secret.label,
      envVarName: secret.envVarName,
      value: decryptSecretValue(secret.encryptedValue),
      description: secret.description,
      updatedAt: secret.updatedAt,
    },
    service: {
      id: secret.service.id,
      name: secret.service.name,
      slug: secret.service.slug,
      visibilityMode: secret.service.visibilityMode,
    },
  });
}
