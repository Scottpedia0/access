import { notFound } from "next/navigation";

import { SecretForm } from "@/components/forms/secret-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function NewSecretPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
  });

  if (!service) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New key"
        title={`Add a key to ${service.name}`}
        description="Values are encrypted server-side before they ever hit the database."
      />
      <SectionCard title="Key details" eyebrow="Encrypted input">
        <SecretForm serviceId={service.id} submitLabel="Create key" />
      </SectionCard>
    </div>
  );
}
