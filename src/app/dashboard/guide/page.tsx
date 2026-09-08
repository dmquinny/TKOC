"use client";

import { useState } from 'react';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import SectionTabs from '@/components/SectionTabs';
import { getBuildingRule } from '@/lib/buildings';
import { useGameData } from '@/lib/client/useGameData';

const RESOURCES: [string, string][] = [
  ['Gold', 'Peasants pay tax each tick. Spent on buildings, military, science, exploration, and aid.'],
  ['Food', 'Produced by Farms. Peasants and soldiers eat it every tick; if it runs out, they starve.'],
  ['Metal', 'Produced by Mines. Needed for most buildings and units.'],
  ['Peasants', 'Your population. They pay tax, are drafted into the army (1 peasant per unit), and eat food. They grow each tick up to your housing limit.'],
  ['Acres', 'Your land. Holds buildings (1 acre each) and houses peasants. Gained by Exploring or conquering rivals.'],
  ['Mana', 'Fuel for spells. Regenerates each tick; Wizard Towers raise the cap and rate.'],
  ['Influence', 'Raised by Temples. Needed for thievery operations and boosts gold income (up to +15%).'],
  ['Networth', 'Your overall power, used for rankings and to size you up against rivals.'],
];

const MILITARY_INFO: Record<string, string> = {
  Peasants: 'Your population: taxed, drafted, and fed. Not a fighting unit.',
  Thieves: 'Required for every thievery operation.',
  Wizards: 'Required to cast spells; more wizards means stronger magic.',
  Catapults: 'Enormous attack, almost no defense: siege only.',
  Dragons: 'Devastating on both attack and defense.',
};

const EFFECT_LABEL: Record<string, string> = {
  income: 'Income', offense: 'Offense', defense: 'Defense', magic: 'Magic',
  foodProduction: 'Food', metalProduction: 'Metal', explore: 'Exploration',
};

const TABS = ['basics', 'buildings', 'military', 'arcane', 'science', 'council', 'world', 'dependencies'] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = {
  basics: 'Basics',
  buildings: 'Buildings',
  military: 'Military',
  arcane: 'Arcane Arts',
  science: 'Science',
  council: 'Council & Races',
  world: 'The World',
  dependencies: 'Dependencies',
};

interface GuideData {
  buildings: Array<{ id: number; className: string | null; costGold: number; costMetal: number }>;
  military: Array<{ id: number; className: string | null; displayName: string | null; raceName: string | null; attack: number; defense: number; costGold: number; costMetal: number }>;
  sciences: Array<{ id: number; name: string; effect: string; bonusPerLevel: number; maxLevel: number; costGold: number; researchTicks: number }>;
  advisors: Array<{ id: number; name: string; title: string; effect: string; bonus: number; effect2: string | null; bonus2: number }>;
  races: Array<{ id: number; name: string; offenseBonus: number; defenseBonus: number; incomeBonus: number; magicBonus: number }>;
}

