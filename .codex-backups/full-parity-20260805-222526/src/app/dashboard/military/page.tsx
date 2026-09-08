"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';

interface MilitaryType {
  id: number;
  className: string;
  displayName: string | null;
  category: string | null;
  costGold: number;
  costMetal: number;
  costFood: number;
  attack: number;
  defense: number;
  trainTicks: number;
}

interface MilitaryUnit {
  mID: number;
  num: number;
}

interface TrainingRow {
  mID: number;
  name: string;
  num: number;
  ticksLeft: number;
}

export default function Military() {
  const router = useRouter();
  const [types, setTypes] = useState<MilitaryType[]>([]);
  const [units, setUnits] = useState<MilitaryUnit[]>([]);
  const [training, setTraining] = useState<TrainingRow[]>([]);
  const [availablePeasants, setAvailablePeasants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<number, number>>({});
  const [isDrafting, setIsDrafting] = useState(false);

  const fetchMilitary = async () => {
    try {
      const res = await fetch('/api/military');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setTypes(data.types);
      setUnits(data.units);
      setTraining(data.training ?? []);
      setAvailablePeasants(data.peasants);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMilitary();
  }, [router]);

  const handleDraft = async (mID: number) => {
    const qty = draftQuantities[mID] || 0;
    if (qty <= 0) return;

    setIsDrafting(true);
    setError('');

    try {
      const res = await fetch('/api/military', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mID, quantity: qty }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDraftQuantities(prev => ({ ...prev, [mID]: 0 }));
      await fetchMilitary();
      alert(data.message || 'Sent to training.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  const getOwnedQuantity = (mID: number) => {
    const u = units.find(x => x.mID === mID);
    return u ? u.num : 0;
  };

  const getUnitImage = (type: MilitaryType) => {
    const imageName = {
      soldiers: 'recruits',
      offense: 'swordsmen',
      defense: 'pikemen',
      elite: 'knights',
      thieves: 'thieves',
      wizards: 'wizards',
    }[type.category ?? ''] ?? 'recruits';
    return `/game/units/${imageName}.webp`;
  };

  if (loading) return <div className="loading-screen">Loading Military Site...</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/military" />

      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-military.webp"
          title="Military Barracks"
          subtitle="Draft peasants into an army to crush your foes."
          right={<div className="networth-badge">Available Peasants: {availablePeasants.toLocaleString()}</div>}
        />

        {error && (
          <FeedbackNotice tone="error">
            {error}
          </FeedbackNotice>
        )}

        {training.length > 0 && (
          <div className="stat-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--gold)' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>In Training</h3>
            <p style={{ color: '#adb5bd', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>Recruits arrive gradually and can&apos;t be sent to war until they finish training.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {training.map(t => (
                <div key={t.mID} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#adb5bd' }}>
                  <span>{t.num.toLocaleString()} × {t.name}</span>
                  <span style={{ color: 'var(--gold)' }}>all ready in {t.ticksLeft} tick{t.ticksLeft === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="responsive-grid desktop-layout-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
          {types.map(type => (
            <div key={type.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="card-heading-row" style={{ fontSize: '1.2rem', marginBottom: 0, display: 'flex', justifyContent: 'space-between' }}>
                {type.displayName || type.className}
                <span style={{ fontSize: '0.9rem', color: '#adb5bd' }}>ATK: {type.attack} | DEF: {type.defense}</span>
              </h3>
              
              <div className="card-media unit-media" style={{ width: '100%', height: '220px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid var(--stone-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={getUnitImage(type)} alt={type.displayName || type.className} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }} />
              </div>
              
              <p style={{ color: '#adb5bd', fontSize: '0.9rem', margin: 0 }}>
                Cost: {type.costGold} Gold, {type.costMetal} Metal, {type.costFood} Food, 1 {type.category === 'soldiers' ? 'Peasant' : 'base soldier'} &middot; Training: {type.trainTicks} ticks
              </p>

              <div style={{ padding: '0.5rem', backgroundColor: 'rgba(138, 43, 226, 0.1)', borderRadius: '4px', borderLeft: '3px solid #8a2be2' }}>
                <strong>Troops: </strong> {getOwnedQuantity(type.id)}
              </div>

              <div className="mobile-form-row" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <input 
                  type="number" 
                  min="0"
                  max={availablePeasants}
                  style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #33333d', backgroundColor: '#121214', color: '#fff' }}
                  value={draftQuantities[type.id] || ''}
                  onChange={(e) => setDraftQuantities(prev => ({ ...prev, [type.id]: parseInt(e.target.value) || 0 }))}
                  placeholder="Qty"
                />
                <button 
                  onClick={() => handleDraft(type.id)}
                  className="btn-primary" 
                  style={{ flex: 1, margin: 0, padding: '0.5rem' }}
                  disabled={isDrafting || !draftQuantities[type.id] || draftQuantities[type.id] <= 0}
                >
                  Draft Unit
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mobile-list mobile-only">
          {types.map(type => (
            <details className="mobile-list-item" key={type.id}>
              <summary className="mobile-list-summary">
                <img className="mobile-list-thumb" src={getUnitImage(type)} alt="" loading="lazy" decoding="async" />
                <span className="mobile-list-summary-copy">
                  <strong>{type.displayName || type.className}</strong>
                  <span>{getOwnedQuantity(type.id).toLocaleString()} ready · ATK {type.attack} · DEF {type.defense}</span>
                </span>
              </summary>
              <div className="mobile-list-detail">
                <div className="mobile-fact-grid">
                  <span className="mobile-fact"><small>Gold</small><strong>{type.costGold.toLocaleString()}</strong></span>
                  <span className="mobile-fact"><small>Metal</small><strong>{type.costMetal.toLocaleString()}</strong></span>
                  <span className="mobile-fact"><small>Food</small><strong>{type.costFood.toLocaleString()}</strong></span>
                  <span className="mobile-fact"><small>Training</small><strong>{type.trainTicks} ticks</strong></span>
                </div>
                <div className="mobile-inline-action">
                  <input
                    type="number"
                    min="0"
                    max={availablePeasants}
                    value={draftQuantities[type.id] || ''}
                    onChange={(event) => setDraftQuantities(previous => ({ ...previous, [type.id]: parseInt(event.target.value) || 0 }))}
                    placeholder="Quantity"
                    aria-label={`Number of ${type.displayName || type.className} to draft`}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleDraft(type.id)}
                    disabled={isDrafting || !draftQuantities[type.id] || draftQuantities[type.id] <= 0}
                  >
                    Draft
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
