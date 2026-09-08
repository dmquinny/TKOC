"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import OnboardingTip from '@/components/OnboardingTip';

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

export default function Explore() {
  const router = useRouter();
  const [state, setState] = useState<ExploreState | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchExplore = async () => {
    try {
      setError('');
      const res = await fetch('/api/explore');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState({
        acres: Number(data.acres) || 0,
        gold: Number(data.gold) || 0,
        soldierName: String(data.soldierName || 'Recruits'),
        soldiers: Number(data.soldiers) || 0,
        costPerSoldier: Number(data.costPerSoldier) || 0,
        landPerSoldier: Number(data.landPerSoldier) || 0,
        soldiersPerAcre: Number(data.soldiersPerAcre) || 0,
        recommendedSoldiers: Number(data.recommendedSoldiers) || 0,
        ticks: Number(data.ticks) || 0,
        incoming: Number(data.incoming) || 0,
        progress: Array.isArray(data.progress)
          ? data.progress.map((value: unknown) => Number(value) || 0)
          : [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Exploration data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchExplore(); }, [router]);

  const explore = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    setWarning('');
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soldiers: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      setWarning(data.warning || '');
      setAmount(0);
      await fetchExplore();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The expedition could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading-screen">Scouting the Frontier...</div>;

  if (!state) {
    return (
      <div className="dashboard-layout">
        <Sidebar active="/dashboard/explore" />
        <main id="main-content" className="dashboard-content">
          <PageBanner image="/game/headers/header-explore.webp" title="Exploring" subtitle="Send soldiers to settle new land." />
          <section>
            <FeedbackNotice tone="error">{error || 'Exploration data could not be loaded.'}</FeedbackNotice>
            <button type="button" className="btn-primary" onClick={() => { setLoading(true); void fetchExplore(); }}>Try Again</button>
          </section>
        </main>
      </div>
    );
  }

  const totalCost = amount > 0 ? amount * state.costPerSoldier : 0;
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const affordable = validAmount && totalCost <= state.gold && amount <= state.soldiers;
  const estimatedLand = Math.floor(Math.min(amount * state.landPerSoldier, state.acres * 0.5));
  const singularSoldier = state.soldierName.endsWith('s')
    ? state.soldierName.slice(0, -1)
    : state.soldierName;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/explore" />
      <main id="main-content" className="dashboard-content">
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

        {error && (
          <FeedbackNotice tone="error">
            {error}
          </FeedbackNotice>
        )}
        {message && (
          <FeedbackNotice tone="success">
            {message}
          </FeedbackNotice>
        )}
        {warning && <FeedbackNotice tone="warning">{warning}</FeedbackNotice>}

        <section className="stat-card" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#adb5bd', lineHeight: 1.7, maxWidth: '850px', margin: '0 auto' }}>
            Every {singularSoldier} can explore about{' '}
            <strong style={{ color: 'var(--gold-bright)' }}>{state.landPerSoldier.toFixed(2)} acres</strong>.
            You need about <strong style={{ color: 'var(--gold-bright)' }}>{state.soldiersPerAcre}</strong>{' '}
            {state.soldierName} per acre. Those you send will settle in the new lands and leave your army.
          </p>
          <p style={{ color: '#adb5bd', lineHeight: 1.7, marginBottom: 0 }}>
            A single expedition can find roughly 50% of your current acreage. Sending more than{' '}
            <strong style={{ color: 'var(--gold-bright)' }}>{state.recommendedSoldiers.toLocaleString()} {state.soldierName}</strong>{' '}
            will not find additional land.
          </p>
          <p style={{ color: 'var(--parchment-dim)', lineHeight: 1.7, marginBottom: 0 }}>
            Expedition rates use your settled land plus land already being explored.
            {state.incoming > 0 && (
              <> Your current rates include <strong style={{ color: 'var(--gold-bright)' }}>{state.incoming.toLocaleString()} incoming acres</strong>.</>
            )}
          </p>
        </section>

        <form className="stat-card table-card" style={{ marginBottom: '2rem' }} onSubmit={(event) => { event.preventDefault(); void explore(); }}>
          <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
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
                    className="game-input"
                    type="number"
                    min="1"
                    step="1"
                    value={amount || ''}
                    onChange={(event) => setAmount(Number(event.target.value) || 0)}
                    style={{ width: '110px' }}
                  />
                </td>
                <td data-label="Cost each">{state.costPerSoldier.toLocaleString()} gold</td>
                <td data-label="Total cost">{totalCost.toLocaleString()} gold</td>
                <td data-label="Estimated acres">about {estimatedLand.toLocaleString()}*</td>
              </tr>
            </tbody>
          </table>
          <p className="explore-variance-note">* The final result varies by ±5%, as in the original game.</p>
          <button type="submit" className="btn-primary explore-submit" disabled={busy || !affordable}>
            {busy ? 'Exploring...' : 'Explore Land'}
          </button>
        </form>

        <section className="stat-card table-card">
          <h2>Land currently being explored</h2>
          <table className="wide-table progress-table-desktop" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Days</th>
                {Array.from({ length: state.ticks }, (_, index) => <th key={index}>{index + 1}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>Acres under exploring</th>
                {Array.from({ length: state.ticks }, (_, index) => (
                  <td key={index}>{state.progress[index] ? state.progress[index].toLocaleString() : '\u00a0'}</td>
                ))}
                <td>{state.incoming ? state.incoming.toLocaleString() : '\u00a0'}</td>
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
                      <span>{index + 1} {index === 0 ? 'day' : 'days'}</span>
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
      </main>
    </div>
  );
}
