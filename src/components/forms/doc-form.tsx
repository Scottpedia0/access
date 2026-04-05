import { upsertDocAction } from "@/actions/docs";

type DocFormValues = {
  id?: string;
  title?: string;
  markdownBody?: string;
};

export function DocForm({
  serviceId,
  submitLabel,
  values,
}: {
  serviceId: string;
  submitLabel: string;
  values?: DocFormValues;
}) {
  return (
    <form action={upsertDocAction} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      {values?.id ? <input type="hidden" name="docId" value={values.id} /> : null}

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Document title</span>
        <input
          name="title"
          required
          defaultValue={values?.title}
          className="field"
          placeholder="HubSpot notes"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-800">Markdown body</span>
        <textarea
          name="markdownBody"
          rows={16}
          defaultValue={values?.markdownBody}
          className="field min-h-[420px] font-mono text-sm"
          placeholder="# Overview&#10;&#10;What this service does, quirks, endpoints, agent usage, risks…"
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
