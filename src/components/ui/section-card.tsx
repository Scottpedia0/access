import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "app-panel rounded-[28px] p-6",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-[color:var(--border)] pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="app-kicker mb-2 text-[11px] font-semibold uppercase tracking-[0.22em]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {title}
          </h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
