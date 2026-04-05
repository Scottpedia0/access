import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getAuditActorFromSession, getCurrentSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secretId: string }> },
) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { secretId } = await params;
  const secret = await prisma.secret.findUnique({
    where: { id: secretId },
  });

  if (!secret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  let mode = "value";

  try {
    const body = (await request.json()) as { mode?: string };
    mode = body.mode ?? mode;
  } catch {
    // Ignore empty or invalid JSON bodies.
  }

  await createAuditEvent({
    actor: getAuditActorFromSession(session),
    action: AuditAction.SECRET_COPIED,
    serviceId: secret.serviceId,
    secretId: secret.id,
    metadataJson: {
      mode,
      envVarName: secret.envVarName,
    },
  });

  return NextResponse.json({ ok: true });
}
