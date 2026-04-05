import { notFound } from "next/navigation";

import { SecretForm } from "@/components/forms/secret-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function EditSecretPage({
  params,
}: {
  params: Promise<{ slug: string; secretId: string }>;
}) {
  const { slug, secretId } = await params;
  const [service, secret] = await Promise.all([
    prisma.service.findUnique({ where: { slug } }),
    prisma.secret.findUnique({ where: { id: secretId } }),
  ]);

  if (!service || !secret || secret.serviceId !== service.id) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Edit key"
        title={`Update ${secret.label}`}
        description="You can keep the existing encrypted value by leaving the secret field blank."
      />
      <SectionCard title="Key details" eyebrow="Editing">
        <SecretForm
          serviceId={service.id}
          submitLabel="Save key"
          values={secret}
        />
      </SectionCard>
    </div>
  );
}
