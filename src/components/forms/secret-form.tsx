import { VisibilityMode } from "@prisma/client";

import { upsertSecretAction } from "@/actions/secrets";
import { formatEnumLabel } from "@/lib/utils";
import { visibilityModeOptions } from "@/lib/options";

type SecretFormValues = {
  id?: string;
  label?: string;
  envVarName?: string;
  description?: string;
  category?: string;
  visibilityMode?: VisibilityMode;
  notes?: string;
  active?: boolean;
  deprecated?: boolean;
};

export function SecretForm({
  serviceId,
  submitLabel,
  values,
}: {
  serviceId: string;
  submitLabel: string;
  values?: SecretFormValues;
}) {
  return (
    <form action={upsertSecretAction} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      {values?.id ? <input type="hidden" name="secretId" value={values.id} /> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">What is this key for?</span>
          <input
            name="label"
            required
            defaultValue={values?.label}
            className="field"
            placeholder="Primary API key"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Env var name</span>
          <input
            name="envVarName"
            required
            defaultValue={values?.envVarName}
            className="field font-mono"
            placeholder="OPENROUTER_API_KEY"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">
          Actual key value{" "}
          {values?.id ? (
            <span className="text-stone-500">(leave blank to keep current value)</span>
          ) : null}
        </span>
        <textarea
          name="secretValue"
          rows={4}
          className="field min-h-[140px] font-mono"
          placeholder={
            values?.id
              ? "Leave blank to preserve the current encrypted value"
              : "Paste the key or token here"
          }
        />
      </label>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Category</span>
          <input
            name="category"
            defaultValue={values?.category}
            className="field"
            placeholder="bearer token"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Visibility</span>
          <select
            name="visibilityMode"
            defaultValue={values?.visibilityMode ?? VisibilityMode.OWNER_ONLY}
            className="field"
          >
            {visibilityModeOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={values?.description}
          className="field min-h-[110px]"
          placeholder="What this key does and when it should be used."
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Notes</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={values?.notes}
          className="field min-h-[140px]"
          placeholder="Rotation notes, quirks, usage boundaries, rate-limit caveats."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={values?.active ?? true}
            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          Active
        </label>
        <label className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700">
          <input
            type="checkbox"
            name="deprecated"
            defaultChecked={values?.deprecated ?? false}
            className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          Deprecated
        </label>
        {values?.id ? (
          <label className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700">
            <input
              type="checkbox"
              name="rotateNow"
              className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            Mark as rotated
          </label>
        ) : null}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
