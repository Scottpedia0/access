import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/forms/resource-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ slug: string; resourceId: string }>;
}) {
  const { slug, resourceId } = await params;
  const [service, resource] = await Promise.all([
    prisma.service.findUnique({ where: { slug } }),
    prisma.linkedResource.findUnique({ where: { id: resourceId } }),
  ]);

  if (!service || !resource || resource.serviceId !== service.id) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Edit link"
        title={resource.label}
        description="Keep the pointers current so the service page stays operationally useful."
      />
      <SectionCard title="Link or file" eyebrow="Editing">
        <ResourceForm
          serviceId={service.id}
          submitLabel="Save link"
          values={resource}
        />
      </SectionCard>
    </div>
  );
}
