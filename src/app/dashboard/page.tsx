"use client";

import { useEffect } from 'react';
import { Coins, Landmark, Map, Pickaxe, Sparkles, Users, Wheat } from 'lucide-react';
import ActivityCentre from '@/components/ActivityCentre';
import AgeOutlookPanel from '@/components/AgeOutlookPanel';
import FeedbackNotice from '@/components/FeedbackNotice';
import FirstStepsChecklist from '@/components/FirstStepsChecklist';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import ResourceCard from '@/components/ResourceCard';
import { markNewsSeen } from '@/lib/client/events';
import { useGameData } from '@/lib/client/useGameData';
import { describeTicks } from '@/lib/forecast';
import { describeMovement } from '@/lib/ranking';
import type { OverviewData } from '@/app/api/overview/route';

const EFFECT_LABELS: Record<string, string> = {
  battleFrenzy: 'Battle Frenzy (+offense)',
  stoneSkin: 'Stone Skin (+defense)',
  haste: 'Haste (+income)',
  curse: 'Cursed (−off/def)',
  verminPlague: 'Vermin Plague (−food)',
};

function effectLabel(type: string): string {
  return EFFECT_LABELS[type] ?? type.replace(/Spell$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

export default function Dashboard() {
  const { data, error, loading } = useGameData<OverviewData>('/api/overview');
  const latestNewsId = data?.news[0]?.id ?? 0;

  useEffect(() => {
    if (latestNewsId) markNewsSeen(latestNewsId);
  }, [latestNewsId]);

  if (!data) {
    return loading ? <PageSkeleton cards={7} /> : <Notices error={error || 'The realm could not be loaded.'} />;
  }

  const { province, forecast, activity, checklist, rank, effects, news, outlook, intervalSeconds, season } = data;
  const delta = (value: number) => (forecast.hasTicked && !forecast.vacation ? value : null);
  const freeAcres = Math.max(0, province.acres - province.landUsed);
  const foodHint = forecast.foodStatus === 'starving'
    ? 'Your people are starving. Build Farms immediately.'
    : forecast.foodRunwayTicks !== null
      ? `Runs out in ${describeTicks(forecast.foodRunwayTicks)} at this rate.`
      : undefined;
  const goldHint = forecast.goldRunwayTicks !== null
    ? `Treasury empties in ${describeTicks(forecast.goldRunwayTicks)} at this rate.`
    : undefined;
  const movement = rank.movement;
  const rankLine = rank.networth
    ? `Rank ${rank.networth} of ${rank.total}${movement !== null && movement !== 0 ? ` · ${describeMovement(movement)} today` : ''}`
    : 'Unranked until the next tick';

  return (
    <>
      <PageBanner
        image="/game/headers/header-overview.webp"
        title={province.rulerName}
        subtitle={`Ruler of ${province.provinceName} · ${province.race}${province.kingdom ? ` of ${province.kingdom.name}` : ''} · ${season} · Morale ${province.morale}`}
        right={<div className="networth-badge">Networth {province.networth.toLocaleString()} · {rankLine}</div>}
      />

      {forecast.vacation && (
        <FeedbackNotice tone="info">
          Your province is on vacation. The economy, construction, and training are frozen until you return in Preferences.
        </FeedbackNotice>
      )}
      {forecast.foodStatus === 'starving' && (
        <FeedbackNotice tone="error">
          Your granaries are empty and your people are starving: gold income is halved and troops desert each tick. Build Farms now.
        </FeedbackNotice>
      )}
      {forecast.foodStatus === 'critical' && forecast.foodRunwayTicks !== null && (
        <FeedbackNotice tone="warning">
          Food will run out in {describeTicks(forecast.foodRunwayTicks)} at the current rate. Build Farms or reduce your army before then.
        </FeedbackNotice>
      )}

      <FirstStepsChecklist items={checklist} />

      <section className="stats-grid" aria-label="Resources and per-tick change">
        <ResourceCard tone="gold" icon={Coins} label="Gold" value={province.gold} delta={delta(forecast.gold)} hint={goldHint} warning={Boolean(goldHint)} />
        <ResourceCard tone="food" icon={Wheat} label="Food" value={province.food} delta={delta(forecast.food)} hint={foodHint} warning={forecast.foodStatus !== 'stable'} />
        <ResourceCard tone="metal" icon={Pickaxe} label="Metal" value={province.metal} delta={delta(forecast.metal)} />
        <ResourceCard tone="peasants" icon={Users} label="Peasants" value={province.peasants} delta={delta(forecast.peasants)} />
        <ResourceCard tone="land" icon={Map} label="Land (acres)" value={province.acres} hint={`${freeAcres.toLocaleString()} acres free to build on`} />
        <ResourceCard tone="mana" icon={Sparkles} label="Mana" value={province.mana} hint="Regenerates every tick" />
        <ResourceCard tone="influence" icon={Landmark} label="Influence" value={province.influence} hint="Fuels thievery operations" />
      </section>

      <div className="overview-grid">
        <ActivityCentre activity={activity} />
        <div className="stack">
          <AgeOutlookPanel outlook={outlook} intervalSeconds={intervalSeconds} compact />

          {effects.length > 0 && (
            <section className="game-panel" aria-labelledby="effects-heading">
              <div className="game-panel-heading">
                <div>
                  <p className="eyebrow">Magic</p>
                  <h2 id="effects-heading">Active Effects</h2>
                </div>
              </div>
              <div className="chip-row">
                {effects.map(effect => (
                  <span key={effect.id} className="chip">
                    {effectLabel(effect.type)} · {effect.ticksLeft}t
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="recent-events" aria-labelledby="news-heading">
            <h2 id="news-heading">Recent News</h2>
            {news.length === 0 ? (
              <div className="event-item">All is quiet in your realm.</div>
            ) : (
              <div className="news-list">
                {news.map(item => (
                  <div key={item.id} className="event-item">
                    {item.message}
                    <span className="news-time">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
