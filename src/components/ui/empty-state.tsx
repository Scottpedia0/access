export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-panel-subtle rounded-[24px] border-dashed p-8 text-center">
      <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{title}</h3>
      <p className="app-text-muted mx-auto mt-3 max-w-xl text-sm leading-7">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
