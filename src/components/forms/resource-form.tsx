import { ResourceType } from "@prisma/client";

import { upsertResourceAction } from "@/actions/resources";
import { formatEnumLabel } from "@/lib/utils";
import { resourceTypeOptions } from "@/lib/options";

type ResourceFormValues = {
  id?: string;
  label?: string;
  resourceType?: ResourceType;
  pathOrUrl?: string;
  notes?: string;
};

export function ResourceForm({
  serviceId,
  submitLabel,
  values,
}: {
  serviceId: string;
  submitLabel: string;
  values?: ResourceFormValues;
}) {
  return (
    <form action={upsertResourceAction} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      {values?.id ? <input type="hidden" name="resourceId" value={values.id} /> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Label</span>
          <input
            name="label"
            required
            defaultValue={values?.label}
            className="field"
            placeholder="OpenRouter skill"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Resource type</span>
          <select
            name="resourceType"
            defaultValue={values?.resourceType ?? ResourceType.URL}
            className="field"
          >
            {resourceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Path or URL</span>
        <input
          name="pathOrUrl"
          required
          defaultValue={values?.pathOrUrl}
          className="field font-mono"
          placeholder="/path/to/resource"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Notes</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={values?.notes}
          className="field min-h-[140px]"
          placeholder="How this resource is used, where it matters, any setup caveats."
        />
      </label>

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
