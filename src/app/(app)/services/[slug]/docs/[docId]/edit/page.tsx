import { notFound } from "next/navigation";

import { DocForm } from "@/components/forms/doc-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function EditDocPage({
  params,
}: {
  params: Promise<{ slug: string; docId: string }>;
}) {
  const { slug, docId } = await params;
  const [service, doc] = await Promise.all([
    prisma.service.findUnique({ where: { slug } }),
    prisma.serviceDoc.findUnique({ where: { id: docId } }),
  ]);

  if (!service || !doc || doc.serviceId !== service.id) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Edit note"
        title={doc.title}
        description="Keep the markdown current so Scott and future agents inherit the right context without re-discovery."
      />
      <SectionCard title="Notes" eyebrow="Editing">
        <DocForm serviceId={service.id} submitLabel="Save note" values={doc} />
      </SectionCard>
    </div>
  );
}
