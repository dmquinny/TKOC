"use client";

import { useState } from 'react';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface AidData {
  inKingdom: boolean;
  mates: Array<{ id: number; provinceName: string | null; rulerName: string | null }>;
  gold: number | null;
  food: number | null;
  metal: number | null;
  peasants: number | null;
}

const RESOURCES = ['food', 'metal', 'gold', 'peasants'] as const;
type Resource = typeof RESOURCES[number];

export default function Aid() {
  const { data: state, error, loading, refresh } = useGameData<AidData>('/api/aid');
  const action = useGameAction();
  const [toPID, setToPID] = useState('');
  const [amounts, setAmounts] = useState<Record<Resource, number>>({ gold: 0, food: 0, metal: 0, peasants: 0 });

  if (!state) {
    return loading ? <PageSkeleton cards={1} /> : <Notices error={error || 'The treasury could not be opened.'} />;
  }

  const send = async () => {
    await action.run('send', () => apiPost<{ message: string }>('/api/aid', { toPID: Number(toPID), resources: amounts }), result => {
      setAmounts({ gold: 0, food: 0, metal: 0, peasants: 0 });
      void refresh();
      return result.message;
    });
  };

  const holdings: Record<Resource, number> = {
    gold: state.gold ?? 0,
    food: state.food ?? 0,
    metal: state.metal ?? 0,
    peasants: state.peasants ?? 0,
  };
  const anyAmount = Object.values(amounts).some(value => value > 0);
  const overCommitted = RESOURCES.some(name => amounts[name] > holdings[name]);

  return (
    <>
      <PageBanner image="/game/headers/header-aid.webp" title="Send Aid" subtitle="Share your bounty with your kingdom." />

      <Notices error={error || action.error} notice={action.notice} />

      {!state.inKingdom ? (
        <section className="stat-card">
          <p className="empty-state">You must be in a kingdom to send aid. Kingdom membership is chosen when a province is founded.</p>
        </section>
      ) : (
        <section className="stat-card">
          <p className="text-muted mt-0">
            You hold {holdings.gold.toLocaleString()} gold · {holdings.food.toLocaleString()} food · {holdings.metal.toLocaleString()} metal · {holdings.peasants.toLocaleString()} peasants.
            Caravans lose a share in transit unless Marketplaces or a friendly race reduce the loss.
          </p>
          <div className="stack">
            <label className="game-field">
              <span>Recipient</span>
              <select value={toPID} onChange={event => setToPID(event.target.value)}>
                <option value="">Choose a kingdom-mate…</option>
                {state.mates.map(mate => <option key={mate.id} value={mate.id}>{mate.provinceName} ({mate.rulerName})</option>)}
              </select>
            </label>
            {RESOURCES.map(name => (
              <label className="game-field" key={name}>
                <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                <input
                  type="number"
                  min="0"
                  max={holdings[name]}
                  value={amounts[name] || ''}
                  onChange={event => setAmounts(current => ({ ...current, [name]: parseInt(event.target.value, 10) || 0 }))}
                />
                {amounts[name] > holdings[name] && <small className="text-danger">You only hold {holdings[name].toLocaleString()}.</small>}
              </label>
            ))}
            <button type="button" className="btn-primary" onClick={() => void send()} disabled={action.busy !== null || !toPID || !anyAmount || overCommitted}>
              {action.busy === 'send' ? 'Sending…' : 'Send aid'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
