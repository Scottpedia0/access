import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkdownBody } from "@/components/ui/markdown-body";
import { PageHeader } from "@/components/ui/page-header";
import { SecretRevealCard } from "@/components/ui/secret-reveal-card";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";
import { compactText, formatDateTime, formatEnumLabel } from "@/lib/utils";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      secrets: {
        include: {
          accessGrants: {
            include: {
              consumer: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      },
      docs: {
        orderBy: [{ updatedAt: "desc" }],
      },
      linkedResources: {
        orderBy: [{ updatedAt: "desc" }],
      },
      accessGrants: {
        include: {
          consumer: true,
        },
      },
      auditEvents: {
        include: {
          consumer: true,
          secret: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 25,
      },
    },
  });

  if (!service) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Service detail"
        title={service.name}
        description={service.description || service.notesSummary || "No notes yet."}
        actions={
          <>
            <Link
              href={`/services/${service.slug}/edit`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950"
            >
              <Pencil className="h-4 w-4" />
              Edit service
            </Link>
            <Link
              href={`/services/${service.slug}/secrets/new`}
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
            >
              <Plus className="h-4 w-4" />
              Add key
            </Link>
            <Link
              href={`/services/${service.slug}/docs/new`}
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              <FileText className="h-4 w-4" />
              Add note
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Status", value: formatEnumLabel(service.status) },
          { label: "Risk", value: formatEnumLabel(service.riskLevel) },
          { label: "Visibility", value: formatEnumLabel(service.visibilityMode) },
          { label: "Updated", value: formatDateTime(service.updatedAt) },
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Overview" eyebrow="Why this exists">
          <div className="flex flex-wrap gap-2">
            {service.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
            {!service.tags.length ? <Badge tone="neutral">No tags yet</Badge> : null}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Description
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {service.description || service.notesSummary || "No description yet."}
              </p>
            </div>
            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Notes summary
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {service.notesSummary || "No operator summary yet."}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Usage hints" eyebrow="Env and workflows">
          <div className="space-y-4">
            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <div className="mb-3 flex items-center gap-2 text-stone-800">
                <TerminalSquare className="h-4 w-4" />
                <span className="font-medium">Known env vars</span>
              </div>
              {service.secrets.length ? (
                <div className="flex flex-wrap gap-2">
                  {service.secrets.map((secret) => (
                    <code
                      key={secret.id}
                      className="rounded-full bg-white px-3 py-2 text-xs text-stone-700"
                    >
                      {secret.envVarName}
                    </code>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-stone-600">
                  No env var names stored yet.
                </p>
              )}
            </div>

            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <div className="mb-3 flex items-center gap-2 text-stone-800">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-medium">Access posture</span>
              </div>
              <p className="text-sm leading-7 text-stone-600">
                This service defaults to{" "}
                <span className="font-medium text-stone-900">
                  {formatEnumLabel(service.visibilityMode)}
                </span>
                . Use agent or tool access grants for explicit machine access without opening the whole dashboard.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Keys"
        eyebrow="Encrypted values"
        actions={
          <Link
            href={`/services/${service.slug}/secrets/new`}
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Add another key
          </Link>
        }
      >
        {service.secrets.length === 0 ? (
          <EmptyState
            title="No keys yet"
            description="Store the actual key here. If a service needs more than one key or token, just keep adding them."
          />
        ) : (
          <div className="space-y-4">
            {service.secrets.map((secret) => (
              <div key={secret.id} className="space-y-3">
                <SecretRevealCard
                  secretId={secret.id}
                  label={secret.label}
                  envVarName={secret.envVarName}
                  description={secret.description}
                  category={secret.category}
                  visibilityMode={formatEnumLabel(secret.visibilityMode)}
                  notes={secret.notes}
                  active={secret.active}
                  deprecated={secret.deprecated}
                  lastRevealedAt={secret.lastRevealedAt}
                />
                <div className="flex justify-end">
                  <Link
                    href={`/services/${service.slug}/secrets/${secret.id}/edit`}
                    className="text-sm font-medium text-amber-700 transition hover:text-amber-800"
                  >
                    Edit key
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Notes"
          eyebrow="Context"
          actions={
            <Link
              href={`/services/${service.slug}/docs/new`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950"
            >
              <Plus className="h-4 w-4" />
              Add note
            </Link>
          }
        >
          {service.docs.length === 0 ? (
            <EmptyState
              title="No notes yet"
              description="Drop anything useful here: why this service exists, what the weird edge cases are, and what future-you should know."
            />
          ) : (
            <div className="space-y-5">
              {service.docs.map((doc) => (
                <div key={doc.id} className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-950">{doc.title}</h3>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Updated {formatDateTime(doc.updatedAt)}
                      </p>
                    </div>
                    <Link
                      href={`/services/${service.slug}/docs/${doc.id}/edit`}
                      className="text-sm font-medium text-amber-700 transition hover:text-amber-800"
                    >
                      Edit doc
                    </Link>
                  </div>
                  <div className="mt-5">
                    <MarkdownBody value={doc.markdownBody || "No markdown body yet."} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Linked resources"
          eyebrow="Files and links"
          actions={
            <Link
              href={`/services/${service.slug}/resources/new`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950"
            >
              <Plus className="h-4 w-4" />
              Add link
            </Link>
          }
        >
          {service.linkedResources.length === 0 ? (
            <EmptyState
              title="No links yet"
              description="Attach any file path, skill path, repo file, or URL you want sitting next to this service."
            />
          ) : (
            <div className="space-y-4">
              {service.linkedResources.map((resource) => {
                const isExternal =
                  resource.pathOrUrl.startsWith("http://") ||
                  resource.pathOrUrl.startsWith("https://");

                return (
                  <div
                    key={resource.id}
                    className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <h3 className="text-lg font-semibold text-stone-950">{resource.label}</h3>
                          <Badge>{formatEnumLabel(resource.resourceType)}</Badge>
                        </div>
                        <p className="mt-3 break-all font-mono text-xs text-stone-600">
                          {resource.pathOrUrl}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        {isExternal ? (
                          <a
                            href={resource.pathOrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-stone-700 transition hover:text-stone-950"
                          >
                            Open
                          </a>
                        ) : null}
                        <Link
                          href={`/services/${service.slug}/resources/${resource.id}/edit`}
                          className="text-sm font-medium text-amber-700 transition hover:text-amber-800"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                    {resource.notes ? (
                      <p className="mt-4 text-sm leading-7 text-stone-600">
                        {compactText(resource.notes, 260)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Who can use this" eyebrow="Agents & tools">
          <div className="space-y-5">
            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Full service access
              </p>
              {service.accessGrants.length ? (
                <div className="mt-4 space-y-3">
                  {service.accessGrants.map((grant) => (
                    <div
                      key={grant.id}
                      className="rounded-[16px] border border-stone-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">{grant.consumer.name}</span>
                        <Badge>{formatEnumLabel(grant.consumer.kind)}</Badge>
                        {grant.consumer.isTrusted ? <Badge tone="success">Trusted</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-stone-600">
                        Metadata {grant.canReadMetadata ? "yes" : "no"}, docs{" "}
                        {grant.canReadDocs ? "yes" : "no"}, secrets{" "}
                        {grant.canReadSecrets ? "yes" : "no"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  No full service access yet.
                </p>
              )}
            </div>

            <div className="rounded-[20px] bg-stone-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Specific key access
              </p>
              <div className="mt-4 space-y-3">
                {service.secrets.some((secret) => secret.accessGrants.length > 0) ? (
                  service.secrets
                    .filter((secret) => secret.accessGrants.length > 0)
                    .map((secret) => (
                      <div key={secret.id} className="rounded-[16px] border border-stone-200 bg-white px-4 py-3">
                        <p className="font-medium text-stone-900">{secret.label}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {secret.accessGrants.map((grant) => (
                            <Badge key={grant.id} tone="accent">
                              {grant.consumer.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm leading-7 text-stone-600">
                    No specific key access yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Audit trail" eyebrow="Recent activity">
          <div className="space-y-3">
            {service.auditEvents.length ? (
              service.auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[18px] border border-stone-200 bg-stone-50/70 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {formatEnumLabel(event.action)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                        {event.actorLabel ?? event.actorId}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-stone-500">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                  {event.metadataJson ? (
                    <pre className="mt-3 overflow-x-auto rounded-[16px] bg-white/80 p-3 text-xs text-stone-600">
                      {JSON.stringify(event.metadataJson, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                title="No audit events yet"
                description="Actions like reveal, copy, edit, and API retrievals will show up here."
              />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
