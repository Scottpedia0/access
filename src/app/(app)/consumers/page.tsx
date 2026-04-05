import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatEnumLabel } from "@/lib/utils";

export default async function ConsumersPage() {
  const consumers = await prisma.consumer.findMany({
    include: {
      accessGrants: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agents & tools"
        title="Agent and tool access"
        description="Create one access token for your agents and tools, then choose exactly which services or keys it can use in a single bootstrap pull."
        actions={
          <Link
            href="/consumers/new"
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Add agent or tool
          </Link>
        }
      />

      <SectionCard title="Agents & tools" eyebrow="Machine access">
        {consumers.length === 0 ? (
          <EmptyState
            title="No agents or tools yet"
            description="Create entries for your agents, local scripts, or review tools, then issue one token and choose exactly what each one can use."
            action={
              <Link
                href="/consumers/new"
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" />
                Create the first one
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {consumers.map((consumer) => (
              <Link
                key={consumer.id}
                href={`/consumers/${consumer.id}`}
                className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                    {consumer.name}
                  </h2>
                  <Badge>{formatEnumLabel(consumer.kind)}</Badge>
                  <Badge tone={consumer.active ? "success" : "warning"}>
                    {consumer.active ? "Active" : "Inactive"}
                  </Badge>
                  {consumer.isTrusted ? <Badge tone="accent">Trusted</Badge> : null}
                </div>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {consumer.notes || "No notes yet."}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Grants
                    </p>
                    <p className="mt-2 text-sm text-stone-700">{consumer.accessGrants.length}</p>
                  </div>
                  <div className="rounded-[18px] bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Last used
                    </p>
                    <p className="mt-2 text-sm text-stone-700">
                      {formatDateTime(consumer.lastUsedAt)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
