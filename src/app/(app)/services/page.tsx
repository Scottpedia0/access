import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";
import { compactText, formatDateTime, formatEnumLabel } from "@/lib/utils";

export default async function ServicesPage() {
  const [services, activeSecretCount, consumerCount, auditCount] = await Promise.all([
    prisma.service.findMany({
      include: {
        _count: {
          select: {
            secrets: true,
            docs: true,
            linkedResources: true,
            accessGrants: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.secret.count({
      where: {
        active: true,
      },
    }),
    prisma.consumer.count(),
    prisma.auditEvent.count(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Services"
        title="Scott’s operator registry"
        description="The main job here is simple: name a service, paste one or more keys, and keep any notes nearby so you never have to hunt for them again."
        actions={
          <Link
            href="/services/new"
            className="app-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Quick add service
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Services", value: services.length.toString() },
          { label: "Active keys", value: activeSecretCount.toString() },
          { label: "Agents", value: consumerCount.toString() },
          { label: "History items", value: auditCount.toString() },
        ].map((item) => (
          <div
            key={item.label}
            className="app-stat-card rounded-[26px] p-5"
          >
            <p className="app-kicker text-xs font-semibold uppercase tracking-[0.2em]">
              {item.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title="Service map" eyebrow="Inventory">
        {services.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Start with the APIs Scott reaches for most often: OpenAI, Gemini, Claude, OpenRouter, Apollo, HubSpot, Zoom, Vercel. Add the keys first. Extra notes can come later."
            action={
              <Link
                href="/services/new"
                className="app-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Add the first service
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.slug}`}
                className="app-panel-subtle app-panel-subtle-hover group rounded-[22px] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                      {service.name}
                    </h2>
                    <p className="app-text-muted mt-1 text-sm leading-6">
                      {compactText(
                        service.description || service.notesSummary || "No description yet.",
                        120,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[color:var(--muted-soft)] transition group-hover:translate-x-1 group-hover:text-[color:var(--foreground)]" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="accent">{formatEnumLabel(service.riskLevel)}</Badge>
                  <Badge>{formatEnumLabel(service.status)}</Badge>
                  <Badge>{formatEnumLabel(service.visibilityMode)}</Badge>
                  {service.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="app-text-muted mt-4 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {service._count.secrets} keys, {service._count.docs} notes,{" "}
                    {service._count.linkedResources} links
                  </p>
                  <p className="app-kicker">Updated {formatDateTime(service.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
