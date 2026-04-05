"use server";

import { z } from "zod";

import { submitSharedIntake } from "@/lib/intake";

const intakeSchema = z.object({
  intakeToken: z.string().min(1),
  serviceName: z.string().min(2),
  secretValue: z.string().min(1),
});

export type SharedIntakeState = {
  error?: string;
  success?: string;
  serviceName?: string;
  envVarName?: string;
};

export async function submitSharedIntakeAction(
  _previousState: SharedIntakeState,
  formData: FormData,
): Promise<SharedIntakeState> {
  try {
    const parsed = intakeSchema.parse({
      intakeToken: formData.get("intakeToken"),
      serviceName: formData.get("serviceName"),
      secretValue: formData.get("secretValue"),
    });
    const result = await submitSharedIntake({
      intakeToken: parsed.intakeToken,
      serviceName: parsed.serviceName,
      secretValue: parsed.secretValue,
      actorId: "shared-intake-link",
      actorLabel: "Shared intake link",
      source: "link",
      notes: "Submitted through the shared intake link.",
    });

    return {
      success: result.success,
      serviceName: result.serviceName,
      envVarName: result.envVarName,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message === "This request is missing a valid intake token."
          ? "This link is missing the intake token. Ask the admin for the full link."
          : error instanceof Error
            ? error.message
            : "Could not save that key.",
    };
  }
}
