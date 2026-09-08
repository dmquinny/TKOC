"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import TargetSearch from '@/components/TargetSearch';


export default function WarRoom() {
  const router = useRouter();
  const [targets, setTargets] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [activeAttacks, setActiveAttacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileTargetsOpen, setMobileTargetsOpen] = useState(false);
  
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [deployQuantities, setDeployQuantities] = useState<Record<number, number>>({});
  const [attackType, setAttackType] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);

  const ATTACK_TYPES = [
    { id: 1, name: 'Standard', desc: 'Balanced: take land and plunder.' },
    { id: 2, name: 'Massacre', desc: 'Maximise enemy losses; little loot.' },
    { id: 5, name: 'Pillage', desc: 'Maximise plunder; little land.' },
  ];

  const fetchWarRoom = async () => {
    try {
      const res = await fetch('/api/combat/attack');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setTargets(data.targets);
      setUnits(data.units);
      setActiveAttacks(data.activeAttacks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarRoom();
  }, [router]);

  const handleDeploy = async () => {
    if (!selectedTarget) return alert('Select a target province first');
    
    setIsDeploying(true);
    setError('');

    try {
      const res = await fetch('/api/combat/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetID: selectedTarget, troops: deployQuantities, attackType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDeployQuantities({});
      setSelectedTarget(null);
      await fetchWarRoom();
      alert('Army Dispatched! They will arrive in 3 ticks.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading War Room...</div>;

  const filteredTargets = targets
    .filter(t => t.provinceName.toLowerCase().includes(searchTerm.toLowerCase()) || (t.rulerName && t.rulerName.toLowerCase().includes(searchTerm.toLowerCase())))
    .slice(0, 50);

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/war-room" />

      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-war-room.webp"
          title="War Room"
          subtitle="Command your armies and conquer your rivals."
        />

        {error && (
          <FeedbackNotice tone="error">
            {error}
          </FeedbackNotice>
        )}

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Active Attacks */}
          <section className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Active Deployments</h2>
            {activeAttacks.length === 0 ? (
              <p className="empty-state">No armies currently deployed.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {activeAttacks.map(a => (
                  <li key={a.id} style={{ padding: '1rem', borderBottom: '1px solid #33333d' }}>
                    Attacking <strong>{a.defender?.provinceName}</strong> 
                    {a.totick > 0 ? ` (Arrives in ${a.totick} ticks)` : ` (Returning in ${a.backtick} ticks)`}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Targets */}
          <section className="stat-card target-panel">
            <h2 className="desktop-target-heading">Reconnaissance (Targets)</h2>
            <button type="button" className="mobile-target-toggle mobile-only" onClick={() => setMobileTargetsOpen(open => !open)}>
              <span><small>Attack target</small><strong>{targets.find(target => target.id === selectedTarget)?.provinceName ?? 'Choose a province'}</strong></span>
              <span>{mobileTargetsOpen ? 'Close' : selectedTarget ? 'Change' : 'Choose'}</span>
            </button>
            <div className={`target-picker-body${mobileTargetsOpen ? ' is-open' : ''}`}>
              <TargetSearch value={searchTerm} onChange={setSearchTerm} />
              <div className="target-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
              {filteredTargets.map(t => (
                <button
                  type="button"
                  className="target-option"
                  aria-pressed={selectedTarget === t.id}
                  key={t.id} 
                  onClick={() => { setSelectedTarget(t.id); setMobileTargetsOpen(false); }}
                  style={{ 
                    padding: '1rem', 
                    border: `2px solid ${selectedTarget === t.id ? '#8a2be2' : '#33333d'}`, 
                    cursor: 'pointer',
                    color: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    backgroundColor: selectedTarget === t.id ? 'rgba(138, 43, 226, 0.1)' : 'transparent'
                  }}
                >
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{t.provinceName}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#adb5bd' }}>Ruler: {t.rulerName}</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#adb5bd' }}>Networth: {t.networth.toLocaleString()} | Acres: {t.acres.toLocaleString()}</p>
                </button>
              ))}
              </div>
            </div>
          </section>

          {/* Deployment */}
          <section className="stat-card">
            <h2>Dispatch Army</h2>
            {selectedTarget ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p>Target Selected: <strong>{targets.find(t => t.id === selectedTarget)?.provinceName}</strong></p>
                
                {units.map(u => (
                  <div key={u.mID} className="mobile-unit-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{u.type.className}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#adb5bd' }}>Available: {u.num} | ATK: {u.type.attack}</div>
                    </div>
                    <input 
                      type="number" 
                      min="0"
                      max={u.num}
                      style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff' }}
                      value={deployQuantities[u.mID] || ''}
                      onChange={(e) => setDeployQuantities(prev => ({ ...prev, [u.mID]: parseInt(e.target.value) || 0 }))}
                      placeholder="Qty"
                    />
                  </div>
                ))}

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--gold)' }}>Attack type</label>
                  <select
                    value={attackType}
                    onChange={(e) => setAttackType(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff' }}
                  >
                    {ATTACK_TYPES.map(t => <option key={t.id} value={t.id}>{t.name} — {t.desc}</option>)}
                  </select>
                </div>

                <button
                  onClick={handleDeploy}
                  className="btn-primary mobile-sticky-action"
                  disabled={isDeploying || Object.values(deployQuantities).reduce((a, b) => a + b, 0) === 0}
                  style={{ marginTop: '1rem' }}
                >
                  {isDeploying ? 'Marching...' : 'Launch Attack'}
                </button>
              </div>
            ) : (
              <p className="empty-state">Select a target province from the reconnaissance list to deploy troops.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
