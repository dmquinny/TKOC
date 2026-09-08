"use client";

import CatalogCard from '@/components/CatalogCard';
import Notices from '@/components/Notices';
import OnboardingTip from '@/components/OnboardingTip';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface ScienceRow {
  scID: number;
  name: string;
  image: string;
  effect: string;
  category: string;
  description: string;
  level: number;
  maxLevel: number;
  costGold: number;
  costMetal: number;
  researchTicks: number;
  available: boolean;
  prerequisites: Array<{
    category: 'military' | 'infrastructure' | 'magic' | 'thievery';
    names: string[];
    met: boolean;
  }>;
  unlocks: string[];
  researching?: number | null;
}

interface ActiveResearch {
  orderId: number;
  scID: number;
  name: string;
  image: string;
  ticksLeft: number;
  visibleInCatalog: boolean;
}

interface ScienceData {
  sciences: ScienceRow[];
  activeResearch: ActiveResearch[];
  gold: number;
  metal: number;
}

export default function Science() {
  const { data, error, loading, refresh } = useGameData<ScienceData>('/api/science');
  const action = useGameAction();

  if (!data) {
    return loading ? <PageSkeleton cards={6} /> : <Notices error={error || 'The library could not be loaded.'} />;
  }

  const active = data.activeResearch;
  const anyResearching = active.length > 0 || data.sciences.some(science => science.researching != null);

  const research = async (science: ScienceRow) => {
    await action.run(`research-${science.scID}`, () => apiPost<{ message?: string }>('/api/science', { scID: science.scID }), result => {
      void refresh();
      requestNotificationRefresh();
      return result.message || `Your wise men have begun researching ${science.name}.`;
    });
  };

  const buttonLabel = (science: ScienceRow, maxed: boolean) => {
    if (science.researching != null) return `Researching — ${science.researching} tick${science.researching === 1 ? '' : 's'} left`;
    if (maxed) return 'Knowledge complete';
    if (anyResearching) return 'Another research is underway';
    if (!science.available) return 'Requirements not met';
    if (action.busy === `research-${science.scID}`) return 'Starting…';
    return `Research (${science.costGold.toLocaleString()} gold, ${science.costMetal.toLocaleString()} metal)`;
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-science.webp"
        title="Science & Technology"
        subtitle="Research the sciences to strengthen your realm."
        right={<div className="networth-badge">Gold: {data.gold.toLocaleString()} · Metal: {data.metal.toLocaleString()}</div>}
      />
      <OnboardingTip
        id="science"
        title="Research is one project at a time"
        description="Requirements show knowledge you must already have. Gives shows the knowledge unlocked when the research completes."
        href="/dashboard/guide"
        linkLabel="Read the science guide"
      />

      <Notices error={error || action.error} notice={action.notice} />

      {active.map(item => (
        <section className="stat-card research-active" key={item.orderId}>
          <img src={item.image} alt="" aria-hidden="true" />
          <div>
            <strong>Research in progress: {item.name}</strong>
            <span>{item.ticksLeft} tick{item.ticksLeft === 1 ? '' : 's'} remaining. You can only research one science at a time.</span>
            {!item.visibleInCatalog && (
              <small>This existing research is outside your current science catalogue, but it will continue and complete normally.</small>
            )}
          </div>
        </section>
      ))}

      <div className="catalog-grid">
        {data.sciences.map(science => {
          const maxed = science.level >= science.maxLevel;
          const requirementsMet = science.prerequisites.every(requirement => requirement.met);
          const disabled = maxed
            || anyResearching
            || !science.available
            || action.busy !== null
            || data.gold < science.costGold
            || data.metal < science.costMetal;
          return (
            <CatalogCard
              key={science.scID}
              image={science.image}
              imageAlt={science.name}
              title={science.name}
              meta={maxed ? 'Known' : science.category}
              summary={`Level ${science.level}/${science.maxLevel} · ${science.researching != null ? `${science.researching} ticks left` : maxed ? 'Complete' : science.category}`}
              description={science.description}
              highlighted={science.researching != null}
              muted={maxed}
              facts={[
                { label: 'Gold', value: science.costGold.toLocaleString() },
                { label: 'Metal', value: science.costMetal.toLocaleString() },
                { label: 'Research time', value: `${science.researchTicks} ticks` },
                { label: 'Requires', value: science.prerequisites.length ? (requirementsMet ? 'Ready' : 'Missing research') : 'None' },
              ]}
            >
              <p className="catalog-requirements">
                <strong>Requires:</strong>{' '}
                {science.prerequisites.length
                  ? science.prerequisites.map((requirement, index) => (
                    <span key={requirement.category}>
                      {index > 0 && ' · '}
                      <span className={requirement.met ? 'is-met' : 'is-missing'}>
                        {requirement.names.join(' or ')} {requirement.met ? '✓' : '— missing'}
                      </span>
                    </span>
                  ))
                  : <span className="is-met">None</span>}
                <br />
                <strong>Helps unlock:</strong>{' '}
                <span className="is-quiet">{science.unlocks.length ? science.unlocks.join(', ') : 'No further research'}</span>
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => void research(science)}
              >
                {buttonLabel(science, maxed)}
              </button>
            </CatalogCard>
          );
        })}
      </div>
    </>
  );
}
