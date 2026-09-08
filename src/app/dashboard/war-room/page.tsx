"use client";

import { useEffect, useMemo, useState } from 'react';
import BattleReportCard from '@/components/BattleReportCard';
import FeedbackNotice from '@/components/FeedbackNotice';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import RelationBadge from '@/components/RelationBadge';
import TargetPicker from '@/components/TargetPicker';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';
import { attackTypeName, type AttackId, type BattleReportView } from '@/lib/combat';
import { formatRatio, type TargetIntel } from '@/lib/targets';

interface WarRoomData {
  targets: TargetIntel[];
  units: Array<{
    mID: number;
    num: number;
    type: { className: string | null; displayName: string | null; category: string | null; attack: number; defense: number };
  }>;
  activeAttacks: Array<{
    id: number;
    defender: { provinceName: string | null };
    attackType: number;
    backtick: number;
    acres: number;
    gold: number;
    food: number;
    metal: number;
  }>;
  attackTypes: Array<{
    id: AttackId;
    name: string;
    description: string;
    backTicks: number;
    requirementLabel: string | null;
    available: boolean;
  }>;
  me: {
    id: number;
    provinceName: string;
    morale: number;
    effectiveMorale: number;
    canAttack: boolean;
    protection: number;
    vacation: boolean;
    acres: number;
    networth: number;
  };
  reports: BattleReportView[];
}

interface AttackResponse {
  message: string;
  report: BattleReportView;
}

