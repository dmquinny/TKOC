"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

const EFFECT_LABEL: Record<string, string> = {
  income: 'Income',
  offense: 'Offense',
  defense: 'Defense',
  magic: 'Magic',
  magicProtection: 'Magic Protection',
  morale: 'Morale',
  thieveryOffense: 'Thievery Offense',
  thieveryDefense: 'Thievery Defense',
  thieveryLoss: 'Thief Losses',
  none: 'No combat bonus',
};

const ADVISOR_IMAGE: Record<string, string> = {
  'Lady Brienne': 'brienne',
  'Lady Alustriel': 'alustriel',
  'Raistlin Jamere': 'raistlin',
  'Ungrim Ironfist': 'ungrim',
  'Arrk Maneater': 'arrk',
  Goliath: 'goliath',
  'Melangult the Shadow': 'shadow',
};

export default function Council() {
  const router = useRouter();
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [councilId, setCouncilId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/council');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdvisors(data.advisors);
      setCouncilId(data.councilId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [router]);

  const appoint = async (advisorId: number) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/council', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advisorId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading-screen">Summoning the Council…</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/council" />
      <main id="main-content" className="dashboard-content">
        <PageBanner image="/game/headers/header-council.webp" title="The Council" subtitle="Appoint one advisor to guide your realm." />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

        <div className="responsive-grid desktop-layout-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {advisors.map(a => {
            const active = councilId === a.id;
            return (
              <div key={a.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderColor: active ? 'var(--gold)' : undefined }}>
                <div className="card-media advisor-media" style={{ width: '100%', height: '180px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid var(--stone-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ADVISOR_IMAGE[a.name] && <img src={`/game/council/${ADVISOR_IMAGE[a.name]}.webp`} alt={a.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />}
                </div>
                <h3 style={{ margin: 0 }}>{a.name}</h3>
                <p style={{ color: 'var(--gold)', margin: 0, fontFamily: 'var(--font-display)' }}>{a.title}</p>
                <p style={{ color: '#adb5bd', margin: 0, fontSize: '0.9rem' }}>{a.description}</p>
                <p style={{ color: 'var(--gold-bright)', margin: 0 }}>
                  {a.bonus > 0 ? '+' : ''}{a.bonus}% {EFFECT_LABEL[a.effect] ?? a.effect}
                  {a.effect2 ? <><br />{a.bonus2 > 0 ? '+' : ''}{a.bonus2}% {EFFECT_LABEL[a.effect2] ?? a.effect2}</> : null}
                </p>
                <p style={{ margin: 0 }}>Hire: {a.costGold.toLocaleString()} gold</p>
                <button
                  className="btn-primary"
                  style={{ marginTop: 'auto', padding: '0.6rem' }}
                  disabled={busy || active}
                  onClick={() => appoint(a.id)}
                >
                  {active ? 'Appointed' : 'Appoint'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mobile-list mobile-only">
          {advisors.map(advisor => {
            const active = councilId === advisor.id;
            return (
              <details className="mobile-list-item" key={advisor.id}>
                <summary className="mobile-list-summary">
                  {ADVISOR_IMAGE[advisor.name] ? (
                    <img className="mobile-list-thumb" src={`/game/council/${ADVISOR_IMAGE[advisor.name]}.webp`} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="mobile-list-thumb" aria-hidden="true" />
                  )}
                  <span className="mobile-list-summary-copy">
                    <strong>{advisor.name}</strong>
                    <span>{advisor.title}{active ? ' · Appointed' : ''}</span>
                  </span>
                </summary>
                <div className="mobile-list-detail">
                  <p>{advisor.description}</p>
                  <div className="mobile-fact-grid">
                    <span className="mobile-fact">
                      <small>Primary bonus</small>
                      <strong>{advisor.bonus > 0 ? '+' : ''}{advisor.bonus}% {EFFECT_LABEL[advisor.effect] ?? advisor.effect}</strong>
                    </span>
                    <span className="mobile-fact">
                      <small>Hiring cost</small>
                      <strong>{advisor.costGold.toLocaleString()} gold</strong>
                    </span>
                  </div>
                  {advisor.effect2 && (
                    <p style={{ color: 'var(--gold-bright)' }}>
                      {advisor.bonus2 > 0 ? '+' : ''}{advisor.bonus2}% {EFFECT_LABEL[advisor.effect2] ?? advisor.effect2}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-primary mobile-list-action"
                    disabled={busy || active}
                    onClick={() => appoint(advisor.id)}
                  >
                    {active ? 'Currently Appointed' : 'Appoint Advisor'}
                  </button>
                </div>
              </details>
            );
          })}
        </div>

        {councilId !== 0 && (
          <button className="btn-primary" style={{ marginTop: '1.5rem', background: 'linear-gradient(180deg,#6b6353,#463f30)', borderColor: '#6b6353' }} disabled={busy} onClick={() => appoint(0)}>
            Dismiss Advisor
          </button>
        )}
      </main>
    </div>
  );
}