export default function Guide() {
  const { data, error, loading } = useGameData<GuideData>('/api/guide');
  const [tab, setTab] = useState<Tab>('basics');

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || 'The tome could not be opened.'} />;
  }

  return (
    <>
      <PageBanner image="/game/headers/header-guide.webp" title="Guide" subtitle="How to rule, wage war, and prosper." />

      <SectionTabs
        label="Guide chapter"
        tabs={TABS.map(id => ({ id, label: TAB_LABEL[id] }))}
        active={tab}
        onChange={setTab}
      />

      {tab === 'basics' && (
        <>
          <section className="stat-card mb-2">
            <h2>How to Play</h2>
            <p className="guide-text">
              You rule a <strong>province</strong>. A <strong>tick</strong> is one turn of the game clock, and it happens once every
              <strong> real hour</strong>, so <strong>24 ticks make an in-game day</strong> and 7 days a week. Everything happens on ticks:
              your peasants pay tax and grow, your farms and mines produce, your spells and expeditions resolve, and effects count down.
              Attacks are the exception: they resolve the moment you launch them, and only the army&apos;s return takes time. Your goals are
              to grow your economy, raise an army, research sciences, and outmanoeuvre rival provinces, alone or as part of a{' '}
              <strong>kingdom</strong>. Watch your <strong>food</strong>: if it hits zero, your people starve.
            </p>
          </section>
          <section className="stat-card table-card">
            <h2>Resources</h2>
            <table className="guide-table">
              <tbody>
                {RESOURCES.map(([name, description]) => (
                  <tr key={name}><td className="guide-term">{name}</td><td>{description}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {tab === 'buildings' && (
        <section className="stat-card table-card">
          <h2>Buildings</h2>
          <p className="guide-note">Each building occupies <strong>1 acre</strong> of land, so your acreage caps how much you can build. Explore or conquer to gain more.</p>
          <p className="guide-highlight">Construction is <strong>not instant</strong>: you pay when placing an order, and buildings take <strong>10–24 ticks</strong>. Queued buildings reserve their acres. Race, season, and Architecture can reduce build time; advanced structures keep their race and science requirements.</p>
          <table className="guide-table mobile-data-table">
            <thead><tr><th>Building</th><th>Cost</th><th>Effect</th></tr></thead>
            <tbody>
              {data.buildings.map(building => (
                <tr key={building.id}>
                  <td data-label="Building">{building.className}</td>
                  <td data-label="Cost">{building.costGold.toLocaleString()}g{building.costMetal ? ` · ${building.costMetal.toLocaleString()}m` : ''}</td>
                  <td data-label="Effect">{getBuildingRule(building.className)?.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'military' && (
        <section className="stat-card table-card">
          <h2>Military &amp; War</h2>
          <p className="guide-text">
            Drafting a unit costs gold, metal, and <strong>1 peasant</strong>. Troops train over <strong>12–24 ticks</strong> and trickle
            in gradually; you cannot send units to war until they finish. In the War Room choose <strong>Standard</strong> (land and plunder),
            <strong> Massacre</strong> (maximise enemy losses), or <strong>Pillage</strong> (maximise plunder). Battles resolve immediately and
            the survivors return after <strong>6–10 ticks</strong> with the spoils. New provinces have <strong>50 ticks of protection</strong>;
            you cannot attack a protected province, one on vacation, or a kingdom you are allied with.
          </p>
          <table className="guide-table mobile-data-table">
            <thead><tr><th>Unit</th><th>Race</th><th>Atk</th><th>Def</th><th>Cost</th><th>Notes</th></tr></thead>
            <tbody>
              {data.military.filter(unit => unit.className !== 'Peasants').map(unit => (
                <tr key={unit.id}>
                  <td data-label="Unit">{unit.displayName || unit.className}</td>
                  <td data-label="Race">{unit.raceName ?? '—'}</td>
                  <td data-label="Attack">{unit.attack}</td>
                  <td data-label="Defense">{unit.defense}</td>
                  <td data-label="Cost">{unit.costGold.toLocaleString()}g{unit.costMetal ? ` · ${unit.costMetal.toLocaleString()}m` : ''}</td>
                  <td data-label="Notes">{MILITARY_INFO[unit.displayName ?? ''] ?? MILITARY_INFO[unit.className ?? ''] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'arcane' && (
        <>
          <section className="stat-card mb-2">
            <h2>Magic</h2>
            <p className="guide-text">
              Casting needs <strong>Wizards</strong> to channel and <strong>mana</strong> to spend. Some spells are instant; others are
              timed <strong>buffs</strong> on yourself or <strong>hexes</strong> on enemies that last several ticks. Offensive spells can be
              resisted by the target&apos;s own wizards, and wizards committed to a timed spell stay busy until it expires.
            </p>
          </section>
          <section className="stat-card">
            <h2>Thievery</h2>
            <p className="guide-text">
              Send <strong>Thieves</strong> to steal resources, sabotage an enemy army, or spy to reveal their resources and forces.
              Every operation sends all ready thieves and costs influence. Success depends on your thieves per acre against the
              target&apos;s, their <strong>Inns</strong>, and your thievery sciences; failed operations get thieves caught and executed.
            </p>
          </section>
        </>
      )}

      {tab === 'science' && (
        <section className="stat-card table-card">
          <h2>Science</h2>
          <p className="guide-note">Each science is researched once and grants a permanent bonus or unlocks new knowledge.</p>
          <p className="guide-highlight">Research takes a number of ticks that <strong>varies by science</strong> after you pay for it. Your wise men can only research <strong>one science at a time</strong>.</p>
          <table className="guide-table mobile-data-table">
            <thead><tr><th>Science</th><th>Effect</th><th>Bonus</th><th>Time</th><th>Cost</th></tr></thead>
            <tbody>
              {data.sciences.map(science => (
                <tr key={science.id}>
                  <td data-label="Science">{science.name}</td>
                  <td data-label="Effect">{EFFECT_LABEL[science.effect] ?? science.effect}</td>
                  <td data-label="Bonus">{science.bonusPerLevel ? `${science.bonusPerLevel > 0 ? '+' : ''}${science.bonusPerLevel}%` : 'Unlocks knowledge'}</td>
                  <td data-label="Time">{science.researchTicks} ticks</td>
                  <td data-label="Cost">{science.costGold.toLocaleString()}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'council' && (
        <section className="stat-card table-card">
          <h2>Council &amp; Races</h2>
          <p className="guide-note">Appoint <strong>one</strong> advisor for a standing bonus. Your <strong>race</strong> (chosen at founding) shapes everything.</p>
          <div className="responsive-grid page-grid">
            <table className="guide-table">
              <thead><tr><th>Advisor</th><th>Bonus</th></tr></thead>
              <tbody>
                {data.advisors.map(advisor => (
                  <tr key={advisor.id}>
                    <td>{advisor.name}<span className="guide-sub">{advisor.title}</span></td>
                    <td>
                      {advisor.bonus ? `${advisor.bonus > 0 ? '+' : ''}${advisor.bonus}% ${EFFECT_LABEL[advisor.effect] ?? advisor.effect}` : 'No bonus'}
                      {advisor.effect2 ? `, ${advisor.bonus2 > 0 ? '+' : ''}${advisor.bonus2}% ${EFFECT_LABEL[advisor.effect2] ?? advisor.effect2}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="guide-table">
              <thead><tr><th>Race</th><th>Off / Def / Inc / Magic</th></tr></thead>
              <tbody>
                {data.races.map(race => (
                  <tr key={race.id}><td>{race.name}</td><td>{race.offenseBonus} / {race.defenseBonus} / {race.incomeBonus} / {race.magicBonus}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'world' && (
        <section className="stat-card">
          <h2>Kingdoms, Explore, Seasons &amp; Ages</h2>
          <ul className="guide-list">
            <li><strong>Kingdoms</strong>: chosen when you found your province and fixed for the age, with up to three provinces each. The <strong>King</strong> (elected by member votes) earns bonus income. Kings can declare <strong>war</strong> or forge <strong>alliances</strong> (allies cannot attack each other). Send <strong>Aid</strong> to kingdom-mates.</li>
            <li><strong>Explore</strong>: pay gold to send soldiers to settle new acres over 24 ticks. The soldiers leave your army and results vary slightly.</li>
            <li><strong>Seasons</strong>: change every 96 ticks. Spring lifts morale, Summer speeds building and growth, Autumn makes military cheaper and metal richer, Winter slows attacks and strengthens defence.</li>
            <li><strong>Ages</strong>: the world runs for 1,000 ticks, then a 500-tick <strong>Apocalypse</strong> tears it apart with scripted disasters. The top provinces are enshrined in the <strong>Hall of Fame</strong> and the world resets for a new age. The Overview shows exactly when each disaster strikes.</li>
          </ul>
        </section>
      )}

      {tab === 'dependencies' && (
        <section className="stat-card">
          <h2>Key Dependencies</h2>
          <ul className="guide-list">
            <li><strong>Mines</strong> require the <strong>Mining</strong> science; Dwarves start with it.</li>
            <li><strong>Massacre</strong> requires <strong>Strategic War</strong>; <strong>Pillage</strong> requires Basic Attacking and Espionage.</li>
            <li><strong>Spells</strong> require <strong>Wizards</strong> plus <strong>mana</strong>; <strong>Thievery</strong> requires <strong>Thieves</strong> plus influence.</li>
            <li><strong>Any military</strong> requires <strong>peasants</strong> (1 each) plus gold and metal; specialists also need Inn or Wizard Tower housing.</li>
            <li><strong>Buildings</strong> require free <strong>acres</strong> (1 each); grow land via Explore or conquest.</li>
            <li><strong>Aid, kingdom chat, the King bonus, and diplomacy</strong> require being <strong>in a kingdom</strong>.</li>
            <li><strong>Temples</strong> raise influence and income; <strong>Walls</strong> raise defence; <strong>Inns</strong> house thieves; <strong>Barracks</strong> cut military gold cost.</li>
          </ul>
        </section>
      )}
    </>
  );
}
