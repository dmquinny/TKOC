"use client";

import { useEffect, useState } from 'react';
import PageBanner from '@/components/PageBanner';
import Sidebar from '@/components/Sidebar';

interface Ranking {
  id: number;
  provinceName: string;
  rulerName: string;
  networth: number;
  acres: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rankings')
      .then(res => res.json())
      .then(data => {
        setRankings(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load rankings", err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/rankings" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-rankings.webp"
          title="Global Rankings"
          subtitle="Behold the greatest empires in all of Chaos."
        />

        <div className="card table-card" style={{ padding: '2rem', background: 'rgba(20, 16, 10, 0.95)', border: '1px solid var(--stone-border)', borderRadius: '8px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gold)' }}>
              Loading Rankings...
            </div>
          ) : (
            <table className="rankings-table mobile-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--stone-border)', color: 'var(--gold-bright)' }}>
                  <th style={{ padding: '1rem' }}>Rank</th>
                  <th style={{ padding: '1rem' }}>Ruler</th>
                  <th style={{ padding: '1rem' }}>Province Name</th>
                  <th style={{ padding: '1rem' }}>Land (Acres)</th>
                  <th style={{ padding: '1rem' }}>Networth</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((prov, index) => (
                  <tr key={prov.id} style={{ borderBottom: '1px solid var(--stone-border)', backgroundColor: index % 2 === 0 ? 'rgba(0,0,0,0.3)' : 'transparent' }}>
                    <td data-label="Rank" style={{ padding: '1rem', fontWeight: 'bold', color: index < 3 ? 'var(--gold-bright)' : 'var(--parchment)' }}>
                      #{index + 1}
                    </td>
                    <td data-label="Ruler" style={{ padding: '1rem' }}>{prov.rulerName}</td>
                    <td data-label="Province" style={{ padding: '1rem' }}>{prov.provinceName}</td>
                    <td data-label="Land" style={{ padding: '1rem' }}>{prov.acres.toLocaleString()} acres</td>
                    <td data-label="Networth" style={{ padding: '1rem', color: 'var(--gold)' }}>{prov.networth?.toLocaleString() || 0}</td>
                  </tr>
                ))}
                {rankings.length === 0 && (
                  <tr>
                    <td className="empty-table-cell" colSpan={5}>No empires found in the realm.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
