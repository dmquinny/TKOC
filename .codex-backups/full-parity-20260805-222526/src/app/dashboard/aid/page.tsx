"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem', borderRadius: '4px',
  border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff',
};

export default function Aid() {
  const router = useRouter();
  const [state, setState] = useState<any>(null);
  const [toPID, setToPID] = useState('');
  const [resource, setResource] = useState('gold');
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/aid');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [router]);

  const send = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/aid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPID: Number(toPID), resource, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(data.message);
      setAmount(0);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading the Treasury…</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/aid" />
      <main id="main-content" className="dashboard-content">
        <PageBanner image="/game/headers/header-aid.webp" title="Send Aid" subtitle="Share your bounty with your kingdom." />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

        {!state.inKingdom ? (
          <section className="stat-card"><p className="empty-state">You must be in a kingdom to send aid. Kingdom membership is chosen when a province is founded.</p></section>
        ) : (
          <section className="stat-card" style={{ maxWidth: '520px' }}>
            <p style={{ color: '#adb5bd', marginTop: 0 }}>
              You hold {state.gold?.toLocaleString()} gold · {state.food?.toLocaleString()} food · {state.metal?.toLocaleString()} metal · {state.peasants?.toLocaleString()} peasants.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Recipient</label>
                <select value={toPID} onChange={(e) => setToPID(e.target.value)} style={fieldStyle}>
                  <option value="">Choose a kingdom-mate…</option>
                  {state.mates.map((m: any) => <option key={m.id} value={m.id}>{m.provinceName} ({m.rulerName})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Resource</label>
                <select value={resource} onChange={(e) => setResource(e.target.value)} style={fieldStyle}>
                  <option value="gold">Gold</option>
                  <option value="food">Food</option>
                  <option value="metal">Metal</option>
                  <option value="peasants">Peasants</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Amount</label>
                <input type="number" min="0" value={amount || ''} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} style={fieldStyle} />
              </div>
              <button onClick={send} className="btn-primary" style={{ margin: 0 }} disabled={busy || !toPID || amount <= 0}>
                {busy ? 'Sending…' : 'Send Aid'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
