export function StatCard({ label, value, accent = false, testId, sub }) {
  return (
    <div
      data-testid={testId}
      className={`rounded-lg border p-5 transition-colors duration-200 ${
        accent ? "border-gold/40 bg-gold/5" : "border-[#27272A] bg-[#09090B] hover:bg-[#18181B]"
      }`}
    >
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-gold" : "text-white"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function SectionCard({ title, children, action, testId }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-[#27272A] bg-[#09090B]">
      <div className="flex items-center justify-between border-b border-[#27272A] px-5 py-3.5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

export function EmptyRow({ text = "No records" }) {
  return <div className="px-4 py-8 text-center text-sm text-zinc-600">{text}</div>;
}
