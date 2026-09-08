"use client";

import { useEffect, useMemo, useState } from 'react';
import Notices from '@/components/Notices';
import OnboardingTip from '@/components/OnboardingTip';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import RelationBadge from '@/components/RelationBadge';
import TargetPicker from '@/components/TargetPicker';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';
import type { TargetIntel } from '@/lib/targets';

type Spell = {
  id: number;
  name: string;
  className: string;
  target: 'friendly' | 'hostile' | 'self';
  mode: 'direct' | 'timed' | 'dispel';
  mana: number;
  gold: number;
  metal: number;
  food: number;
  peasants: number;
  wizards: number;
  description: string;
  available: boolean;
  kingdom?: boolean;
};

interface MagicData {
  targets: TargetIntel[];
  spells: Spell[];
  availableWizards: number;
  mana: number;
  myProvinceId: number;
  myKingdomId: number;
}

interface CastResponse {
  success: boolean;
  message: string;
}

const spellImage = (name: string) => `/game/spells/${name.toLowerCase().replaceAll("'", '').replace(/\s+/g, '-')}.webp`;

export default function Magic() {
  const { data, error, loading, refresh } = useGameData<MagicData>('/api/magic/cast');
  const action = useGameAction();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedSpell, setSelectedSpell] = useState('');
  const [wizardsToChannel, setWizardsToChannel] = useState(0);
  const [duration, setDuration] = useState(1);
  const [result, setResult] = useState<CastResponse | null>(null);

  useEffect(() => {
    if (data && selectedTarget === null) setSelectedTarget(data.myProvinceId);
  }, [data, selectedTarget]);

  const target = data?.targets.find(entry => entry.id === selectedTarget) ?? null;
  const availableSpells = useMemo(() => {
    if (!data || !target) return [];
    return data.spells.filter(spell => {
      if (!spell.available) return false;
      if (target.relation === 'self') return spell.target !== 'hostile';
      if (target.relation === 'kingdom') return spell.target === 'friendly' && spell.kingdom;
      return spell.target === 'hostile';
    });
  }, [data, target]);
  const chosen = availableSpells.find(spell => spell.name === selectedSpell) ?? availableSpells[0] ?? null;
  const availableWizards = data?.availableWizards ?? 0;
  const recommended = chosen && target ? Math.max(1, Math.ceil(chosen.wizards * Math.max(1, target.acres))) : 0;

  useEffect(() => {
    setWizardsToChannel(current => (
      current > 0 && current <= availableWizards ? current : Math.min(availableWizards, recommended)
    ));
  }, [availableWizards, recommended]);

  useEffect(() => {
    if (availableSpells.length && !availableSpells.some(spell => spell.name === selectedSpell)) {
      setSelectedSpell(availableSpells[0].name);
    }
  }, [availableSpells, selectedSpell]);

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || "The Wizard's Tower could not be opened."} />;
  }

  const cost = (value: number) => Math.ceil(value * Math.max(1, target?.acres ?? 0)).toLocaleString();

  const cast = async () => {
    if (!selectedTarget || !chosen) return;
    if (wizardsToChannel < 1 || wizardsToChannel > availableWizards) {
      action.setError('Choose between 1 and your available wizard count.');
      return;
    }
    setResult(null);
    const outcome = await action.run('cast', () => apiPost<CastResponse>('/api/magic/cast', {
      targetID: selectedTarget,
      spell: chosen.name,
      wizardsToChannel,
      duration,
    }));
    if (outcome) {
      setResult(outcome);
      void refresh();
      requestNotificationRefresh();
    }
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-magic.webp"
        title="Wizard's Tower"
        subtitle="The complete original spell book: 31 active legacy spell classes."
        right={<div className="networth-badge">Wizards: {availableWizards.toLocaleString()} · Mana: {data.mana}</div>}
      />
      <OnboardingTip
        id="magic"
        title="Only castable spells are shown"
        description="Choose a target and spell, then set the wizard force. More ready wizards improve success and can reduce mana use."
        href="/dashboard/guide"
        linkLabel="Read the magic guide"
      />

      <Notices error={error || action.error} notice={result?.success ? result.message : undefined} />
      {result && !result.success && <Notices error={result.message} />}

      <div className="responsive-grid page-grid is-targets">
        <TargetPicker targets={data.targets} selectedId={selectedTarget} onSelect={setSelectedTarget} title="Select Target" />

        <section className="stat-card">
          <h2>Cast Spell</h2>
          {!target ? <p className="empty-state">Select a target province.</p> : (
            <div className="stack">
              <p className="row mb-0">
                <span>Target: <strong>{target.provinceName}</strong></span>
                <RelationBadge relation={target.relation} />
              </p>
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
                    <img src={spellImage(spell.name)} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <span className="spell-option-body">
                      <span className="spell-option-heading"><strong>{spell.name}</strong><small>{spell.mana} base mana</small></span>
                      <span className="spell-type">{spell.mode} · {spell.target}</span>
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
                  <p className="text-muted text-small mb-0">
                    Cost for {target.acres.toLocaleString()} acres: {cost(chosen.gold)} gold · {cost(chosen.metal)} metal · {cost(chosen.food)} food
                    {chosen.peasants > 0 ? ` · ${cost(chosen.peasants)} peasants` : ''}
                  </p>
                  {chosen.mode === 'timed' && (
                    <label className="game-field">
                      <span>Duration (1–24 ticks)</span>
                      <input
                        className="game-input"
                        type="number"
                        min={1}
                        max={24}
                        value={duration}
                        onChange={event => setDuration(Math.max(1, Math.min(24, Number(event.target.value))))}
                      />
                    </label>
                  )}
                  <label className="game-field">
                    <span>Wizards to channel</span>
                    <input
                      className="game-input"
                      type="number"
                      min={availableWizards > 0 ? 1 : 0}
                      max={availableWizards}
                      value={wizardsToChannel}
                      disabled={availableWizards < 1}
                      onChange={event => setWizardsToChannel(Number(event.target.value) || 0)}
                    />
                    <small>Original recommended force: about {recommended.toLocaleString()} wizards. More wizards reduce mana use and increase success.</small>
                  </label>
                  <button
                    className="btn-primary mobile-sticky-action"
                    type="button"
                    disabled={action.busy !== null || !chosen.available || wizardsToChannel < 1}
                    onClick={() => void cast()}
                  >
                    {action.busy === 'cast' ? 'Incanting…' : `Cast ${chosen.name}`}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
