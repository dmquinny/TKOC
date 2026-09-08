type Props = {
  value: number | null;
  suffix?: string;
  unknownLabel?: string;
};

/** Signed per-tick change with colour, or a muted note when unknown. */
export default function DeltaValue({ value, suffix = '/ tick', unknownLabel = 'awaiting first tick' }: Props) {
  if (value === null) return <span className="delta is-unknown">{unknownLabel}</span>;
  const tone = value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-flat';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <span className={`delta ${tone}`}>
      {sign}{Math.abs(value).toLocaleString()}{suffix ? ` ${suffix}` : ''}
    </span>
  );
}
