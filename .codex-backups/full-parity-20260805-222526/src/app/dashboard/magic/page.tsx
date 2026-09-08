"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import TargetSearch from '@/components/TargetSearch';
import OnboardingTip from '@/components/OnboardingTip';

type Target = { id: number; provinceName: string | null; rulerName: string | null; networth: number | null; acres: number | null; kiID: number };
type Spell = {
  id: number; name: string; className: string; target: 'friendly' | 'hostile' | 'self'; mode: 'direct' | 'timed' | 'dispel';
  mana: number; gold: number; metal: number; food: number; peasants: number; wizards: number;
  description: string; available: boolean; kingdom?: boolean;
};

export default function Magic() {
  const router = useRouter();
  const [targets, setTargets] = useState<Target[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [availableWizards, setAvailableWizards] = useState(0);
  const [mana, setMana] = useState(0);
  const [myProvinceId, setMyProvinceId] = useState<number | null>(null);
  const [myKingdomId, setMyKingdomId] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedSpell, setSelectedSpell] = useState('');
  const [wizardsToChannel, setWizardsToChannel] = useState(0);
  const [duration, setDuration] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileTargetsOpen, setMobileTargetsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCasting, setIsCasting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchMagic = async () => {
    try {
      const response = await fetch('/api/magic/cast');
      if (response.status === 401) return router.push('/');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTargets(data.targets ?? []);
      setSpells(data.spells ?? []);
      setAvailableWizards(data.availableWizards ?? 0);
      setMana(data.mana ?? 0);
      setMyProvinceId(data.myProvinceId);
      setMyKingdomId(data.myKingdomId ?? 0);
      setSelectedTarget(current => current ?? data.myProvinceId);
      setSelectedSpell(current => current || data.spells?.find((spell: Spell) => spell.available)?.name || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load magic');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchMagic(); }, []);

  const target = targets.find(entry => entry.id === selectedTarget);
  const availableSpells = useMemo(() => spells.filter(spell => {
    if (!spell.available || !target || myProvinceId === null) return false;
    if (target.id === myProvinceId) return spell.target !== 'hostile';
    if (myKingdomId && target.kiID === myKingdomId) return spell.target === 'friendly' && spell.kingdom;
    return spell.target === 'hostile';
  }), [spells, target, myProvinceId, myKingdomId]);
  const chosen = availableSpells.find(spell => spell.name === selectedSpell) ?? availableSpells[0];
  const recommended = chosen && target ? Math.max(1, Math.ceil(chosen.wizards * Math.max(1, target.acres ?? 0))) : 0;

  useEffect(() => {
    setWizardsToChannel(current => (
      current > 0 && current <= availableWizards
        ? current
        : Math.min(availableWizards, recommended)
    ));
  }, [availableWizards, recommended]);

  useEffect(() => {
    if (availableSpells.length && !availableSpells.some(spell => spell.name === selectedSpell)) {
      setSelectedSpell(availableSpells[0].name);
    }
  }, [availableSpells, selectedSpell]);

  const handleCast = async () => {
    if (!selectedTarget || !chosen) return;
    if (wizardsToChannel < 1 || wizardsToChannel > availableWizards) {
      setError('Choose between 1 and your available wizard count.');
      return;
    }
    setIsCasting(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/magic/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetID: selectedTarget, spell: chosen.name, wizardsToChannel, duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      await fetchMagic();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Casting failed');
    } finally {
      setIsCasting(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading Wizard&apos;s Tower...</div>;
  const filteredTargets = targets.filter(entry => {
    const query = searchTerm.toLowerCase();
    return (entry.provinceName ?? '').toLowerCase().includes(query) || (entry.rulerName ?? '').toLowerCase().includes(query);
  }).slice(0, 50);
  const cost = (value: number) => Math.ceil(value * Math.max(1, target?.acres ?? 0)).toLocaleString();
  const spellImage = (name: string) =>
    `/game/spells/${name.toLowerCase().replaceAll("'", '').replace(/\s+/g, '-')}.webp`;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/magic" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-magic.webp"
          title="Wizard's Tower"
          subtitle="The complete original spell book: 31 active legacy spell classes."
          right={<div className="networth-badge">Wizards: {availableWizards.toLocaleString()} &middot; Mana: {mana}</div>}
        />
        <OnboardingTip
          id="magic"
          title="Only castable spells are shown"
          description="Choose a target and spell, then set the wizard force. More ready wizards improve success and can reduce mana use."
          href="/dashboard/guide"
          linkLabel="Read the magic guide"
        />
        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {result && <FeedbackNotice tone={result.success ? 'success' : 'error'}>{result.message}</FeedbackNotice>}

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .8fr) minmax(360px, 1.2fr)', gap: '2rem' }}>
          <section className="stat-card target-panel">
            <h2 className="desktop-target-heading">Select Target</h2>
            <button type="button" className="mobile-target-toggle mobile-only" onClick={() => setMobileTargetsOpen(open => !open)}>
              <span><small>Target</small><strong>{target?.provinceName ?? 'Choose a province'}</strong></span>
              <span>{mobileTargetsOpen ? 'Close' : target ? 'Change' : 'Choose'}</span>
            </button>
            <div className={`target-picker-body${mobileTargetsOpen ? ' is-open' : ''}`}>
              <TargetSearch value={searchTerm} onChange={setSearchTerm} />
              <div className="target-list" style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', maxHeight: 560, overflowY: 'auto' }}>
              {filteredTargets.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="target-option"
                  aria-pressed={selectedTarget === entry.id}
                  onClick={() => { setSelectedTarget(entry.id); setMobileTargetsOpen(false); }}
                  style={{ padding: '.8rem', border: `2px solid ${selectedTarget === entry.id ? '#8a2be2' : '#33333d'}`, borderRadius: 8, color: 'inherit', textAlign: 'left', background: selectedTarget === entry.id ? 'rgba(138,43,226,.1)' : 'transparent' }}
                >
                  <strong>{entry.provinceName ?? 'Unnamed province'} {entry.id === myProvinceId ? '(Self)' : ''}</strong>
                  <div style={{ color: '#adb5bd', fontSize: '.85rem' }}>{(entry.acres ?? 0).toLocaleString()} acres &middot; NW {(entry.networth ?? 0).toLocaleString()}</div>
                </button>
              ))}
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h2>Cast Spell</h2>
            {!target ? <p>Select a target province.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p>Target: <strong>{target.provinceName ?? 'Unnamed province'}</strong></p>
                <div className="spell-picker spell-picker-scroll" role="radiogroup" aria-label="Choose a spell">
                  {availableSpells.map(spell => (
                    <button
                      key={spell.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen?.name === spell.name}
                      className={`spell-option${chosen?.name === spell.name ? ' is-selected' : ''}`}
                      onClick={() => setSelectedSpell(spell.name)}
                    >
                      <img
                        src={spellImage(spell.name)}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="spell-option-body">
                        <span className="spell-option-heading"><strong>{spell.name}</strong><small>{spell.mana} base mana</small></span>
                        <span className="spell-type">{spell.mode} &middot; {spell.target}</span>
                        <span className="spell-description">{spell.description}</span>
                      </span>
                    </button>
                  ))}
                  {!availableSpells.length && (
                    <p className="empty-state">No spells are currently available for this target.</p>
                  )}
                </div>
                {chosen && (
                  <>
                    <div style={{ color: '#adb5bd', fontSize: '.9rem' }}>
                      Cost for {target.acres ?? 0} acres: {cost(chosen.gold)} gold &middot; {cost(chosen.metal)} metal &middot; {cost(chosen.food)} food
                      {chosen.peasants > 0 ? ` · ${cost(chosen.peasants)} peasants` : ''}
                    </div>
                    {chosen.mode === 'timed' && (
                      <label style={{ display: 'grid', gap: '.5rem' }}>
                        <span>Duration (1–24 ticks)</span>
                        <input
                          className="game-input"
                          style={{ width: '100%', minWidth: 0 }}
                          type="number"
                          min={1}
                          max={24}
                          value={duration}
                          onChange={event => setDuration(Math.max(1, Math.min(24, Number(event.target.value))))}
                        />
                      </label>
                    )}
                    <label style={{ display: 'grid', gap: '.5rem' }}>
                      <span>Wizards to channel</span>
                      <input
                        className="game-input"
                        style={{ width: '100%', minWidth: 0 }}
                        type="number"
                        min={availableWizards > 0 ? 1 : 0}
                        max={availableWizards}
                        value={wizardsToChannel}
                        disabled={availableWizards < 1}
                        onChange={event => setWizardsToChannel(Number(event.target.value) || 0)}
                      />
                    </label>
                    <small style={{ color: '#adb5bd' }}>Original recommended force: about {recommended.toLocaleString()} wizards. More wizards reduce mana use and increase success.</small>
                    <button className="btn-primary mobile-sticky-action" type="button" disabled={isCasting || !chosen.available || wizardsToChannel < 1} onClick={handleCast}>
                      {isCasting ? 'Incanting...' : 'Cast Spell'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