export default function WarRoom() {
  const { data, error, loading, refresh } = useGameData<WarRoomData>('/api/combat/attack');
  const action = useGameAction();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [attackType, setAttackType] = useState<AttackId>(1);
  const [lastReport, setLastReport] = useState<BattleReportView | null>(null);

  const unseen = data?.reports.some(report => !report.seen) ?? false;
  useEffect(() => {
    if (!unseen) return;
    apiPost('/api/combat/reports', { action: 'seen' })
      .then(() => requestNotificationRefresh())
      .catch(() => {});
  }, [unseen]);

  const target = useMemo(
    () => data?.targets.find(entry => entry.id === selectedTarget) ?? null,
    [data?.targets, selectedTarget],
  );
  const totalTroops = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const rawAttack = data
    ? data.units.reduce((sum, unit) => sum + (quantities[unit.mID] ?? 0) * unit.type.attack, 0)
    : 0;

  if (!data) {
    return loading ? <PageSkeleton cards={4} /> : <Notices error={error || 'The War Room could not be loaded.'} />;
  }

  const readiness = data.me.vacation
    ? 'Your province is on vacation and cannot attack.'
    : data.me.protection > 0
      ? `You are under protection for ${data.me.protection} more ticks and cannot attack.`
      : data.me.effectiveMorale < 50
        ? `Your effective morale is ${data.me.effectiveMorale}. Armies need at least 50 to march.`
        : null;

  const launch = async () => {
    if (!selectedTarget) return;
    const troops = Object.fromEntries(Object.entries(quantities).filter(([, value]) => value > 0));
    await action.run('attack', () => apiPost<AttackResponse>('/api/combat/attack', { targetID: selectedTarget, troops, attackType }), result => {
      setLastReport(result.report);
      setQuantities({});
      setSelectedTarget(null);
      void refresh();
      requestNotificationRefresh();
      return result.message;
    });
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-war-room.webp"
        title="War Room"
        subtitle="Attacks resolve the moment you launch them. Survivors return with the spoils."
        right={<div className="networth-badge">Morale {data.me.morale} · Effective {data.me.effectiveMorale}</div>}
      />

      <Notices error={error || action.error} notice={action.notice} />
      {readiness && <FeedbackNotice tone="warning">{readiness}</FeedbackNotice>}

      {lastReport && (
        <section className="battle-result" aria-label="Latest battle result">
          <BattleReportCard report={lastReport} viewerPID={data.me.id} />
        </section>
      )}

      <div className="responsive-grid page-grid is-targets">
        <TargetPicker
          targets={data.targets}
          selectedId={selectedTarget}
          onSelect={setSelectedTarget}
          title="Reconnaissance"
          attackIntel
          emptyText="No attackable provinces match. Protected and vacationing provinces are hidden."
        />

        <section className="stat-card">
          <h2>Dispatch Army</h2>
          {!target ? (
            <p className="empty-state">Choose a target from the reconnaissance list. Closest matches in networth are listed first.</p>
          ) : (
            <div className="stack">
              <div className="deploy-target">
                <span className="row row-between">
                  <strong>{target.provinceName}</strong>
                  <RelationBadge relation={target.relation} />
                </span>
                <span className="text-muted text-small">
                  {target.rulerName} · {target.race} · {target.kingdomName}
                </span>
                <span className="deploy-summary">
                  <span>Networth <b>{formatRatio(target.networthRatio)}</b> yours</span>
                  <span>Land <b>{formatRatio(target.landRatio)}</b> yours</span>
                  <span>Standard win takes <b>{target.expectedLandPercent}%</b> (~{target.expectedAcresGained.toLocaleString()} acres on return)</span>
                </span>
              </div>

              <div className="unit-rows" role="group" aria-label="Troops to send">
                {data.units.map(unit => (
                  <div key={unit.mID} className="unit-row">
                    <div>
                      <strong>{unit.type.displayName || unit.type.className}</strong>
                      <small>Ready {unit.num.toLocaleString()} · ATK {unit.type.attack} · DEF {unit.type.defense}</small>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={unit.num}
                      value={quantities[unit.mID] || ''}
                      placeholder="Qty"
                      aria-label={`${unit.type.displayName || unit.type.className} to send`}
                      onChange={event => setQuantities(current => ({
                        ...current,
                        [unit.mID]: Math.min(unit.num, Math.max(0, parseInt(event.target.value, 10) || 0)),
                      }))}
                    />
                  </div>
                ))}
                {!data.units.length && <p className="empty-state">You have no combat units at home. Train some in the Barracks.</p>}
              </div>

              <div className="choice-list" role="radiogroup" aria-label="Attack type">
                {data.attackTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    role="radio"
                    aria-checked={attackType === type.id}
                    className="choice-card"
                    disabled={!type.available}
                    onClick={() => setAttackType(type.id)}
                  >
                    <strong>{type.name}</strong>
                    <small>{type.description} Army returns in about {type.backTicks} ticks.</small>
                    {!type.available && type.requirementLabel && <small className="text-warning">Requires {type.requirementLabel}.</small>}
                  </button>
                ))}
              </div>

              <div className="deploy-summary">
                <span>Sending <b>{totalTroops.toLocaleString()}</b> troops</span>
                <span>Raw attack <b>{rawAttack.toLocaleString()}</b> before morale, race, science, and buildings</span>
              </div>

              <button
                type="button"
                className="btn-primary mobile-sticky-action"
                disabled={action.busy !== null || totalTroops === 0 || !data.me.canAttack}
                onClick={() => void launch()}
              >
                {action.busy === 'attack' ? 'Marching…' : `Launch ${attackTypeName(attackType)} Attack`}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="stat-card mt-2">
        <h2>Armies in the Field</h2>
        {data.activeAttacks.length === 0 ? (
          <p className="empty-state">No armies are away from home.</p>
        ) : (
          <ul className="list-plain divided army-list">
            {data.activeAttacks.map(attack => (
              <li key={attack.id}>
                <strong>{attackTypeName(attack.attackType)}</strong> on {attack.defender.provinceName ?? 'an unknown province'} · returning in {attack.backtick} tick{attack.backtick === 1 ? '' : 's'}
                {attack.acres > 0 ? ` with ${attack.acres.toLocaleString()} acres` : ''}
                {attack.gold + attack.food + attack.metal > 0
                  ? ` carrying ${attack.gold.toLocaleString()} gold, ${attack.food.toLocaleString()} food, ${attack.metal.toLocaleString()} metal`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stat-card mt-2" aria-labelledby="battle-history-heading">
        <h2 id="battle-history-heading">Battle History</h2>
        {data.reports.length === 0 ? (
          <p className="empty-state">No battles have been fought yet.</p>
        ) : (
          <div className="battle-list">
            {data.reports.map(report => (
              <BattleReportCard key={report.id} report={report} viewerPID={data.me.id} compact />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
