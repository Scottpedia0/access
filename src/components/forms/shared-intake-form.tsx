"use client";

import { useActionState } from "react";

import { submitSharedIntakeAction } from "@/actions/intake";
import type { SharedIntakeState } from "@/actions/intake";

export function SharedIntakeForm({
  intakeToken,
  initialServiceName,
}: {
  intakeToken: string;
  initialServiceName?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitSharedIntakeAction,
    {} as SharedIntakeState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="intakeToken" value={intakeToken} />

      <label className="block space-y-2">
        <span className="text-sm font-medium text-stone-800">Service</span>
        <input
          name="serviceName"
          required
          defaultValue={state.serviceName ?? initialServiceName}
          className="w-full rounded-[20px] border border-stone-200 bg-white px-5 py-4 text-lg text-stone-950 outline-none transition focus:border-stone-400 focus:ring-4 focus:ring-stone-200/70"
          placeholder="OpenRouter"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-stone-800">Key</span>
        <textarea
          name="secretValue"
          required
          rows={7}
          className="w-full rounded-[20px] border border-stone-200 bg-white px-5 py-4 font-mono text-sm text-stone-950 outline-none transition focus:border-stone-400 focus:ring-4 focus:ring-stone-200/70"
          placeholder="Paste the API key here"
        />
      </label>

      {state.error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>{state.success}</p>
          {state.serviceName && state.envVarName ? (
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">
              {state.serviceName} • {state.envVarName}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Saving…" : "Save key"}
      </button>
    </form>
  );
}
