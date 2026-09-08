import type { LucideIcon } from 'lucide-react';
import DeltaValue from '@/components/DeltaValue';

export type ResourceTone = 'gold' | 'food' | 'metal' | 'peasants' | 'land' | 'mana' | 'influence' | 'networth';

type Props = {
  tone: ResourceTone;
  icon: LucideIcon;
  label: string;
  value: number;
  /** Per-tick change; undefined hides the row, null shows "awaiting first tick". */
  delta?: number | null;
  deltaSuffix?: string;
  hint?: string;
  warning?: boolean;
};

export default function ResourceCard({ tone, icon: Icon, label, value, delta, deltaSuffix, hint, warning = false }: Props) {
  return (
    <div className={`stat-card resource-card resource-${tone}${warning ? ' is-warning' : ''}`}>
      <div className="stat-card-head">
        <Icon className="resource-icon" size={20} aria-hidden="true" />
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-value">{value.toLocaleString()}</span>
      {delta !== undefined && <DeltaValue value={delta} suffix={deltaSuffix} />}
      {hint && <small className="resource-hint">{hint}</small>}
    </div>
  );
}
