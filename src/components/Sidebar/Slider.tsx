export function Slider({
  label,
  value,
  onChange,
  display,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  display: string;
  testId?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="text-white/50">{label}</span>
        <span className="font-mono text-[10px] text-white/80">{display}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(value * 1000)}
        onChange={(e) => onChange(Number(e.target.value) / 1000)}
        className="holo-range mt-0.5"
        style={{ ['--fill' as string]: `${pct}%` }}
        aria-label={label}
        data-testid={testId}
      />
    </label>
  );
}
