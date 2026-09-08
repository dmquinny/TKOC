"use client";

import { useState } from 'react';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import SectionTabs from '@/components/SectionTabs';
import { useGameData } from '@/lib/client/useGameData';
import { describeMovement, type KingdomStanding } from '@/lib/ranking';

type Category = 'networth' | 'thievery' | 'magic' | 'military' | 'kingdoms';

interface Ranking {
  id: number;
  provinceName: string | null;
  rulerName: string | null;
  networth: number | null;
  acres: number | null;
  kiID: number;
  reputation: number;
  magicRep: number;
  militaryRep: number;
  movement: number | null;
}

interface RankingsData {
  networth: Ranking[];
  thievery: Ranking[];
  magic: Ranking[];
  military: Ranking[];
  kingdomStandings: KingdomStanding[];
  kingdoms: Record<number, string>;
  me: number | null;
  total: number;
}

const LABELS: Record<Category, string> = {
  networth: 'Networth',
  thievery: 'Thievery',
  magic: 'Magic',
  military: 'Military',
  kingdoms: 'Kingdoms',
};

const score = (category: Category, entry: Ranking) => (
  category === 'networth' ? entry.networth ?? 0
    : category === 'thievery' ? entry.reputation
      : category === 'magic' ? entry.magicRep
        : entry.militaryRep
);

function Movement({ value }: { value: number | null }) {
  const tone = value === null ? 'is-flat' : value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat';
  const arrow = value === null ? '' : value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
  return <span className={`rank-move ${tone}`}>{arrow}{describeMovement(value)}</span>;
}

export default function RankingsPage() {
  const { data, error, loading } = useGameData<RankingsData>('/api/rankings');
  const [category, setCategory] = useState<Category>('networth');

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || 'Rankings could not be loaded.'} />;
  }

  const positions = (['networth', 'thievery', 'magic', 'military'] as const).map(key => {
    const index = data.me ? data[key].findIndex(entry => entry.id === data.me) : -1;
    return { key, position: index >= 0 ? index + 1 : null };
  });
  const myKingdomId = data.me ? data.networth.find(entry => entry.id === data.me)?.kiID ?? 0 : 0;

  return (
    <>
      <PageBanner image="/game/headers/header-rankings.webp" title="Global Rankings" subtitle={`Networth, thieves, wizards, armies, and kingdoms of the ${data.total.toLocaleString()} living provinces.`} />

      <Notices error={error} />

      {data.me && (
        <div className="rank-summary" aria-label="Your standings">
          {positions.map(entry => (
            <span key={entry.key}>
              <small>{LABELS[entry.key]}</small>
              <strong>{entry.position ? `#${entry.position}` : 'Outside top 100'}</strong>
            </span>
          ))}
        </div>
      )}

      <SectionTabs
        label="Ranking category"
        tabs={(Object.keys(LABELS) as Category[]).map(key => ({ id: key, label: LABELS[key] }))}
        active={category}
        onChange={setCategory}
      />

      <section className="stat-card table-card">
        {category === 'kingdoms' ? (
          <table className="rankings-table mobile-data-table">
            <thead>
              <tr><th>#</th><th>Kingdom</th><th className="text-right">Provinces</th><th className="text-right">Acres</th><th className="text-right">Networth</th></tr>
            </thead>
            <tbody>
              {data.kingdomStandings.map((kingdom, index) => (
                <tr key={kingdom.id} className={kingdom.id === myKingdomId ? 'rank-me' : ''}>
                  <td data-label="Rank">{index + 1}</td>
                  <td data-label="Kingdom">{kingdom.name}</td>
                  <td data-label="Provinces" className="text-right">{kingdom.provinces}</td>
                  <td data-label="Acres" className="text-right">{kingdom.acres.toLocaleString()}</td>
                  <td data-label="Networth" className="text-right text-gold">{kingdom.networth.toLocaleString()}</td>
                </tr>
              ))}
              {!data.kingdomStandings.length && <tr><td className="empty-table-cell" colSpan={5}>No kingdoms have been founded yet.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="rankings-table mobile-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Province</th>
                <th>Ruler</th>
                <th>Kingdom</th>
                <th className="text-right">Acres</th>
                <th className="text-right">{LABELS[category]}</th>
                {category === 'networth' && <th className="text-right">Today</th>}
              </tr>
            </thead>
            <tbody>
              {data[category].map((entry, index) => (
                <tr key={entry.id} className={entry.id === data.me ? 'rank-me' : ''}>
                  <td data-label="Rank">{index + 1}</td>
                  <td data-label="Province">{entry.provinceName}{entry.id === data.me ? ' (you)' : ''}</td>
                  <td data-label="Ruler">{entry.rulerName}</td>
                  <td data-label="Kingdom">{data.kingdoms[entry.kiID] || `#${entry.kiID}`}</td>
                  <td data-label="Acres" className="text-right">{(entry.acres ?? 0).toLocaleString()}</td>
                  <td data-label={LABELS[category]} className="text-right text-gold">{score(category, entry).toLocaleString()}</td>
                  {category === 'networth' && <td data-label="Today" className="text-right"><Movement value={entry.movement} /></td>}
                </tr>
              ))}
              {!data[category].length && <tr><td className="empty-table-cell" colSpan={7}>No provinces are ranked yet.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
