import { notFound } from "next/navigation";

import { DocForm } from "@/components/forms/doc-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function NewDocPage({
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
        eyebrow="New note"
        title={`Add context for ${service.name}`}
        description="Capture the why, the quirks, the workflows, and the setup notes while they’re fresh."
      />
      <SectionCard title="Notes" eyebrow="Service context">
        <DocForm serviceId={service.id} submitLabel="Save note" />
      </SectionCard>
    </div>
  );
}
