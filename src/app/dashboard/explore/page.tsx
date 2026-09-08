"use client";

import { useState } from 'react';
import Notices from '@/components/Notices';
import OnboardingTip from '@/components/OnboardingTip';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface ExploreState {
  acres: number;
  gold: number;
  soldierName: string;
  soldiers: number;
  costPerSoldier: number;
  landPerSoldier: number;
  soldiersPerAcre: number;
  recommendedSoldiers: number;
  ticks: number;
  incoming: number;
  progress: number[];
}

interface ExploreResponse {
  message: string;
  warning?: string;
}

export default function Explore() {
  const { data: state, error, loading, refresh } = useGameData<ExploreState>('/api/explore');
  const action = useGameAction();
  const [amount, setAmount] = useState(0);
  const [warning, setWarning] = useState('');

  if (!state) {
    return loading ? <PageSkeleton cards={3} /> : <Notices error={error || 'Exploration data could not be loaded.'} />;
  }

  const totalCost = amount > 0 ? amount * state.costPerSoldier : 0;
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const affordable = validAmount && totalCost <= state.gold && amount <= state.soldiers;
  const estimatedLand = Math.floor(Math.min(amount * state.landPerSoldier, state.acres * 0.5));
  const singularSoldier = state.soldierName.endsWith('s') ? state.soldierName.slice(0, -1) : state.soldierName;

  const explore = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await action.run('explore', () => apiPost<ExploreResponse>('/api/explore', { soldiers: amount }), sent => {
      setAmount(0);
      void refresh();
      requestNotificationRefresh();
      return sent.message;
    });
    setWarning(result?.warning ?? '');
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-explore.webp"
        title="Exploring"
        subtitle={`Send your ${state.soldierName} to settle new land.`}
        right={<div className="networth-badge">Acres: {state.acres.toLocaleString()}</div>}
      />
      <OnboardingTip
        id="explore"
        title="New land arrives after the expedition"
        description="Soldiers are committed now, but population and recruit calculations only use the acres after exploration completes."
        href="/dashboard/guide"
        linkLabel="Read the exploration guide"
      />

      <Notices error={error || action.error} notice={action.notice} warnings={warning ? [warning] : []} />

      <section className="stat-card explore-intro text-center mb-2">
        <p>
          Every {singularSoldier} can explore about <strong className="text-gold">{state.landPerSoldier.toFixed(2)} acres</strong>.
          You need about <strong className="text-gold">{state.soldiersPerAcre}</strong> {state.soldierName} per acre.
          Those you send will settle in the new lands and leave your army.
        </p>
        <p>
          A single expedition can find roughly 50% of your current acreage. Sending more than{' '}
          <strong className="text-gold">{state.recommendedSoldiers.toLocaleString()} {state.soldierName}</strong> will not find additional land.
        </p>
        <p className="text-faint">
          Expedition rates use your settled land plus land already being explored.
          {state.incoming > 0 && <> Your current rates include <strong className="text-gold">{state.incoming.toLocaleString()} incoming acres</strong>.</>}
        </p>
      </section>

      <form className="stat-card table-card mb-2" onSubmit={explore}>
        <table className="wide-table mobile-data-table text-center">
          <thead>
            <tr>
              <th>{state.soldierName} at home</th>
              <th>{state.soldierName} to send</th>
              <th>Cost each</th>
              <th>Total cost</th>
              <th>Estimated acres</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label={`${state.soldierName} at home`}>{state.soldiers.toLocaleString()}</td>
              <td data-label={`${state.soldierName} to send`}>
                <input
                  aria-label={`${state.soldierName} to send`}
                  className="game-input explore-input"
                  type="number"
                  min="1"
                  step="1"
                  value={amount || ''}
                  onChange={event => setAmount(Number(event.target.value) || 0)}
                />
              </td>
              <td data-label="Cost each">{state.costPerSoldier.toLocaleString()} gold</td>
              <td data-label="Total cost" className={totalCost > state.gold ? 'text-danger' : ''}>{totalCost.toLocaleString()} gold</td>
              <td data-label="Estimated acres">about {estimatedLand.toLocaleString()}*</td>
            </tr>
          </tbody>
        </table>
        <p className="explore-variance-note">* The final result varies by ±5%, as in the original game.</p>
        <button type="submit" className="btn-primary explore-submit" disabled={action.busy !== null || !affordable}>
          {action.busy === 'explore' ? 'Exploring…' : 'Explore Land'}
        </button>
      </form>

      <section className="stat-card table-card">
        <h2>Land currently being explored</h2>
        <table className="wide-table progress-table-desktop text-center">
          <thead>
            <tr>
              <th className="text-left">Days</th>
              {Array.from({ length: state.ticks }, (_, index) => <th key={index}>{index + 1}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="text-left">Acres under exploring</th>
              {Array.from({ length: state.ticks }, (_, index) => (
                <td key={index}>{state.progress[index] ? state.progress[index].toLocaleString() : ' '}</td>
              ))}
              <td>{state.incoming ? state.incoming.toLocaleString() : ' '}</td>
            </tr>
          </tbody>
        </table>
        <div className="progress-card-list">
          <article className="progress-card">
            <div className="progress-card-heading">
              <h3>Incoming acres</h3>
              <span>{state.incoming.toLocaleString()} total</span>
            </div>
            {state.incoming > 0 ? (
              <div className="progress-tick-grid">
                {state.progress.map((quantity, index) => quantity > 0 && (
                  <div className="progress-tick" key={index}>
                    <span>{index + 1} {index === 0 ? 'tick' : 'ticks'}</span>
                    <strong>{quantity.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No land is currently being explored.</p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
