"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { ConsumerKind } from "@prisma/client";

import { saveConsumerAction } from "@/actions/consumers";
import type { ConsumerFormState } from "@/actions/consumers";
import { formatEnumLabel } from "@/lib/utils";
import { consumerKindOptions } from "@/lib/options";

type ConsumerOption = {
  id: string;
  name: string;
};

type SecretOption = {
  id: string;
  label: string;
  envVarName: string;
  serviceName: string;
};

type ConsumerFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  kind?: ConsumerKind;
  isTrusted?: boolean;
  active?: boolean;
  notes?: string;
  selectedServiceIds?: string[];
  selectedSecretIds?: string[];
};

export function ConsumerForm({
  values,
  services,
  secrets,
}: {
  values?: ConsumerFormValues;
  services: ConsumerOption[];
  secrets: SecretOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveConsumerAction,
    {} as ConsumerFormState,
  );

  useEffect(() => {
    if (state.redirectTo && !state.issuedToken) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.issuedToken]);

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-8">
        {values?.id ? <input type="hidden" name="consumerId" value={values.id} /> : null}

        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-800">Agent or tool name</span>
            <input
              name="name"
              required
              defaultValue={values?.name}
              className="field"
              placeholder="my-agent"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-800">Slug</span>
            <input
              name="slug"
              defaultValue={values?.slug}
              className="field"
              placeholder="my-agent"
            />
          </label>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-800">Type</span>
            <select
              name="kind"
              defaultValue={values?.kind ?? ConsumerKind.TRUSTED_AGENT}
              className="field"
            >
              {consumerKindOptions.map((option) => (
                <option key={option} value={option}>
                  {formatEnumLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-stone-800">Notes</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={values?.notes}
              className="field min-h-[140px]"
              placeholder="What this is for, where it runs, and anything future-you should remember."
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700">
            <input
              type="checkbox"
              name="isTrusted"
              defaultChecked={values?.isTrusted ?? true}
              className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            Trusted agent or tool
          </label>
          <label className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={values?.active ?? true}
              className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            Active
          </label>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
            <h3 className="text-lg font-semibold text-stone-950">Full service access</h3>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              This gives the agent or tool the notes, docs, and keys for that whole service.
            </p>
            <div className="mt-5 space-y-3">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-3 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
                >
                  <input
                    type="checkbox"
                    name="serviceGrantIds"
                    value={service.id}
                    defaultChecked={values?.selectedServiceIds?.includes(service.id)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
            <h3 className="text-lg font-semibold text-stone-950">Specific key access</h3>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              Use this when it should fetch one key without seeing the whole service.
            </p>
            <div className="mt-5 space-y-3">
              {secrets.map((secret) => (
                <label
                  key={secret.id}
                  className="flex items-start gap-3 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
                >
                  <input
                    type="checkbox"
                    name="secretGrantIds"
                    value={secret.id}
                    defaultChecked={values?.selectedSecretIds?.includes(secret.id)}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <span className="block font-medium text-stone-900">{secret.label}</span>
                    <span className="block font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                      {secret.envVarName}
                    </span>
                    <span className="block text-xs text-stone-500">{secret.serviceName}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {state.error ? (
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {state.error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Saving…" : values?.id ? "Save access" : "Create agent or tool"}
          </button>
        </div>
      </form>

      {state.issuedToken ? (
        <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Token issued once
          </p>
          <p className="mt-3 break-all font-mono text-sm text-amber-950">{state.issuedToken}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.issuedToken!)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <Copy className="h-4 w-4" />
              Copy token
            </button>
            {state.redirectTo ? (
              <button
                type="button"
                onClick={() => router.push(state.redirectTo!)}
                className="inline-flex items-center rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
              >
                Open access
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
