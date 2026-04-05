import { RiskLevel, ServiceStatus, VisibilityMode } from "@prisma/client";

import { upsertServiceAction } from "@/actions/services";
import { Badge } from "@/components/ui/badge";
import { formatEnumLabel } from "@/lib/utils";
import {
  riskLevelOptions,
  serviceStatusOptions,
  visibilityModeOptions,
} from "@/lib/options";

type ServiceFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  tags?: string[];
  riskLevel?: RiskLevel;
  notesSummary?: string;
  status?: ServiceStatus;
  visibilityMode?: VisibilityMode;
};

export function ServiceForm({
  title,
  description,
  values,
}: {
  title: string;
  description: string;
  values?: ServiceFormValues;
}) {
  return (
    <form action={upsertServiceAction} className="space-y-8">
      {values?.id ? <input type="hidden" name="serviceId" value={values.id} /> : null}

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Service name</span>
          <input
            name="name"
            required
            defaultValue={values?.name}
            className="field"
            placeholder="OpenRouter"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Slug</span>
          <input
            name="slug"
            defaultValue={values?.slug}
            className="field"
            placeholder="openrouter"
          />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Category</span>
          <input
            name="category"
            defaultValue={values?.category}
            className="field"
            placeholder="AI model routing"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Tags</span>
          <input
            name="tags"
            defaultValue={values?.tags?.join(", ")}
            className="field"
            placeholder="agent, api, routing"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={values?.description}
          className="field min-h-[140px]"
          placeholder="What this service is and why it exists."
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Notes summary</span>
        <textarea
          name="notesSummary"
          rows={4}
          defaultValue={values?.notesSummary}
          className="field min-h-[140px]"
          placeholder="Operator summary: why it matters, risk notes, which agents use it."
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Risk level</span>
          <select
            name="riskLevel"
            defaultValue={values?.riskLevel ?? RiskLevel.MEDIUM}
            className="field"
          >
            {riskLevelOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-800">Status</span>
          <select
            name="status"
            defaultValue={values?.status ?? ServiceStatus.ACTIVE}
            className="field"
          >
            {serviceStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
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

      <div className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Secrets + docs + linked resources</Badge>
          <Badge tone="accent">Encrypted at rest</Badge>
          <Badge tone="success">Machine retrieval ready</Badge>
        </div>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          {description}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
        >
          {title}
        </button>
      </div>
    </form>
  );
}
