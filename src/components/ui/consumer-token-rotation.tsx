"use client";

import { useActionState } from "react";
import { Copy, RefreshCcw } from "lucide-react";

import { rotateConsumerTokenAction } from "@/actions/consumers";
import type { RotateConsumerTokenState } from "@/actions/consumers";

export function ConsumerTokenRotation({ consumerId }: { consumerId: string }) {
  const [state, formAction, pending] = useActionState(
    rotateConsumerTokenAction,
    {} as RotateConsumerTokenState,
  );

  return (
    <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">Rotate access token</h3>
          <p className="mt-2 text-sm leading-7 text-stone-600">
            Issue a fresh bearer token for this agent or tool. The new raw token is only shown once.
          </p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="consumerId" value={consumerId} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            {pending ? "Rotating…" : "Rotate token"}
          </button>
        </form>
      </div>

      {state.error ? <p className="mt-4 text-sm text-rose-700">{state.error}</p> : null}

      {state.issuedToken ? (
        <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            New token
          </p>
          <p className="mt-3 break-all font-mono text-sm text-amber-950">{state.issuedToken}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(state.issuedToken!)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            <Copy className="h-4 w-4" />
            Copy token
          </button>
        </div>
      ) : null}
    </div>
  );
}
