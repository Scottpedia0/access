"use client";

import { useActionState, useState } from "react";
import { Copy, Eye, KeyRound, TerminalSquare } from "lucide-react";

import { revealSecretAction } from "@/actions/secrets";
import type { RevealSecretState } from "@/actions/secrets";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export function SecretRevealCard({
  secretId,
  label,
  envVarName,
  description,
  category,
  visibilityMode,
  notes,
  active,
  deprecated,
  lastRevealedAt,
}: {
  secretId: string;
  label: string;
  envVarName: string;
  description: string;
  category: string;
  visibilityMode: string;
  notes: string;
  active: boolean;
  deprecated: boolean;
  lastRevealedAt: Date | null;
}) {
  const [state, formAction, pending] = useActionState(
    revealSecretAction,
    {} as RevealSecretState,
  );
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  async function logCopy(mode: "value" | "env_line") {
    await fetch(`/api/ui/secrets/${secretId}/copy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });
  }

  async function copyValue(mode: "value" | "env_line") {
    const value = mode === "value" ? state.value : state.envLine;

    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    await logCopy(mode);
    setCopiedMessage(mode === "value" ? "Value copied" : "Export line copied");
    window.setTimeout(() => setCopiedMessage(null), 1800);
  }

  return (
    <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-stone-950">{label}</h3>
            <Badge tone={active ? "success" : "warning"}>
              {active ? "Active" : "Inactive"}
            </Badge>
            {deprecated ? <Badge tone="danger">Deprecated</Badge> : null}
          </div>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
            {envVarName}
          </p>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {category ? <Badge>{category}</Badge> : null}
          <Badge tone="accent">{visibilityMode.replaceAll("_", " ")}</Badge>
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Secret value
            </p>
            <p className="mt-2 font-mono text-sm text-stone-800">
              {state.value ? state.value : "Encrypted at rest. Reveal only when needed."}
            </p>
          </div>
          <form action={formAction}>
            <input type="hidden" name="secretId" value={secretId} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Eye className="h-4 w-4" />
              {pending ? "Revealing…" : "Reveal"}
            </button>
          </form>
        </div>

        {state.error ? (
          <p className="mt-3 text-sm text-rose-700">{state.error}</p>
        ) : null}

        {state.value ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => copyValue("value")}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <Copy className="h-4 w-4" />
              Copy value
            </button>
            <button
              type="button"
              onClick={() => copyValue("env_line")}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <TerminalSquare className="h-4 w-4" />
              Copy export line
            </button>
            {copiedMessage ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                {copiedMessage}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 text-sm text-stone-600 md:grid-cols-2">
        <div className="rounded-[16px] bg-white/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-stone-800">
            <KeyRound className="h-4 w-4" />
            <span className="font-medium">Usage notes</span>
          </div>
          <p className="leading-7">{notes || "No extra notes yet."}</p>
        </div>
        <div className="rounded-[16px] bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Last revealed
          </p>
          <p className="mt-2 text-sm text-stone-700">{formatDateTime(lastRevealedAt)}</p>
        </div>
      </div>
    </div>
  );
}
