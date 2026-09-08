"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

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

export default function Buildings() {
  const router = useRouter();
  const [state, setState] = useState<ConstructionState | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [destroyType, setDestroyType] = useState(0);
  const [destroyQuantity, setDestroyQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const fetchBuildings = async () => {
    try {
      setError('');
      const response = await fetch('/api/buildings');
      if (response.status === 401) return router.push('/');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
      const availableToDestroy = (data.types as BuildingType[])
        .filter(type => type.owned + type.inProgress > 0);
      setDestroyType(current => (
        availableToDestroy.some(type => type.id === current)
          ? current
          : availableToDestroy[0]?.id ?? 0
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Construction data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchBuildings(); }, [router]);

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

  const build = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validOrder) return;
    setBusy(true);
    setError('');
    setMessage('');
    setWarnings([]);
    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'build',
          orders: selectedOrders.map(order => ({ bID: order.type.id, quantity: order.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Construction started: ${data.message}.`);
      setWarnings(data.warnings ?? []);
      setQuantities({});
      await fetchBuildings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Construction could not be started.');
    } finally {
      setBusy(false);
    }
  };

  const destroy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!destroyType || !Number.isSafeInteger(destroyQuantity) || destroyQuantity <= 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    setWarnings([]);
    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'destroy', bID: destroyType, quantity: destroyQuantity }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setDestroyQuantity(0);
      await fetchBuildings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The buildings could not be destroyed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading Construction Site...</div>;
  if (!state) {
    return (
      <div className="dashboard-layout">
        <Sidebar active="/dashboard/buildings" />
        <main id="main-content" className="dashboard-content">
          <PageBanner image="/game/headers/header-buildings.webp" title="Construction" />
          <FeedbackNotice tone="error">{error || 'Construction data could not be loaded.'}</FeedbackNotice>
        </main>
      </div>
    );
  }

  const destructible = state.types.filter(type => type.owned + type.inProgress > 0);
  const selectedDestructible = destructible.find(type => type.id === destroyType);

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/buildings" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-buildings.webp"
          title="Construction"
          subtitle="Develop your acres with the structures of the original kingdom."
          right={<div className="networth-badge">{state.landUsed.toLocaleString()} / {state.acres.toLocaleString()} acres used</div>}
        />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {message && <FeedbackNotice tone="success">{message}</FeedbackNotice>}
        {warnings.map(warning => <FeedbackNotice key={warning} tone="warning">{warning}</FeedbackNotice>)}
        {state.vacation && <div className="stat-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #b8842d' }}>Construction is paused while your province is on vacation.</div>}

        <form onSubmit={build}>
          <div className="responsive-grid desktop-layout-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {state.types.map(type => (
              <section key={type.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', opacity: type.canBuild ? 1 : .68 }}>
                <img
                  src={type.image}
                  alt=""
                  className="building-img"
                  loading="lazy"
                  decoding="async"
                  onError={event => { event.currentTarget.style.display = 'none'; }}
                />
                <h3 style={{ margin: 0 }}>{type.className}</h3>
                <p style={{ color: '#adb5bd', margin: 0, minHeight: '4.5rem' }}>{type.description}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem', color: 'var(--parchment)' }}>
                  <span>Built: <strong>{type.owned.toLocaleString()}</strong></span>
                  <span>In progress: <strong>{type.inProgress.toLocaleString()}</strong></span>
                  <span>{type.costGold.toLocaleString()} gold</span>
                  <span>{type.costMetal.toLocaleString()} metal</span>
                  <span style={{ gridColumn: '1 / -1' }}>
                    {type.buildTicks} ticks
                    {type.buildTicks !== type.baseBuildTicks ? ` (base ${type.baseBuildTicks})` : ''}
                  </span>
                </div>
                {!type.canBuild && <p style={{ color: '#ffcf70', margin: 0 }}>{type.unmet.join(' · ')}</p>}
                <label style={{ marginTop: 'auto' }}>
                  Number to build
                  <input
                    className="game-input"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!type.canBuild || state.vacation}
                    value={quantities[type.id] || ''}
                    onChange={event => setQuantities(current => ({ ...current, [type.id]: Number(event.target.value) || 0 }))}
                    style={{ width: '100%', marginTop: '.35rem' }}
                  />
                </label>
              </section>
            ))}
          </div>

          <div className="mobile-list mobile-only">
            {state.types.map(type => (
              <details className="mobile-list-item" key={type.id}>
                <summary className="mobile-list-summary">
                  <img className="mobile-list-thumb" src={type.image} alt="" loading="lazy" decoding="async" />
                  <span className="mobile-list-summary-copy">
                    <strong>{type.className}</strong>
                    <span>{type.owned.toLocaleString()} built · {type.inProgress.toLocaleString()} underway</span>
                  </span>
                </summary>
                <div className="mobile-list-detail">
                  <p>{type.description}</p>
                  <div className="mobile-fact-grid">
                    <span className="mobile-fact"><small>Gold</small><strong>{type.costGold.toLocaleString()}</strong></span>
                    <span className="mobile-fact"><small>Metal</small><strong>{type.costMetal.toLocaleString()}</strong></span>
                    <span className="mobile-fact"><small>Build time</small><strong>{type.buildTicks} ticks</strong></span>
                    <span className="mobile-fact"><small>Available land</small><strong>{freeAcres.toLocaleString()}</strong></span>
                  </div>
                  {!type.canBuild && <p style={{ color: 'var(--warning)' }}>{type.unmet.join(' · ')}</p>}
                  <label>
                    Number to build
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
                </div>
              </details>
            ))}
          </div>

          <section className="stat-card table-card" style={{ marginTop: '1.5rem' }}>
            <h2>Order totals</h2>
            <div className="order-totals-grid">
              {[
                ['Gold', totalGold, state.gold, state.gold - totalGold],
                ['Metal', totalMetal, state.metal, state.metal - totalMetal],
                ['Acres', totalAcres, freeAcres, freeAcres - totalAcres],
              ].map(([label, cost, current, remaining]) => (
                <article className="order-total" key={label}>
                  <h3>{label}</h3>
                  <dl>
                    <div><dt>Order</dt><dd>{Number(cost).toLocaleString()}</dd></div>
                    <div><dt>Available</dt><dd>{Number(current).toLocaleString()}</dd></div>
                    <div><dt>Remaining</dt><dd>{Number(remaining).toLocaleString()}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <button type="submit" className="btn-primary mobile-sticky-action" disabled={busy || state.vacation || !validOrder}>
              {busy ? 'Ordering...' : 'Start building'}
            </button>
          </section>
        </form>

        <form className="stat-card" style={{ marginTop: '1.5rem' }} onSubmit={destroy}>
          <h2>Destroy buildings</h2>
          <p style={{ color: '#adb5bd' }}>Buildings still in progress are destroyed first. Resources are not refunded.</p>
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
            <button type="submit" className="btn-primary" disabled={busy || state.vacation || destructible.length === 0 || destroyQuantity <= 0} style={{ margin: 0 }}>
              Destroy building(s)
            </button>
          </div>
        </form>

        <section className="stat-card table-card" style={{ marginTop: '1.5rem' }}>
          <h2>Buildings in progress</h2>
          <table className="wide-table progress-table-desktop" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Building</th>
                {Array.from({ length: state.maxProgressTicks + 1 }, (_, tick) => <th key={tick}>{tick}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {state.types.filter(type => type.inProgress > 0).map(type => (
                <tr key={type.id}>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{type.className}</th>
                  {Array.from({ length: state.maxProgressTicks + 1 }, (_, tick) => (
                    <td key={tick}>{type.progress[tick] ? type.progress[tick].toLocaleString() : '\u00a0'}</td>
                  ))}
                  <td>{type.inProgress.toLocaleString()}</td>
                </tr>
              ))}
              {!state.types.some(type => type.inProgress > 0) && (
                <tr><td className="empty-table-cell" colSpan={state.maxProgressTicks + 3}>No buildings are currently under construction.</td></tr>
              )}
            </tbody>
          </table>
          <div className="progress-card-list">
            {state.types.filter(type => type.inProgress > 0).map(type => (
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
            {!state.types.some(type => type.inProgress > 0) && (
              <p className="empty-state">No buildings are currently under construction.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
