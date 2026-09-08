"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

export default function KingdomPage() {
  const router = useRouter();
  const [inKingdom, setInKingdom] = useState(false);
  const [kingdom, setKingdom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [myVote, setMyVote] = useState(0);
  const [diplomacy, setDiplomacy] = useState<any>(null);
  const [diploTarget, setDiploTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const mineRes = await fetch('/api/kingdom');
      if (mineRes.status === 401) return router.push('/');
      const mine = await mineRes.json();
      if (!mineRes.ok) throw new Error(mine.error);
      setInKingdom(mine.inKingdom);
      setKingdom(mine.kingdom);
      setMembers(mine.members || []);
      setMyVote(mine.myVote || 0);
      setDiplomacy(mine.diplomacy || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [router]);

  const act = async (body: any) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/kingdom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading-screen">Gathering the Court...</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/kingdom" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-kingdom.webp"
          title={inKingdom ? (kingdom?.name || 'Your Kingdom') : 'Independent'}
          subtitle={inKingdom ? 'Provinces united under one banner.' : 'You answer to no crown — for now.'}
          right={inKingdom ? <div className="networth-badge">{members.length} Province{members.length === 1 ? '' : 's'}</div> : undefined}
        />

        {error && (
          <FeedbackNotice tone="error">{error}</FeedbackNotice>
        )}
        {message && (
          <FeedbackNotice tone="success">{message}</FeedbackNotice>
        )}

        {inKingdom ? (
          <>
          <section className="stat-card table-card">
            <h2 style={{ margin: 0 }}>Members</h2>
            <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--gold)', borderBottom: '1px solid var(--stone-border)' }}>
                  <th style={{ padding: '0.6rem' }}>Province</th>
                  <th style={{ padding: '0.6rem' }}>Ruler</th>
                  <th style={{ padding: '0.6rem' }}>Race</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>Acres</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>Networth</th>
                  <th style={{ padding: '0.6rem', textAlign: 'center' }}>Votes</th>
                  <th style={{ padding: '0.6rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #2a2419', background: m.isMe ? 'rgba(200,149,47,0.08)' : 'transparent' }}>
                    <td data-label="Province" style={{ padding: '0.6rem' }}>{m.provinceName} {m.isKing && <span title="King" style={{ color: 'var(--gold-bright)' }}>&#9819;</span>}</td>
                    <td data-label="Ruler" style={{ padding: '0.6rem' }}>{m.rulerName}</td>
                    <td data-label="Race" style={{ padding: '0.6rem' }}>{m.race}</td>
                    <td data-label="Acres" style={{ padding: '0.6rem', textAlign: 'right' }}>{(m.acres ?? 0).toLocaleString()}</td>
                    <td data-label="Networth" style={{ padding: '0.6rem', textAlign: 'right' }}>{(m.networth ?? 0).toLocaleString()}</td>
                    <td data-label="Votes" style={{ padding: '0.6rem', textAlign: 'center' }}>{m.votes}</td>
                    <td data-label="Action" style={{ padding: '0.6rem', textAlign: 'right' }}>
                      {myVote === m.id ? (
                        <span style={{ color: 'var(--gold-bright)', fontSize: '0.85rem' }}>★ Voted</span>
                      ) : (
                        <button
                          onClick={() => act({ action: 'vote', targetPID: m.id })}
                          disabled={busy}
                          className="btn-primary"
                          style={{ margin: 0, padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          Vote
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: '#adb5bd', fontSize: '0.85rem', marginTop: '1rem' }}>
              The King (crowned) gains an income bonus each tick. A candidate needs votes from at least half of the kingdom before the crown changes hands. Kingdom membership is fixed for the age.
            </p>
          </section>

          {diplomacy && (
            <section className="stat-card" style={{ marginTop: '2rem' }}>
              <h2>Diplomacy</h2>
              {!diplomacy.isKing && <p style={{ color: '#adb5bd', fontSize: '0.85rem' }}>Only the King can change diplomatic relations.</p>}

              {(diplomacy.allies.length > 0 || diplomacy.wars.length > 0) && (
                <div style={{ marginBottom: '1rem' }}>
                  {diplomacy.allies.map((a: any) => (
                    <div key={'al' + a.relationId} className="responsive-split" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #2a2419' }}>
                      <span style={{ color: '#7ee08a' }}>Allied with <strong>{a.name}</strong></span>
                      {diplomacy.isKing && <button className="btn-primary" style={{ margin: 0, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => act({ action: 'cancelRelation', relationId: a.relationId })}>End Alliance</button>}
                    </div>
                  ))}
                  {diplomacy.wars.map((w: any) => (
                    <div key={'wr' + w.relationId} className="responsive-split" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #2a2419' }}>
                      <span style={{ color: '#ff7a7a' }}>At war with <strong>{w.name}</strong></span>
                      {diplomacy.isKing && <button className="btn-primary" style={{ margin: 0, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => act({ action: 'cancelRelation', relationId: w.relationId })}>Sue for Peace</button>}
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.isKing && diplomacy.incomingProposals.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem' }}>Alliance offers</h3>
                  {diplomacy.incomingProposals.map((p: any) => (
                    <div key={'in' + p.relationId} className="responsive-split" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                      <span>{p.name} proposes an alliance</span>
                      <span style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-primary" style={{ margin: 0, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => act({ action: 'acceptRelation', relationId: p.relationId })}>Accept</button>
                        <button className="btn-primary" style={{ margin: 0, padding: '0.25rem 0.7rem', fontSize: '0.8rem', background: 'linear-gradient(180deg,#6b6353,#463f30)', borderColor: '#6b6353' }} disabled={busy} onClick={() => act({ action: 'cancelRelation', relationId: p.relationId })}>Decline</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.outgoingProposals.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  {diplomacy.outgoingProposals.map((p: any) => (
                    <div key={'out' + p.relationId} className="responsive-split" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                      <span style={{ color: '#adb5bd' }}>Alliance offered to {p.name} (pending)</span>
                      {diplomacy.isKing && <button className="btn-primary" style={{ margin: 0, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => act({ action: 'cancelRelation', relationId: p.relationId })}>Withdraw</button>}
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.isKing && diplomacy.otherKingdoms.length > 0 && (
                <div className="responsive-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <select value={diploTarget} onChange={(e) => setDiploTarget(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff' }}>
                    <option value="">Choose a kingdom…</option>
                    {diplomacy.otherKingdoms.map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                  <button className="btn-primary" style={{ margin: 0 }} disabled={busy || !diploTarget} onClick={() => act({ action: 'proposeAlly', kingdomId: Number(diploTarget) })}>Propose Ally</button>
                  <button className="btn-primary" style={{ margin: 0, background: 'linear-gradient(180deg,#b5533a,#7a2f22)', borderColor: '#b5533a' }} disabled={busy || !diploTarget} onClick={() => act({ action: 'declareWar', kingdomId: Number(diploTarget) })}>Declare War</button>
                </div>
              )}
            </section>
          )}
          </>
        ) : (
          <section className="stat-card">
            <h2>No Kingdom Assigned</h2>
            <p className="empty-state">Kingdom membership is chosen when a province is founded and remains fixed for the age.</p>
          </section>
        )}
      </main>
    </div>
  );
}
