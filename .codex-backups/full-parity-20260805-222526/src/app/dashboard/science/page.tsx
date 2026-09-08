"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import OnboardingTip from '@/components/OnboardingTip';

interface ScienceRow {
  scID: number;
  name: string;
  image: string;
  effect: string;
  category: string;
  description: string;
  level: number;
  maxLevel: number;
  costGold: number;
  costMetal: number;
  available: boolean;
  prerequisites: Array<{
    category: 'military' | 'infrastructure' | 'magic' | 'thievery';
    names: string[];
    met: boolean;
  }>;
  unlocks: string[];
  researching?: number | null; // ticks left if in progress
}

interface ActiveResearch {
  orderId: number;
  scID: number;
  name: string;
  image: string;
  ticksLeft: number;
  visibleInCatalog: boolean;
}

export default function Science() {
  const router = useRouter();
  const [sciences, setSciences] = useState<ScienceRow[]>([]);
  const [activeResearch, setActiveResearch] = useState<ActiveResearch[]>([]);
  const [gold, setGold] = useState(0);
  const [metal, setMetal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const fetchScience = async () => {
    try {
      const res = await fetch('/api/science');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSciences(data.sciences);
      setActiveResearch(data.activeResearch ?? []);
      setGold(data.gold);
      setMetal(data.metal);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScience(); }, [router]);

  const research = async (scID: number) => {
    setBusy(scID);
    setError('');
    try {
      const res = await fetch('/api/science', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchScience();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="loading-screen">Loading Library...</div>;
  const anyResearching = activeResearch.length > 0
    || sciences.some(science => science.researching != null);

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/science" />
      <main id="main-content" className="dashboard-content">
        <PageBanner 
          image="/game/headers/header-science.webp" 
          title="Science & Technology"
          subtitle="Research the sciences to strengthen your realm."
          right={<div className="networth-badge">Gold: {gold.toLocaleString()} · Metal: {metal.toLocaleString()}</div>}
        />
        <OnboardingTip
          id="science"
          title="Research is one project at a time"
          description="Requirements show knowledge you must already have. Gives shows the knowledge unlocked when the research completes."
          href="/dashboard/guide"
          linkLabel="Read the science guide"
        />

        {error && (
          <FeedbackNotice tone="error">
            {error}
          </FeedbackNotice>
        )}

        {/* Original game rule: only one science may be researched at a time, province-wide. */}
        {activeResearch.length === 0 && (() => { const active = sciences.find(x => x.researching != null); return active ? (
          <div className="stat-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--gold)' }}>
            Your wise men are researching <strong>{active.name}</strong> — {active.researching} tick{active.researching === 1 ? '' : 's'} remaining. You can only research one science at a time.
          </div>
        ) : null; })()}

        {activeResearch.map(active => (
          <section
            className="stat-card"
            key={active.orderId}
            style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--gold)', display: 'flex', alignItems: 'center', gap: '1rem' }}
          >
            <img
              src={active.image}
              alt=""
              aria-hidden="true"
              style={{ width: '72px', height: '72px', flex: '0 0 72px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--stone-border)' }}
            />
            <div>
              <strong style={{ display: 'block', color: 'var(--gold-bright)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                Research in progress: {active.name}
              </strong>
              <span>
                {active.ticksLeft} tick{active.ticksLeft === 1 ? '' : 's'} remaining. You can only research one science at a time.
              </span>
              {!active.visibleInCatalog && (
                <small style={{ display: 'block', marginTop: '0.35rem', color: 'var(--parchment-dim)' }}>
                  This existing research is outside your current science catalogue, but it will continue and complete normally.
                </small>
              )}
            </div>
          </section>
        ))}

        <div className="responsive-grid desktop-layout-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {sciences.map(s => {
            const maxed = s.level >= s.maxLevel;
            return (
              <div key={s.scID} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="card-media science-media" style={{ width: '100%', height: '140px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid var(--stone-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <img
                    src={s.image}
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <h3 className="card-heading-row" style={{ fontSize: '1.2rem', margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                  {s.name}
                  <span style={{ color: 'var(--gold)', textTransform: 'capitalize' }}>{maxed ? 'Known' : s.category}</span>
                </h3>
                <p style={{ color: '#adb5bd', fontSize: '0.9rem', margin: 0 }}>{s.description}</p>
                <div style={{ color: 'var(--gold-bright)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  <div>
                    <strong>Requires:</strong>{' '}
                    {s.prerequisites.length
                      ? s.prerequisites.map((requirement, index) => (
                        <React.Fragment key={requirement.category}>
                          {index > 0 && <span> · </span>}
                          <span style={{ color: requirement.met ? '#71dc71' : '#e0b95c' }}>
                            {requirement.names.join(' or ')} {requirement.met ? '✓' : '— missing'}
                          </span>
                        </React.Fragment>
                      ))
                      : <span style={{ color: '#71dc71' }}>None</span>}
                  </div>
                  <div>
                    <strong>Helps unlock:</strong>{' '}
                    <span style={{ color: 'var(--parchment-dim)' }}>
                      {s.unlocks.length ? s.unlocks.join(', ') : 'No further research'}
                    </span>
                  </div>
                </div>
                {s.researching != null ? (
                  <button className="btn-primary" style={{ marginTop: 'auto', padding: '0.6rem', opacity: 0.7 }} disabled>
                    Researching — {s.researching} tick{s.researching === 1 ? '' : 's'} left
                  </button>
                ) : anyResearching ? (
                  <button className="btn-primary" style={{ marginTop: 'auto', padding: '0.6rem', opacity: 0.45 }} disabled>
                    {maxed ? 'Fully Researched' : 'Busy — one research at a time'}
                  </button>
                ) : (
                  <button
                    onClick={() => research(s.scID)}
                    className="btn-primary"
                    style={{ marginTop: 'auto', padding: '0.6rem' }}
                    disabled={maxed || !s.available || busy === s.scID || gold < s.costGold || metal < s.costMetal}
                  >
                    {maxed
                      ? 'Knowledge Complete'
                      : !s.available
                        ? 'Requirements not met'
                        : busy === s.scID
                          ? 'Starting...'
                          : `Research (${s.costGold.toLocaleString()} gold, ${s.costMetal.toLocaleString()} metal)`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mobile-list mobile-only">
          {sciences.map(science => {
            const maxed = science.level >= science.maxLevel;
            const requirementsMet = science.prerequisites.every(requirement => requirement.met);
            return (
              <details className="mobile-list-item" key={science.scID}>
                <summary className="mobile-list-summary">
                  <img className="mobile-list-thumb" src={science.image} alt="" loading="lazy" decoding="async" />
                  <span className="mobile-list-summary-copy">
                    <strong>{science.name}</strong>
                    <span>
                      Level {science.level}/{science.maxLevel} · {science.researching != null ? `${science.researching} ticks left` : maxed ? 'Complete' : science.category}
                    </span>
                  </span>
                </summary>
                <div className="mobile-list-detail">
                  <p>{science.description}</p>
                  <div className="mobile-fact-grid">
                    <span className="mobile-fact"><small>Gold</small><strong>{science.costGold.toLocaleString()}</strong></span>
                    <span className="mobile-fact"><small>Metal</small><strong>{science.costMetal.toLocaleString()}</strong></span>
                    <span className="mobile-fact"><small>Requires</small><strong>{requirementsMet ? 'Ready' : 'Missing research'}</strong></span>
                    <span className="mobile-fact"><small>Unlocks</small><strong>{science.unlocks.length || '—'}</strong></span>
                  </div>
                  {science.prerequisites.length > 0 && (
                    <p style={{ color: 'var(--parchment-dim)', fontSize: '.86rem' }}>
                      {science.prerequisites.map(requirement => `${requirement.names.join(' or ')}${requirement.met ? ' ✓' : ' — missing'}`).join(' · ')}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-primary mobile-list-action"
                    disabled={maxed || anyResearching || !science.available || busy === science.scID || gold < science.costGold || metal < science.costMetal}
                    onClick={() => research(science.scID)}
                  >
                    {science.researching != null
                      ? `Researching — ${science.researching} ticks left`
                      : maxed
                        ? 'Knowledge Complete'
                        : anyResearching
                          ? 'Another research is underway'
                          : !science.available
                            ? 'Requirements not met'
                            : busy === science.scID
                              ? 'Starting…'
                              : 'Begin Research'}
                  </button>
                </div>
              </details>
            );
          })}
        </div>
      </main>
    </div>
  );
}
