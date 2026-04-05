import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { submitSharedIntake } from "@/lib/intake";

const requestSchema = z.object({
  intakeToken: z.string().optional(),
  serviceName: z.string().min(2),
  secretValue: z.string().min(1),
  envVarName: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.replace("Bearer ", "").trim() || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);
    const intakeToken =
      getBearerToken(request) ??
      request.headers.get("x-intake-token")?.trim() ??
      parsed.intakeToken;

    const result = await submitSharedIntake({
      intakeToken: intakeToken ?? "",
      serviceName: parsed.serviceName,
      secretValue: parsed.secretValue,
      envVarName: parsed.envVarName,
      label: parsed.label,
      description: parsed.description,
      notes: parsed.notes,
      actorId: "shared-intake-api",
      actorLabel: "Shared intake API",
      source: "api",
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      serviceName: result.serviceName,
      envVarName: result.envVarName,
      message: result.success,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that key.";
    const status = message === "This request is missing a valid intake token." ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}
