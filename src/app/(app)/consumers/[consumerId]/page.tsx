import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConsumerTokenRotation } from "@/components/ui/consumer-token-rotation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatEnumLabel } from "@/lib/utils";

export default async function ConsumerDetailPage({
  params,
}: {
  params: Promise<{ consumerId: string }>;
}) {
  const { consumerId } = await params;
  const consumer = await prisma.consumer.findUnique({
    where: { id: consumerId },
    include: {
      accessGrants: {
        include: {
          service: true,
          secret: {
            include: {
              service: true,
            },
          },
        },
      },
    },
  });

  if (!consumer) {
    notFound();
  }

  const serviceGrants = consumer.accessGrants.filter((grant) => grant.service);
  const secretGrants = consumer.accessGrants.filter((grant) => grant.secret);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agent or tool"
        title={consumer.name}
        description={consumer.notes || "No notes yet."}
        actions={
          <Link
            href={`/consumers/${consumer.id}/edit`}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950"
          >
            <Pencil className="h-4 w-4" />
            Edit access
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Kind", value: formatEnumLabel(consumer.kind) },
          { label: "Trusted", value: consumer.isTrusted ? "Yes" : "No" },
          { label: "Last issued", value: formatDateTime(consumer.lastIssuedAt) },
          { label: "Last used", value: formatDateTime(consumer.lastUsedAt) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-stone-300/70 bg-white/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {item.label}
            </p>
            <p className="mt-4 text-lg font-semibold text-stone-950">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Identity" eyebrow="Machine access">
          <div className="flex flex-wrap gap-2">
            <Badge>{formatEnumLabel(consumer.kind)}</Badge>
            <Badge tone={consumer.active ? "success" : "warning"}>
              {consumer.active ? "Active" : "Inactive"}
            </Badge>
            {consumer.isTrusted ? <Badge tone="accent">Trusted agent</Badge> : null}
          </div>
          <div className="mt-5 rounded-[20px] bg-stone-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Token prefix
            </p>
            <p className="mt-3 break-all font-mono text-sm text-stone-700">
              {consumer.tokenPrefix ?? "Token not issued yet"}
            </p>
          </div>
          <div className="mt-4 rounded-[20px] bg-stone-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              One-pull endpoint
            </p>
            <p className="mt-3 break-all font-mono text-sm text-stone-700">
              /api/v1/bootstrap
            </p>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Use the bearer token with this route to fetch the approved service bundle in one
              call.
            </p>
          </div>
        </SectionCard>

        <ConsumerTokenRotation consumerId={consumer.id} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Full service access" eyebrow="Broad access">
          {serviceGrants.length === 0 ? (
            <EmptyState
              title="No full service access"
              description="This agent or tool does not currently have any service-wide access."
            />
          ) : (
            <div className="space-y-3">
              {serviceGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="rounded-[18px] border border-stone-200 bg-stone-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/services/${grant.service!.slug}`}
                      className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-4"
                    >
                      {grant.service!.name}
                    </Link>
                    <Badge tone="success">Metadata</Badge>
                    <Badge tone="success">Docs</Badge>
                    <Badge tone="accent">Secrets</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Specific key access" eyebrow="Scoped access">
          {secretGrants.length === 0 ? (
            <EmptyState
              title="No specific key access"
              description="Use this when a tool should fetch one key without seeing the rest of a service."
            />
          ) : (
            <div className="space-y-3">
              {secretGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="rounded-[18px] border border-stone-200 bg-stone-50/70 p-4"
                >
                  <p className="font-medium text-stone-900">{grant.secret!.label}</p>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                    {grant.secret!.envVarName}
                  </p>
                  <Link
                    href={`/services/${grant.secret!.service.slug}`}
                    className="mt-3 inline-flex text-sm font-medium text-amber-700 transition hover:text-amber-800"
                  >
                    {grant.secret!.service.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
