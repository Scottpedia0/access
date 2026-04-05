"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { quickCaptureServiceAction } from "@/actions/services";

type KeyRow = {
  id: string;
  label: string;
  envVarName: string;
  value: string;
};

const presets = [
  {
    name: "OpenAI",
    keys: [{ label: "API key", envVarName: "OPENAI_API_KEY" }],
  },
  {
    name: "Gemini",
    keys: [{ label: "API key", envVarName: "GEMINI_API_KEY" }],
  },
  {
    name: "Claude",
    keys: [{ label: "API key", envVarName: "ANTHROPIC_API_KEY" }],
  },
  {
    name: "OpenRouter",
    keys: [{ label: "API key", envVarName: "OPENROUTER_API_KEY" }],
  },
  {
    name: "Apollo",
    keys: [{ label: "API key", envVarName: "APOLLO_API_KEY" }],
  },
  {
    name: "HubSpot",
    keys: [{ label: "Private app token", envVarName: "HUBSPOT_PRIVATE_APP_TOKEN" }],
  },
  {
    name: "Zoom",
    keys: [
      { label: "Account ID", envVarName: "ZOOM_ACCOUNT_ID" },
      { label: "Client ID", envVarName: "ZOOM_CLIENT_ID" },
      { label: "Client secret", envVarName: "ZOOM_CLIENT_SECRET" },
    ],
  },
  {
    name: "Vercel",
    keys: [{ label: "Personal token", envVarName: "VERCEL_TOKEN" }],
  },
];

function newKeyRow(partial?: Partial<Omit<KeyRow, "id">>): KeyRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: partial?.label ?? "",
    envVarName: partial?.envVarName ?? "",
    value: partial?.value ?? "",
  };
}

export function QuickServiceCaptureForm() {
  const [serviceName, setServiceName] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceLines, setResourceLines] = useState("");
  const [keys, setKeys] = useState<KeyRow[]>([newKeyRow({ label: "API key" })]);

  const secretsJson = useMemo(
    () =>
      JSON.stringify(
        keys.map(({ label, envVarName, value }) => ({
          label,
          envVarName,
          value,
        })),
      ),
    [keys],
  );
  const hasAnyKeyValue = keys.some((key) => key.value.trim().length > 0);

  function replaceWithPreset(name: string) {
    const preset = presets.find((entry) => entry.name === name);

    if (!preset) {
      return;
    }

    setServiceName(preset.name);
    setKeys(preset.keys.map((key) => newKeyRow(key)));
  }

  function updateKey(id: string, patch: Partial<KeyRow>) {
    setKeys((current) => current.map((key) => (key.id === id ? { ...key, ...patch } : key)));
  }

  function addKey() {
    setKeys((current) => [...current, newKeyRow()]);
  }

  function removeKey(id: string) {
    setKeys((current) => {
      const rows = current.filter((key) => key.id !== id);
      return rows.length > 0 ? rows : [newKeyRow()];
    });
  }

  return (
    <form action={quickCaptureServiceAction} className="space-y-8">
      <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Fastest path
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-700">
          Name the service. Paste one or more keys. Save. Everything else is optional.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => replaceWithPreset(preset.name)}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-100 hover:text-stone-950"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Service name</span>
          <input
            name="name"
            required
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            className="field"
            placeholder="OpenAI"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Notes (optional)</span>
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="field min-h-[140px]"
            placeholder="Anything you want to remember about this service. This will automatically become a notes page."
          />
        </label>
      </div>

      <input type="hidden" name="secretsJson" value={secretsJson} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-950">Keys</h2>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              Add as many as you need. If you do not care about the env var name yet, leave it
              blank and the app will make one.
            </p>
          </div>
          <button
            type="button"
            onClick={addKey}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950"
          >
            <Plus className="h-4 w-4" />
            Add another key
          </button>
        </div>

        {keys.map((key, index) => (
          <div
            key={key.id}
            className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">Key {index + 1}</p>
              {keys.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeKey(key.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-800">What is this key for?</span>
                <input
                  value={key.label}
                  onChange={(event) => updateKey(key.id, { label: event.target.value })}
                  className="field"
                  placeholder="API key"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-800">Env var name (optional)</span>
                <input
                  value={key.envVarName}
                  onChange={(event) => updateKey(key.id, { envVarName: event.target.value })}
                  className="field font-mono"
                  placeholder="OPENAI_API_KEY"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-stone-800">Paste the actual key</span>
              <textarea
                value={key.value}
                onChange={(event) => updateKey(key.id, { value: event.target.value })}
                rows={4}
                className="field min-h-[140px] font-mono"
                placeholder="sk-..."
              />
            </label>
          </div>
        ))}
      </div>

      <details className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">
          Optional links or file paths
        </summary>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          One per line. URLs, local file paths, repo files, or anything else you want attached to
          this service.
        </p>
        <textarea
          name="resourceLines"
          value={resourceLines}
          onChange={(event) => setResourceLines(event.target.value)}
          rows={5}
          className="field mt-4 min-h-[160px] font-mono"
          placeholder={"https://platform.openai.com/api-keys"}
        />
      </details>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!serviceName.trim() || !hasAnyKeyValue}
          className="inline-flex items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save service and keys
        </button>
      </div>
    </form>
  );
}
