import { ConsumerForm } from "@/components/forms/consumer-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { prisma } from "@/lib/prisma";

export default async function NewConsumerPage() {
  const [services, secrets] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New agent or tool"
        title="Set up agent or tool access"
        description="Create the one-time token for a trusted agent or tool, then let it retrieve only the keys and notes you approved."
      />
      <SectionCard title="Access details" eyebrow="Machine auth">
        <ConsumerForm
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
