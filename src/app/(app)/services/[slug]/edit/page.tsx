import { notFound } from "next/navigation";

import { ServiceForm } from "@/components/forms/service-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function EditServicePage({
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
        eyebrow="Edit service"
        title={`Update ${service.name}`}
        description="Refine the service summary, risk posture, and default access mode."
      />
      <SectionCard title="Service details" eyebrow="Editing">
        <ServiceForm
          title="Save changes"
          description="Service-level visibility sets the default posture for docs and metadata. Secrets can still be tightened individually."
          values={service}
        />
      </SectionCard>
    </div>
  );
}
