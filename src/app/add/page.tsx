import type { Metadata } from "next";

import { SharedIntakeForm } from "@/components/forms/shared-intake-form";
import { hasSharedIntakeToken, isValidSharedIntakeToken } from "@/lib/env";

export const metadata: Metadata = {
  title: "Add key",
  description: "Private intake link.",
};

export default async function AddKeyPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    t?: string;
    token?: string;
  }>;
}) {
  const params = await searchParams;
  const intakeToken = params.t ?? params.token ?? "";
  const initialServiceName = params.service?.trim() ?? "";
  const isValidLink = hasSharedIntakeToken && isValidSharedIntakeToken(intakeToken);

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-stone-950 sm:px-8">
      <div className="mx-auto max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-400">
          Access
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em] text-stone-950">
          Drop a key
        </h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-stone-500">
          Service and key. Nothing else.
        </p>

        <div className="mt-10 rounded-[32px] border border-stone-200 bg-stone-50 p-6 shadow-[0_30px_90px_-55px_rgba(68,36,16,0.35)] sm:p-8">
          {isValidLink ? (
            <SharedIntakeForm
              intakeToken={intakeToken}
              initialServiceName={initialServiceName}
            />
          ) : (
            <div className="space-y-3 text-sm leading-7 text-stone-600">
              <p className="font-medium text-stone-900">This link is missing the access token.</p>
              <p>Ask Scott for the full add-key link and try again.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
