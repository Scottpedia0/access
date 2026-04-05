import { QuickServiceCaptureForm } from "@/components/forms/quick-service-capture-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export default function NewServicePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New service"
        title="Name it. Paste the key. Move on."
        description="This screen is for fast capture. Add one or more keys now, then worry about extra notes or links only if you want them."
      />
      <SectionCard title="Quick capture" eyebrow="Fast path">
        <QuickServiceCaptureForm />
      </SectionCard>
    </div>
  );
}
