"use client";

import { useMemo, useState } from 'react';
import RelationBadge from '@/components/RelationBadge';
import TargetSearch from '@/components/TargetSearch';
import {
  attackBlocker,
  formatRatio,
  inRange,
  sortTargetsByCloseness,
  TARGET_FILTERS,
  targetMatchesFilter,
  targetMatchesQuery,
  type TargetFilter,
  type TargetIntel,
} from '@/lib/targets';

type Props = {
  targets: TargetIntel[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  title?: string;
  /** Show expected land and attack blockers; only the War Room wants these. */
  attackIntel?: boolean;
  emptyText?: string;
};

function TargetOption({
  target,
  selected,
  attackIntel,
  onSelect,
}: {
  target: TargetIntel;
  selected: boolean;
  attackIntel: boolean;
  onSelect: () => void;
}) {
  const blocker = attackIntel ? attackBlocker(target) : null;
  const ratioTone = target.networthRatio > 1.45 ? 'is-strong' : target.networthRatio < 0.7 ? 'is-weak' : '';
  return (
    <button
      type="button"
      className="target-option"
      aria-pressed={selected}
      disabled={Boolean(blocker)}
      onClick={onSelect}
    >
      <span className="target-name">
        <strong>{target.provinceName}</strong>
        <RelationBadge relation={target.relation} />
      </span>
      <span className="target-line">
        {target.rulerName} · {target.race} · {target.kingdomName}
      </span>
      <span className="target-numbers">
        <span>NW <b>{target.networth.toLocaleString()}</b></span>
        <span className={`target-ratio ${ratioTone}`}>{formatRatio(target.networthRatio)} yours{inRange(target) ? ' · in range' : ''}</span>
        <span>Acres <b>{target.acres.toLocaleString()}</b></span>
        {attackIntel && target.relation !== 'self' && (
          <span>Land if won <b>{target.expectedLandPercent}%</b> (~{target.expectedAcresGained.toLocaleString()} acres)</span>
        )}
      </span>
      {blocker && <span className="target-blocker">{blocker}</span>}
    </button>
  );
}

export default function TargetPicker({
  targets,
  selectedId,
  onSelect,
  title = 'Choose a target',
  attackIntel = false,
  emptyText = 'No provinces match that search.',
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TargetFilter>('all');
  const [mobileOpen, setMobileOpen] = useState(false);

  const sorted = useMemo(() => sortTargetsByCloseness(targets), [targets]);
  const visible = useMemo(
    () => sorted.filter(target => targetMatchesFilter(target, filter) && targetMatchesQuery(target, query)).slice(0, 80),
    [filter, query, sorted],
  );
  const selected = targets.find(target => target.id === selectedId) ?? null;
  const relationCounts = useMemo(() => ({
    war: targets.filter(target => target.relation === 'war').length,
    kingdom: targets.filter(target => target.relation === 'kingdom').length,
    ally: targets.filter(target => target.relation === 'ally').length,
  }), [targets]);
  const filters = TARGET_FILTERS.filter(entry => (
    entry.id === 'all'
    || entry.id === 'range'
    || relationCounts[entry.id as keyof typeof relationCounts] > 0
  ));

  return (
    <section className="stat-card target-panel">
      <h2 className="desktop-target-heading">{title}</h2>
      <button type="button" className="mobile-target-toggle mobile-only" onClick={() => setMobileOpen(open => !open)}>
        <span><small>Target</small><strong>{selected?.provinceName ?? 'Choose a province'}</strong></span>
        <span>{mobileOpen ? 'Close' : selected ? 'Change' : 'Choose'}</span>
      </button>
      <div className={`target-picker-body${mobileOpen ? ' is-open' : ''}`}>
        <TargetSearch value={query} onChange={setQuery} />
        <div className="target-filters" role="group" aria-label="Filter targets">
          {filters.map(entry => (
            <button
              key={entry.id}
              type="button"
              className={filter === entry.id ? 'is-active' : ''}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <ul className="target-list">
          {visible.map(target => (
            <li key={target.id}>
              <TargetOption
                target={target}
                selected={target.id === selectedId}
                attackIntel={attackIntel}
                onSelect={() => {
                  onSelect(target.id);
                  setMobileOpen(false);
                }}
              />
            </li>
          ))}
          {!visible.length && <li><p className="empty-state">{emptyText}</p></li>}
        </ul>
      </div>
    </section>
  );
}
