import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/forms/resource-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function NewResourcePage({
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
        eyebrow="New link"
        title={`Attach working context to ${service.name}`}
        description="Local skill paths, repo files, URLs, and automation notes all belong here."
      />
      <SectionCard title="Link or file" eyebrow="Context pointer">
        <ResourceForm serviceId={service.id} submitLabel="Save link" />
      </SectionCard>
    </div>
  );
}
