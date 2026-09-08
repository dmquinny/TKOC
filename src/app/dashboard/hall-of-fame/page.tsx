"use client";

import FeedbackNotice from '@/components/FeedbackNotice';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { useGameData } from '@/lib/client/useGameData';

interface AgeEntry {
  id: number;
  rank: number;
  provinceName: string;
  rulerName: string;
  kingdomName: string | null;
  acres: number;
  networth: number;
  thieveryRank: string | null;
  thieveryPoints: number;
  magicRank: string | null;
  magicPoints: number;
  militaryPoints: number;
}

interface HallOfFameData {
  state: { age: number; phase: string } | null;
  ages: Array<{ age: number; entries: AgeEntry[] }>;
}

export default function HallOfFame() {
  const { data, error, loading } = useGameData<HallOfFameData>('/api/hall-of-fame');

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || 'The chronicles could not be opened.'} />;
  }

  const apocalypse = data.state?.phase === 'Apocalypse';

  return (
    <>
      <PageBanner
        image="/game/headers/header-hall-of-fame.webp"
        title="Hall of Fame"
        subtitle="The greatest rulers of past ages."
        right={<div className="networth-badge">Age {data.state?.age ?? 1} · {data.state?.phase ?? 'Running'}</div>}
      />

      <Notices error={error} />
      {apocalypse && (
        <FeedbackNotice tone="warning">
          The Apocalypse is upon the world and this age is ending. Make your mark before it all turns to dust.
        </FeedbackNotice>
      )}

      {data.ages.length === 0 ? (
        <section className="stat-card">
          <p className="empty-state">No ages have ended yet. The champions of the current age (Age {data.state?.age ?? 1}) will be enshrined here when it concludes.</p>
        </section>
      ) : (
        data.ages.map(age => (
          <section key={age.age} className="stat-card table-card mb-2">
            <h2>Age {age.age}</h2>
            <table className="wide-table mobile-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Province</th>
                  <th>Ruler</th>
                  <th>Kingdom</th>
                  <th className="text-right">Acres</th>
                  <th className="text-right">Networth</th>
                  <th className="text-right">Thievery</th>
                  <th className="text-right">Magic</th>
                  <th className="text-right">Military</th>
                </tr>
              </thead>
              <tbody>
                {age.entries.map(entry => (
                  <tr key={entry.id} className={entry.rank === 1 ? 'hof-first' : ''}>
                    <td data-label="Rank">{entry.rank === 1 ? '♛ 1' : entry.rank}</td>
                    <td data-label="Province">{entry.provinceName}</td>
                    <td data-label="Ruler">{entry.rulerName}</td>
                    <td data-label="Kingdom">{entry.kingdomName || '—'}</td>
                    <td data-label="Acres" className="text-right">{(entry.acres ?? 0).toLocaleString()}</td>
                    <td data-label="Networth" className="text-right">{(entry.networth ?? 0).toLocaleString()}</td>
                    <td data-label="Thievery" className="text-right">{entry.thieveryRank || '-'} ({(entry.thieveryPoints ?? 0).toLocaleString()})</td>
                    <td data-label="Magic" className="text-right">{entry.magicRank || '-'} ({(entry.magicPoints ?? 0).toLocaleString()})</td>
                    <td data-label="Military" className="text-right">{(entry.militaryPoints ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </>
  );
}
