export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="app-kicker mb-2 text-[11px] font-semibold uppercase tracking-[0.26em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="app-text-muted mt-4 max-w-2xl text-base leading-7">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
