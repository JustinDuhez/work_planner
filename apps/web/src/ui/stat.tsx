const VALUE_SIZE = { lg: 'text-3xl', md: 'text-xl' } as const;

export function Stat({
  label,
  value,
  unit,
  hint,
  size = 'lg',
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  size?: keyof typeof VALUE_SIZE;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`${VALUE_SIZE[size]} font-semibold tracking-tight tabular-nums text-zinc-900`}
        >
          {value}
        </span>
        {unit ? <span className="text-sm font-medium text-zinc-500">{unit}</span> : null}
      </p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
