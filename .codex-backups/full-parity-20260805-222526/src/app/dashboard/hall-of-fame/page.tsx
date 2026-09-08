"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

export default function HallOfFame() {
  const router = useRouter();
  const [state, setState] = useState<any>(null);
  const [ages, setAges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/hall-of-fame');
        if (res.status === 401) return router.push('/');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setState(data.state);
        setAges(data.ages || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) return <div className="loading-screen">Consulting the Chronicles…</div>;

  const apocalypse = state?.phase === 'Apocalypse';

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/hall-of-fame" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-hall-of-fame.webp"
          title="Hall of Fame"
          subtitle="The greatest rulers of past ages."
          right={<div className="networth-badge">Age {state?.age ?? 1} · {state?.phase ?? 'Running'}</div>}
        />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}

        {apocalypse && (
          <div style={{ color: '#ff7a7a', marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ff7a7a', borderRadius: '4px', backgroundColor: 'rgba(255,122,122,0.08)', fontFamily: 'var(--font-display)' }}>
            The Apocalypse is upon the world — this age is ending. Make your mark before it all turns to dust.
          </div>
        )}

        {ages.length === 0 ? (
          <section className="stat-card">
            <p className="empty-state">No ages have ended yet. The champions of the current age (Age {state?.age ?? 1}) will be enshrined here when it concludes.</p>
          </section>
        ) : (
          ages.map(a => (
            <section key={a.age} className="stat-card table-card" style={{ marginBottom: '2rem' }}>
              <h2>Age {a.age}</h2>
              <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--gold)', borderBottom: '1px solid var(--stone-border)' }}>
                    <th style={{ padding: '0.5rem' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>Province</th>
                    <th style={{ padding: '0.5rem' }}>Ruler</th>
                    <th style={{ padding: '0.5rem' }}>Kingdom</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Networth</th>
                  </tr>
                </thead>
                <tbody>
                  {a.entries.map((e: any) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #2a2419', background: e.rank === 1 ? 'rgba(200,149,47,0.1)' : 'transparent' }}>
                      <td data-label="Rank" style={{ padding: '0.5rem', color: e.rank === 1 ? 'var(--gold-bright)' : 'inherit' }}>{e.rank === 1 ? '♛ 1' : e.rank}</td>
                      <td data-label="Province" style={{ padding: '0.5rem' }}>{e.provinceName}</td>
                      <td data-label="Ruler" style={{ padding: '0.5rem' }}>{e.rulerName}</td>
                      <td data-label="Kingdom" style={{ padding: '0.5rem' }}>{e.kingdomName || '—'}</td>
                      <td data-label="Networth" style={{ padding: '0.5rem', textAlign: 'right' }}>{(e.networth ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
