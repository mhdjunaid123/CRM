export function StatusBadge({ label, styleMap, className = "", testId }) {
  const cls = (styleMap && styleMap[label]) || "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls} ${className}`}
    >
      {label}
    </span>
  );
}
