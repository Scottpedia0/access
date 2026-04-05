import { notFound } from "next/navigation";

import { ConsumerForm } from "@/components/forms/consumer-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function EditConsumerPage({
  params,
}: {
  params: Promise<{ consumerId: string }>;
}) {
  const { consumerId } = await params;
  const [consumer, services, secrets] = await Promise.all([
    prisma.consumer.findUnique({
      where: { id: consumerId },
      include: {
        accessGrants: true,
      },
    }),
    prisma.service.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.secret.findMany({
      select: {
        id: true,
        label: true,
        envVarName: true,
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ label: "asc" }],
    }),
  ]);

  if (!consumer) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Edit agent or tool"
        title={`Update ${consumer.name}`}
        description="Adjust grant scope without making Scott re-grant the same context every session."
      />
      <SectionCard title="Access details" eyebrow="Editing">
        <ConsumerForm
          values={{
            id: consumer.id,
            name: consumer.name,
            slug: consumer.slug,
            kind: consumer.kind,
            isTrusted: consumer.isTrusted,
            active: consumer.active,
            notes: consumer.notes,
            selectedServiceIds: consumer.accessGrants
              .filter((grant) => grant.serviceId)
              .map((grant) => grant.serviceId!),
            selectedSecretIds: consumer.accessGrants
              .filter((grant) => grant.secretId)
              .map((grant) => grant.secretId!),
          }}
          services={services}
          secrets={secrets.map((secret) => ({
            id: secret.id,
            label: secret.label,
            envVarName: secret.envVarName,
            serviceName: secret.service.name,
          }))}
        />
      </SectionCard>
    </div>
  );
}
