import { NextRequest, NextResponse } from "next/server";

import { authenticateRequestActor } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const actor = await authenticateRequestActor(request);

  // Unauthenticated callers only get a basic liveness check
  if (!actor) {
    return NextResponse.json({ ok: true });
  }

  // Authenticated callers get inventory counts
  const [services, secrets, consumers] = await Promise.all([
    prisma.service.count(),
    prisma.secret.count(),
    prisma.consumer.count(),
  ]);

  return NextResponse.json({
    ok: true,
    services,
    secrets,
    consumers,
  });
}
