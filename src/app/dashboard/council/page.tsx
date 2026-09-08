"use client";

import CatalogCard from '@/components/CatalogCard';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

const EFFECT_LABEL: Record<string, string> = {
  income: 'Income',
  offense: 'Offense',
  defense: 'Defense',
  magic: 'Magic',
  magicProtection: 'Magic Protection',
  morale: 'Morale',
  thieveryOffense: 'Thievery Offense',
  thieveryDefense: 'Thievery Defense',
  thieveryLoss: 'Thief Losses',
  none: 'No combat bonus',
};

const ADVISOR_IMAGE: Record<string, string> = {
  'Lady Brienne': 'brienne',
  'Lady Alustriel': 'alustriel',
  'Raistlin Jamere': 'raistlin',
  'Ungrim Ironfist': 'ungrim',
  'Arrk Maneater': 'arrk',
  Goliath: 'goliath',
  'Melangult the Shadow': 'shadow',
};

interface Advisor {
  id: number;
  name: string;
  title: string;
  description: string | null;
  effect: string;
  bonus: number;
  effect2: string | null;
  bonus2: number;
  costGold: number;
}

interface CouncilData {
  advisors: Advisor[];
  councilId: number;
  gold: number;
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

export default function Council() {
  const { data, error, loading, refresh } = useGameData<CouncilData>('/api/council');
  const action = useGameAction();

  if (!data) {
    return loading ? <PageSkeleton cards={4} /> : <Notices error={error || 'The council could not be summoned.'} />;
  }

  const appoint = async (advisorId: number) => {
    await action.run(`appoint-${advisorId}`, () => apiPost<{ message: string }>('/api/council', { advisorId }), result => {
      void refresh();
      return result.message;
    });
  };

  return (
    <>
      <PageBanner image="/game/headers/header-council.webp" title="The Council" subtitle="Appoint one advisor to guide your realm." right={<div className="networth-badge">Gold: {data.gold.toLocaleString()}</div>} />

      <Notices error={error || action.error} notice={action.notice} />

      <div className="catalog-grid">
        {data.advisors.map(advisor => {
          const active = data.councilId === advisor.id;
          const image = ADVISOR_IMAGE[advisor.name];
          const bonusText = `${signed(advisor.bonus)} ${EFFECT_LABEL[advisor.effect] ?? advisor.effect}`
            + (advisor.effect2 ? ` · ${signed(advisor.bonus2)} ${EFFECT_LABEL[advisor.effect2] ?? advisor.effect2}` : '');
          return (
            <CatalogCard
              key={advisor.id}
              image={image ? `/game/council/${image}.webp` : undefined}
              imageAlt={advisor.name}
              imageStyle="portrait"
              title={advisor.name}
              meta={advisor.title}
              summary={`${advisor.title}${active ? ' · Appointed' : ''}`}
              description={advisor.description ?? undefined}
              highlighted={active}
              facts={[
                { label: 'Bonus', value: bonusText },
                { label: 'Hiring cost', value: advisor.costGold ? `${advisor.costGold.toLocaleString()} gold` : 'Free' },
              ]}
            >
              <button
                type="button"
                className="btn-primary"
                disabled={action.busy !== null || active || data.gold < advisor.costGold}
                onClick={() => void appoint(advisor.id)}
              >
                {active ? 'Currently appointed' : action.busy === `appoint-${advisor.id}` ? 'Appointing…' : data.gold < advisor.costGold ? 'Not enough gold' : 'Appoint advisor'}
              </button>
            </CatalogCard>
          );
        })}
      </div>

      {data.councilId !== 0 && (
        <div className="game-action-bar">
          <button type="button" className="btn-primary btn-muted" disabled={action.busy !== null} onClick={() => void appoint(0)}>
            Dismiss advisor
          </button>
        </div>
      )}
    </>
  );
}
