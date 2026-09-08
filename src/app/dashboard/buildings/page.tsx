"use client";

import { useEffect, useMemo, useState } from 'react';
import CatalogCard from '@/components/CatalogCard';
import FeedbackNotice from '@/components/FeedbackNotice';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface BuildingType {
  id: number;
  className: string;
  costGold: number;
  costMetal: number;
  buildTicks: number;
  baseBuildTicks: number;
  description: string;
  image: string;
  owned: number;
  inProgress: number;
  progress: number[];
  canBuild: boolean;
  unmet: string[];
}

interface ConstructionState {
  types: BuildingType[];
  acres: number;
  landUsed: number;
  gold: number;
  metal: number;
  race: string;
  season: string;
  vacation: boolean;
  maxProgressTicks: number;
}

interface BuildResponse {
  message: string;
  warnings?: string[];
}

export default function Buildings() {
  const { data: state, error, loading, refresh } = useGameData<ConstructionState>('/api/buildings');
  const action = useGameAction();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [destroyType, setDestroyType] = useState(0);
  const [destroyQuantity, setDestroyQuantity] = useState(0);

  const destructible = useMemo(
    () => state?.types.filter(type => type.owned + type.inProgress > 0) ?? [],
    [state?.types],
  );
  useEffect(() => {
    setDestroyType(current => (destructible.some(type => type.id === current) ? current : destructible[0]?.id ?? 0));
  }, [destructible]);

  const selectedOrders = useMemo(() => {
    if (!state) return [];
    return state.types
      .map(type => ({ type, quantity: quantities[type.id] ?? 0 }))
      .filter(order => order.quantity > 0);
  }, [quantities, state]);
  const totalGold = selectedOrders.reduce((sum, order) => sum + order.type.costGold * order.quantity, 0);
  const totalMetal = selectedOrders.reduce((sum, order) => sum + order.type.costMetal * order.quantity, 0);
  const totalAcres = selectedOrders.reduce((sum, order) => sum + order.quantity, 0);
  const freeAcres = Math.max(0, (state?.acres ?? 0) - (state?.landUsed ?? 0));
  const validOrder = selectedOrders.length > 0
    && selectedOrders.every(order => Number.isSafeInteger(order.quantity) && order.type.canBuild)
    && totalGold <= (state?.gold ?? 0)
    && totalMetal <= (state?.metal ?? 0)
    && totalAcres <= freeAcres;

  if (!state) {
    return loading ? <PageSkeleton cards={6} /> : <Notices error={error || 'Construction data could not be loaded.'} />;
  }

  const build = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validOrder) return;
    await action.run('build', () => apiPost<BuildResponse>('/api/buildings', {
      action: 'build',
      orders: selectedOrders.map(order => ({ bID: order.type.id, quantity: order.quantity })),
    }), result => {
      setQuantities({});
      void refresh();
      requestNotificationRefresh();
      return `Construction started: ${result.message}.`;
    });
  };

  const destroy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!destroyType || !Number.isSafeInteger(destroyQuantity) || destroyQuantity <= 0) return;
    await action.run('destroy', () => apiPost<{ message: string }>('/api/buildings', { action: 'destroy', bID: destroyType, quantity: destroyQuantity }), result => {
      setDestroyQuantity(0);
      void refresh();
      return result.message;
    });
  };

  const selectedDestructible = destructible.find(type => type.id === destroyType);
  const inProgress = state.types.filter(type => type.inProgress > 0);

  return (
    <>
      <PageBanner
        image="/game/headers/header-buildings.webp"
        title="Construction"
        subtitle="Develop your acres with the structures of the original kingdom."
        right={<div className="networth-badge">{state.landUsed.toLocaleString()} / {state.acres.toLocaleString()} acres used</div>}
      />

      <Notices error={error || action.error} notice={action.notice} warnings={action.warnings} />
      {state.vacation && <FeedbackNotice tone="info">Construction is paused while your province is on vacation.</FeedbackNotice>}

      <form onSubmit={build}>
        <div className="catalog-grid">
          {state.types.map(type => (
            <CatalogCard
              key={type.id}
              image={type.image}
              title={type.className}
              meta={`${type.buildTicks} ticks`}
              summary={`${type.owned.toLocaleString()} built · ${type.inProgress.toLocaleString()} underway`}
              description={type.description}
              muted={!type.canBuild}
              facts={[
                { label: 'Gold', value: type.costGold.toLocaleString() },
                { label: 'Metal', value: type.costMetal.toLocaleString() },
                { label: 'Build time', value: `${type.buildTicks} ticks${type.buildTicks !== type.baseBuildTicks ? ` (base ${type.baseBuildTicks})` : ''}` },
                { label: 'Built / underway', value: `${type.owned.toLocaleString()} / ${type.inProgress.toLocaleString()}` },
              ]}
              warning={type.canBuild ? undefined : type.unmet.join(' · ')}
            >
              <label className="game-field">
                <span>Number to build</span>
                <input
                  className="game-input"
                  type="number"
                  min="0"
                  step="1"
                  disabled={!type.canBuild || state.vacation}
                  value={quantities[type.id] || ''}
                  onChange={event => setQuantities(current => ({ ...current, [type.id]: Number(event.target.value) || 0 }))}
                />
              </label>
            </CatalogCard>
          ))}
        </div>

        <section className="stat-card table-card mt-2">
          <h2>Order totals</h2>
          <div className="order-totals-grid">
            {([
              ['Gold', totalGold, state.gold, state.gold - totalGold],
              ['Metal', totalMetal, state.metal, state.metal - totalMetal],
              ['Acres', totalAcres, freeAcres, freeAcres - totalAcres],
            ] as Array<[string, number, number, number]>).map(([label, cost, current, remaining]) => (
              <article className="order-total" key={label}>
                <h3>{label}</h3>
                <dl>
                  <div><dt>Order</dt><dd>{cost.toLocaleString()}</dd></div>
                  <div><dt>Available</dt><dd>{current.toLocaleString()}</dd></div>
                  <div><dt>Remaining</dt><dd className={remaining < 0 ? 'text-danger' : ''}>{remaining.toLocaleString()}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <button type="submit" className="btn-primary mobile-sticky-action" disabled={action.busy !== null || state.vacation || !validOrder}>
            {action.busy === 'build' ? 'Ordering…' : 'Start building'}
          </button>
        </section>
      </form>

      <form className="stat-card mt-2" onSubmit={destroy}>
        <h2>Destroy buildings</h2>
        <p className="text-muted mt-0">Buildings still in progress are destroyed first. Resources are not refunded.</p>
        <div className="mobile-form-row building-destroy-row">
          <label className="building-destroy-field building-destroy-quantity">
            <span>Number</span>
            <input
              className="game-input"
              type="number"
              min="1"
              max={selectedDestructible ? selectedDestructible.owned + selectedDestructible.inProgress : undefined}
              step="1"
              value={destroyQuantity || ''}
              disabled={!selectedDestructible}
              onChange={event => setDestroyQuantity(Number(event.target.value) || 0)}
            />
          </label>
          <label className="building-destroy-field building-destroy-building">
            <span>Building</span>
            <select
              className="game-input building-destroy-select"
              value={destroyType}
              disabled={!destructible.length}
              onChange={event => {
                setDestroyType(Number(event.target.value));
                setDestroyQuantity(0);
              }}
            >
              {!destructible.length && <option value={0}>No buildings available</option>}
              {destructible.map(type => (
                <option key={type.id} value={type.id}>
                  {type.className} — {(type.owned + type.inProgress).toLocaleString()} available
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-block" disabled={action.busy !== null || state.vacation || destructible.length === 0 || destroyQuantity <= 0}>
            {action.busy === 'destroy' ? 'Destroying…' : 'Destroy building(s)'}
          </button>
        </div>
      </form>

      <section className="stat-card table-card mt-2">
        <h2>Buildings in progress</h2>
        <table className="wide-table progress-table-desktop">
          <thead>
            <tr>
              <th className="text-left">Building</th>
              {Array.from({ length: state.maxProgressTicks + 1 }, (_, tick) => <th key={tick}>{tick}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.map(type => (
              <tr key={type.id}>
                <th className="text-left">{type.className}</th>
                {Array.from({ length: state.maxProgressTicks + 1 }, (_, tick) => (
                  <td key={tick}>{type.progress[tick] ? type.progress[tick].toLocaleString() : ' '}</td>
                ))}
                <td>{type.inProgress.toLocaleString()}</td>
              </tr>
            ))}
            {!inProgress.length && (
              <tr><td className="empty-table-cell" colSpan={state.maxProgressTicks + 3}>No buildings are currently under construction.</td></tr>
            )}
          </tbody>
        </table>
        <div className="progress-card-list">
          {inProgress.map(type => (
            <article className="progress-card" key={type.id}>
              <div className="progress-card-heading">
                <h3>{type.className}</h3>
                <span>{type.inProgress.toLocaleString()} total</span>
              </div>
              <div className="progress-tick-grid">
                {type.progress.map((quantity, tick) => quantity > 0 && (
                  <div className="progress-tick" key={tick}>
                    <span>{tick === 0 ? 'Next tick' : `${tick} ${tick === 1 ? 'tick' : 'ticks'}`}</span>
                    <strong>{quantity.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!inProgress.length && <p className="empty-state">No buildings are currently under construction.</p>}
        </div>
      </section>
    </>
  );
}
