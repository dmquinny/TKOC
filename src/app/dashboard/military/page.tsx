"use client";

import { useState } from 'react';
import CatalogCard from '@/components/CatalogCard';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface MilitaryType {
  id: number;
  className: string;
  displayName: string | null;
  category: string | null;
  costGold: number;
  costMetal: number;
  costFood: number;
  attack: number;
  defense: number;
  trainTicks: number;
}

interface MilitaryData {
  types: MilitaryType[];
  units: Array<{ mID: number; num: number }>;
  training: Array<{ mID: number; name: string; num: number; ticksLeft: number }>;
  peasants: number;
}

const UNIT_IMAGE: Record<string, string> = {
  soldiers: 'recruits',
  offense: 'swordsmen',
  defense: 'pikemen',
  elite: 'knights',
  thieves: 'thieves',
  wizards: 'wizards',
};

const unitImage = (type: MilitaryType) => `/game/units/${UNIT_IMAGE[type.category ?? ''] ?? 'recruits'}.webp`;
const unitName = (type: MilitaryType) => type.displayName || type.className;

export default function Military() {
  const { data, error, loading, refresh } = useGameData<MilitaryData>('/api/military');
  const action = useGameAction();
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  if (!data) {
    return loading ? <PageSkeleton cards={6} /> : <Notices error={error || 'Military data could not be loaded.'} />;
  }

  const owned = (mID: number) => data.units.find(unit => unit.mID === mID)?.num ?? 0;

  const draft = async (type: MilitaryType) => {
    const quantity = quantities[type.id] ?? 0;
    if (quantity <= 0) return;
    await action.run(`draft-${type.id}`, () => apiPost<{ message: string }>('/api/military', { mID: type.id, quantity }), result => {
      setQuantities(current => ({ ...current, [type.id]: 0 }));
      void refresh();
      requestNotificationRefresh();
      return result.message || `${quantity.toLocaleString()} ${unitName(type)} sent to training.`;
    });
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-military.webp"
        title="Military Barracks"
        subtitle="Draft peasants into an army to crush your foes."
        right={<div className="networth-badge">Available Peasants: {data.peasants.toLocaleString()}</div>}
      />

      <Notices error={error || action.error} notice={action.notice} />

      {data.training.length > 0 && (
        <section className="game-panel" aria-labelledby="training-heading">
          <div className="game-panel-heading">
            <div>
              <p className="eyebrow">Barracks</p>
              <h2 id="training-heading">In Training</h2>
            </div>
            <span className="activity-status">{data.training.reduce((sum, row) => sum + row.num, 0).toLocaleString()} recruits</span>
          </div>
          <p className="text-muted text-small mt-0">Recruits arrive gradually and cannot be sent to war until they finish training.</p>
          <div className="training-list">
            {data.training.map(row => (
              <div key={row.mID}>
                <span>{row.num.toLocaleString()} × {row.name}</span>
                <strong>all ready in {row.ticksLeft} tick{row.ticksLeft === 1 ? '' : 's'}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="catalog-grid">
        {data.types.map(type => {
          const quantity = quantities[type.id] ?? 0;
          const busy = action.busy === `draft-${type.id}`;
          return (
            <CatalogCard
              key={type.id}
              image={unitImage(type)}
              imageAlt={unitName(type)}
              imageStyle="portrait"
              title={unitName(type)}
              meta={`ATK ${type.attack} · DEF ${type.defense}`}
              summary={`${owned(type.id).toLocaleString()} ready · ATK ${type.attack} · DEF ${type.defense}`}
              facts={[
                { label: 'Gold', value: type.costGold.toLocaleString() },
                { label: 'Metal', value: type.costMetal.toLocaleString() },
                { label: 'Food', value: type.costFood.toLocaleString() },
                { label: 'Training', value: `${type.trainTicks} ticks` },
              ]}
              description={`Costs 1 ${type.category === 'soldiers' ? 'peasant' : 'base soldier'} each in addition to resources.`}
            >
              <div className="catalog-owned">
                <span>Troops ready</span>
                <strong>{owned(type.id).toLocaleString()}</strong>
              </div>
              <div className="catalog-inline">
                <input
                  type="number"
                  min="0"
                  max={data.peasants}
                  value={quantity || ''}
                  placeholder="Quantity"
                  aria-label={`Number of ${unitName(type)} to draft`}
                  onChange={event => setQuantities(current => ({ ...current, [type.id]: parseInt(event.target.value, 10) || 0 }))}
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || action.busy !== null || quantity <= 0}
                  onClick={() => void draft(type)}
                >
                  {busy ? 'Drafting…' : 'Draft'}
                </button>
              </div>
            </CatalogCard>
          );
        })}
      </div>
    </>
  );
}
