import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "app-badge-neutral",
  accent: "app-badge-accent",
  success: "app-badge-success",
  warning: "app-badge-warning",
  danger: "app-badge-danger",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <span
      className={cn(
        "app-badge inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
