import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatEnumLabel } from "@/lib/utils";

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({
    include: {
      service: true,
      secret: true,
      consumer: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Audit"
        title="Activity trail"
        description="Every reveal, copy, edit, and machine retrieval lands here so you can see who touched what and when."
      />
      <SectionCard title="Recent events" eyebrow="100 latest entries">
        {events.length === 0 ? (
          <EmptyState
            title="No audit events yet"
            description="Once secrets are created, viewed, copied, or fetched through the API, this table will fill in."
          />
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-[20px] border border-stone-200 bg-stone-50/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {formatEnumLabel(event.action)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                      {event.actorLabel ?? event.actorId}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-stone-500">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {event.service ? (
                    <Link
                      href={`/services/${event.service.slug}`}
                      className="rounded-full bg-white px-3 py-2 text-xs font-medium text-stone-700"
                    >
                      Service: {event.service.name}
                    </Link>
                  ) : null}
                  {event.secret ? (
                    <span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-stone-700">
                      Secret: {event.secret.label}
                    </span>
                  ) : null}
                  {event.consumer ? (
                    <Link
                      href={`/consumers/${event.consumer.id}`}
                      className="rounded-full bg-white px-3 py-2 text-xs font-medium text-stone-700"
                    >
                      Consumer: {event.consumer.name}
                    </Link>
                  ) : null}
                </div>

                {event.metadataJson ? (
                  <pre className="mt-4 overflow-x-auto rounded-[18px] bg-white/90 p-4 text-xs text-stone-600">
                    {JSON.stringify(event.metadataJson, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
