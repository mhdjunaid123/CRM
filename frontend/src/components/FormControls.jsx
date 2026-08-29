export function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md bg-black border border-[#27272A] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-gold focus:outline-none transition-colors";

export function TextInput({ testId, ...props }) {
  return <input data-testid={testId} className={inputCls} {...props} />;
}

export function NumberInput({ testId, ...props }) {
  return <input data-testid={testId} type="number" step="0.01" className={inputCls} {...props} />;
}

export function DateInput({ testId, ...props }) {
  return <input data-testid={testId} type="date" className={`${inputCls} [color-scheme:dark]`} {...props} />;
}

export function TextArea({ testId, ...props }) {
  return <textarea data-testid={testId} rows={3} className={inputCls} {...props} />;
}

export function SelectInput({ testId, options, value, onChange, ...props }) {
  return (
    <select data-testid={testId} value={value} onChange={onChange} className={inputCls} {...props}>
      {options.map((o) => (
        <option key={o} value={o} className="bg-[#09090B]">{o}</option>
      ))}
    </select>
  );
}
