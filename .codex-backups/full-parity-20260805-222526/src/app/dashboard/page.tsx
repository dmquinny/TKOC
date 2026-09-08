"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import { Coins, Wheat, Pickaxe, Users, Map, Sparkles, Landmark } from 'lucide-react';
import ActivityCentre, { type ActivityData } from '@/components/ActivityCentre';
import OnboardingTip from '@/components/OnboardingTip';

interface Province {
  provinceName: string;
  rulerName: string;
  acres: number;
  peasants: number;
  gold: number;
  food: number;
  metal: number;
  mana: number;
  influence: number;
  networth: number;
}

const EFFECT_LABELS: Record<string, string> = {
  battleFrenzy: 'Battle Frenzy (+offense)',
  stoneSkin: 'Stone Skin (+defense)',
  haste: 'Haste (+income)',
  curse: 'Cursed (−off/def)',
  verminPlague: 'Vermin Plague (−food)',
};

export default function Dashboard() {
  const router = useRouter();
  const [province, setProvince] = useState<Province | null>(null);
  const [season, setSeason] = useState('');
  const [news, setNews] = useState<{ id: number; message: string }[]>([]);
  const [effects, setEffects] = useState<{ id: number; type: string; magnitude: number; ticksLeft: number }[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProvince = async () => {
      try {
        const [res, newsRes, activityRes] = await Promise.all([
          fetch('/api/province'),
          fetch('/api/news'),
          fetch('/api/activity'),
        ]);
        if (res.status === 401) {
          router.push('/');
          return;
        }
        if (res.status === 404) {
          router.push('/province/create');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch province');
        }
        
        const data = await res.json();
        setProvince(data.province);
        setSeason(data.season || '');
        setEffects(data.effects || []);

        if (newsRes.ok) {
          const nd = await newsRes.json();
          setNews(nd.news || []);
        }
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setActivity(activityData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProvince();
  }, [router]);

  if (loading) {
    return <div className="loading-screen">Loading Realm Data...</div>;
  }

  if (error || !province) {
    return <div className="loading-screen error">Error: {error}</div>;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard" />

      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-overview.webp"
          title={province.rulerName}
          subtitle={`Ruler of ${province.provinceName}${season ? ` · ${season}` : ''}`}
          right={<div className="networth-badge">Networth: {province.networth?.toLocaleString() || 1000}</div>}
        />

        <OnboardingTip
          id="overview-first-steps"
          title="Choose one clear next step"
          description="Build on unused land, begin one research project, and keep enough food and gold for the next tick. The Activity Centre tracks every order until it finishes."
          href="/dashboard/guide"
          linkLabel="Open the realm guide"
        />

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-head">
              <Coins className="resource-icon" style={{ color: '#c8952f' }} size={20} />
              <span className="stat-label">Gold</span>
            </div>
            <span className="stat-value">{province.gold.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Wheat className="resource-icon" style={{ color: '#d1b26f' }} size={20} />
              <span className="stat-label">Food</span>
            </div>
            <span className="stat-value">{province.food.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Pickaxe className="resource-icon" style={{ color: '#9a9a9a' }} size={20} />
              <span className="stat-label">Metal</span>
            </div>
            <span className="stat-value">{province.metal.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Users className="resource-icon" style={{ color: '#e5d1b8' }} size={20} />
              <span className="stat-label">Peasants</span>
            </div>
            <span className="stat-value">{province.peasants.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Map className="resource-icon" style={{ color: '#b97a44' }} size={20} />
              <span className="stat-label">Land (Acres)</span>
            </div>
            <span className="stat-value">{province.acres.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Sparkles className="resource-icon" style={{ color: '#7db8e8' }} size={20} />
              <span className="stat-label">Mana</span>
            </div>
            <span className="stat-value">{province.mana?.toLocaleString() ?? 0}</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-head">
              <Landmark className="resource-icon" style={{ color: '#c9a0dc' }} size={20} />
              <span className="stat-label">Influence</span>
            </div>
            <span className="stat-value">{province.influence?.toLocaleString() ?? 0}</span>
          </div>
        </section>

        <ActivityCentre activity={activity} />

        {effects.length > 0 && (
          <section className="recent-events" style={{ marginBottom: '2rem' }}>
            <h2>Active Effects</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {effects.map(e => (
                <span key={e.id} className="networth-badge">
                  {EFFECT_LABELS[e.type] ?? e.type} · {e.ticksLeft}t
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="recent-events">
          <h2>Recent News</h2>
          {news.length === 0 ? (
            <div className="event-item">All is quiet in your realm.</div>
          ) : (
            news.map(n => <div key={n.id} className="event-item">{n.message}</div>)
          )}
        </section>
      </main>
    </div>
  );
}
