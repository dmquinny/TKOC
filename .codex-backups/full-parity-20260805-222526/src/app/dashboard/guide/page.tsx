"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import { getBuildingRule } from '@/lib/buildings';

const RESOURCES: [string, string][] = [
  ['Gold', 'Peasants pay tax each tick. Spent on buildings, military, science, exploration, and aid.'],
  ['Food', 'Produced by Farms. Peasants and soldiers eat it every tick — if it runs out, they starve.'],
  ['Metal', 'Produced by Mines. Needed for most buildings and units.'],
  ['Peasants', 'Your population. They pay tax, are drafted into the army (1 peasant per unit), and eat food. They grow each tick up to your housing limit.'],
  ['Acres', 'Your land. Holds buildings (1 acre each) and houses peasants. Gained by Exploring or conquering rivals.'],
  ['Mana', 'Fuel for spells. Regenerates each tick; Wizard Towers raise the cap and rate.'],
  ['Influence', 'Raised by Temples. Higher influence boosts your gold income (up to +15%).'],
  ['Networth', 'Your overall power — used for rankings and to size you up against rivals.'],
];

const MILITARY_INFO: Record<string, string> = {
  'Peasants': 'Your population — taxed, drafted, and fed. Not a fighting unit.',
  'Thieves': 'Required for every thievery operation.',
  'Wizards': 'Required to cast spells; more wizards means stronger magic.',
  'Catapults': 'Enormous attack, almost no defense — siege only.',
  'Dragons': 'Devastating on both attack and defense.',
};

const EFFECT_LABEL: Record<string, string> = {
  income: 'Income', offense: 'Offense', defense: 'Defense', magic: 'Magic',
  foodProduction: 'Food', metalProduction: 'Metal', explore: 'Exploration',
};

const TABS = ['Basics', 'Buildings', 'Military', 'Arcane Arts', 'Science', 'Council & Races', 'The World', 'Dependencies'] as const;
type Tab = typeof TABS[number];

const th: React.CSSProperties = { padding: '0.5rem', textAlign: 'left', color: 'var(--gold)', borderBottom: '1px solid var(--stone-border)' };
const td: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #2a2419', verticalAlign: 'top' };

export default function Guide() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Basics');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/guide');
        if (res.status === 401) return router.push('/');
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) return <div className="loading-screen">Opening the Tome…</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/guide" />
      <main id="main-content" className="dashboard-content">
        <PageBanner image="/game/headers/header-guide.webp" title="Guide" subtitle="How to rule, wage war, and prosper." />

        <div className="guide-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn-primary"
              style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.9rem', opacity: tab === t ? 1 : 0.5 }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Basics' && (
          <>
            <section className="stat-card" style={{ marginBottom: '1.5rem' }}>
              <h2>How to Play</h2>
              <p style={{ color: 'var(--parchment)' }}>
                You rule a <strong>province</strong>. A <strong>tick</strong> is one turn of the game clock, and it happens once every
                <strong> real hour</strong>. So <strong>24 ticks make an in-game day</strong> and <strong>7 days a week</strong> — the game
                clock roughly tracks real time (an in-game day ≈ a real day). Everything happens on ticks: your peasants pay tax and grow,
                your farms and mines produce, your armies march, your spells and expeditions resolve, and effects count down. Your goals are
                to grow your economy, raise an army, research sciences, and outmaneuver rival provinces — alone or as part of a{' '}
                <strong>kingdom</strong>. Watch your <strong>food</strong>: if it hits zero, your people starve.
              </p>
            </section>
            <section className="stat-card table-card">
              <h2>Resources</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {RESOURCES.map(([name, desc]) => (
                    <tr key={name}><td style={{ ...td, width: '130px', color: 'var(--gold-bright)', fontFamily: 'var(--font-display)' }}>{name}</td><td style={td}>{desc}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === 'Buildings' && (
          <section className="stat-card table-card">
            <h2>Buildings</h2>
            <p style={{ color: '#adb5bd', marginTop: 0 }}>Each building occupies <strong>1 acre</strong> of land, so your acreage caps how much you can build. Explore or conquer to gain more.</p>
            <p style={{ color: 'var(--gold-bright)', marginTop: 0 }}>Construction is <strong>not instant</strong>: you pay when placing an order, and buildings take <strong>10–24 ticks</strong>. Queued buildings reserve their acres. Race, season, and Architecture can reduce build time; advanced structures retain their race and science requirements. You may order several types together or destroy queued and completed buildings.</p>
            <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Building</th><th style={th}>Cost</th><th style={th}>Effect</th></tr></thead>
              <tbody>
                {(data?.buildings ?? []).map((b: any) => (
                  <tr key={b.id}>
                    <td data-label="Building" style={{ ...td, color: 'var(--gold-bright)' }}>{b.className}</td>
                    <td data-label="Cost" style={td}>{b.costGold.toLocaleString()}g{b.costMetal ? ` · ${b.costMetal.toLocaleString()}m` : ''}</td>
                    <td data-label="Effect" style={td}>{getBuildingRule(b.className)?.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Military' && (
          <section className="stat-card table-card">
            <h2>Military &amp; War</h2>
            <p style={{ color: 'var(--parchment)', marginTop: 0 }}>
              Drafting a unit costs gold, metal, and <strong>1 peasant</strong>. Troops are <strong>not battle-ready instantly</strong>: they train over
              {' '}<strong>12–24 ticks</strong> (Recruits are quickest, elites and specialists slowest) and trickle in gradually — you can&apos;t send units to war until they finish.
              In the War Room choose an attack type:
              {' '}<strong>Standard</strong> (balanced land + plunder), <strong>Massacre</strong> (maximise enemy losses), or <strong>Pillage</strong> (maximise plunder).
              Armies march ~3 ticks, fight, take casualties on both sides, and return with survivors and loot. New provinces have
              <strong> 48 ticks of protection</strong>; you cannot attack a protected province, one on vacation, or a kingdom you are allied with.
            </p>
            <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Unit</th><th style={th}>Atk</th><th style={th}>Def</th><th style={th}>Cost</th><th style={th}>Notes</th></tr></thead>
              <tbody>
                {(data?.military ?? []).filter((m: any) => m.className !== 'Peasants').map((m: any) => (
                  <tr key={m.id}>
                    <td data-label="Unit" style={{ ...td, color: 'var(--gold-bright)' }}>{m.className}</td>
                    <td data-label="Attack" style={td}>{m.attack}</td>
                    <td data-label="Defense" style={td}>{m.defense}</td>
                    <td data-label="Cost" style={td}>{m.costGold.toLocaleString()}g{m.costMetal ? ` · ${m.costMetal.toLocaleString()}m` : ''}</td>
                    <td data-label="Notes" style={td}>{MILITARY_INFO[m.className] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Arcane Arts' && (
          <>
            <section className="stat-card" style={{ marginBottom: '1.5rem' }}>
              <h2>Magic</h2>
              <p style={{ color: 'var(--parchment)', marginTop: 0 }}>
                Casting needs <strong>Wizards</strong> to channel and <strong>mana</strong> to spend (raise both with Wizard Towers, the Sorcery
                science, an Elf race, and the Court Sorceress advisor). Some spells are instant (Fireball, Prosperity…); others are
                timed <strong>buffs</strong> on yourself (Battle Frenzy, Stone Skin, Haste) or <strong>hexes</strong> on enemies (Curse, Vermin Plague)
                that last several ticks. Offensive spells can be resisted by the target&apos;s own wizards.
              </p>
            </section>
            <section className="stat-card">
              <h2>Thievery</h2>
              <p style={{ color: 'var(--parchment)', marginTop: 0 }}>
                Send <strong>Thieves</strong> to Steal Gold/Food/Metal, Sabotage an enemy army, or Spy to reveal their resources and forces.
                Success depends on how many thieves you send versus the target&apos;s <strong>Inns</strong>; failed operations get your thieves caught and executed.
              </p>
            </section>
          </>
        )}

        {tab === 'Science' && (
          <section className="stat-card table-card">
            <h2>Science</h2>
            <p style={{ color: '#adb5bd', marginTop: 0 }}>Research raises a percentage bonus per level in its field, applied automatically each tick or in battle.</p>
            <p style={{ color: 'var(--gold-bright)', marginTop: 0 }}>Each level takes a number of ticks that <strong>varies by science</strong> (roughly <strong>24–40</strong>) after you pay for it. Your wise men can only research <strong>one science at a time</strong> — you must wait for the current project to finish before starting another.</p>
            <table className="wide-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Science</th><th style={th}>Boosts</th><th style={th}>Per level</th><th style={th}>Base cost</th></tr></thead>
              <tbody>
                {(data?.sciences ?? []).map((s: any) => (
                  <tr key={s.id}>
                    <td data-label="Science" style={{ ...td, color: 'var(--gold-bright)' }}>{s.name}</td>
                    <td data-label="Boosts" style={td}>{EFFECT_LABEL[s.effect] ?? s.effect}</td>
                    <td data-label="Per level" style={td}>+{s.bonusPerLevel}% (max {s.maxLevel})</td>
                    <td data-label="Base cost" style={td}>{s.costGold.toLocaleString()}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Council & Races' && (
          <section className="stat-card table-card">
            <h2>Council &amp; Races</h2>
            <p style={{ color: '#adb5bd', marginTop: 0 }}>Appoint <strong>one</strong> advisor for a standing bonus. Your <strong>race</strong> (chosen at founding) shapes everything.</p>
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Advisor</th><th style={th}>Bonus</th></tr></thead>
                <tbody>
                  {(data?.advisors ?? []).map((a: any) => (
                    <tr key={a.id}><td style={{ ...td, color: 'var(--gold-bright)' }}>{a.name}<div style={{ color: '#adb5bd', fontSize: '0.8rem' }}>{a.title}</div></td><td style={td}>+{a.bonus}% {EFFECT_LABEL[a.effect] ?? a.effect}</td></tr>
                  ))}
                </tbody>
              </table>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Race</th><th style={th}>Off / Def / Inc / Magic</th></tr></thead>
                <tbody>
                  {(data?.races ?? []).map((r: any) => (
                    <tr key={r.id}><td style={{ ...td, color: 'var(--gold-bright)' }}>{r.name}</td><td style={td}>{r.offenseBonus} / {r.defenseBonus} / {r.incomeBonus} / {r.magicBonus}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'The World' && (
          <section className="stat-card">
            <h2>Kingdoms, Explore, Seasons &amp; Ages</h2>
            <ul style={{ color: 'var(--parchment)', lineHeight: 1.7, marginTop: 0 }}>
              <li><strong>Kingdoms</strong> — join, found, or stay independent. A kingdom&apos;s <strong>King</strong> (elected by member votes) earns bonus income. Kings can declare <strong>war</strong> (+10% offense vs the enemy) or forge <strong>alliances</strong> (can&apos;t attack each other). Send <strong>Aid</strong> to kingdom-mates.</li>
              <li><strong>Explore</strong> — pay gold to send Recruits to settle new acres over 24 ticks. The Recruits leave your army, results vary slightly, and a Pathfinder advisor makes each explorer cheaper.</li>
              <li><strong>Seasons</strong> — cycle every day of ticks: Spring boosts food &amp; growth, Summer boosts income, Autumn is mild, <strong>Winter</strong> cuts food and growth hard.</li>
              <li><strong>Ages</strong> — the world runs for a long age, then an <strong>Apocalypse</strong> tears it apart; the top provinces are enshrined in the <strong>Hall of Fame</strong> and the world resets for a new age.</li>
            </ul>
          </section>
        )}

        {tab === 'Dependencies' && (
          <section className="stat-card">
            <h2>Key Dependencies — what you need for what</h2>
            <ul style={{ color: 'var(--parchment)', lineHeight: 1.7, marginTop: 0 }}>
              <li><strong>Dragons</strong> require a <strong>Beast Den</strong>.</li>
              <li><strong>Spells</strong> require <strong>Wizards</strong> + <strong>mana</strong> (mana comes from Wizard Towers).</li>
              <li><strong>Thievery</strong> requires <strong>Thieves</strong>.</li>
              <li><strong>Any military</strong> requires <strong>peasants</strong> (1 each) plus gold &amp; metal.</li>
              <li><strong>Buildings</strong> require free <strong>acres</strong> (1 each) — grow land via Explore or conquest.</li>
              <li><strong>Aid, kingdom chat, the King bonus, and diplomacy</strong> require being <strong>in a kingdom</strong>.</li>
              <li><strong>Temples → influence and income</strong>; <strong>Walls → battle defense</strong>; <strong>Inns → thievery defense</strong>; <strong>Barracks → cheaper military gold cost</strong>.</li>
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
