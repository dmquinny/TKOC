"use client";

import Link from 'next/link';
import {
  BookOpen,
  Castle,
  Compass,
  FlaskConical,
  Hammer,
  ShieldCheck,
  Sparkles,
  Swords,
} from 'lucide-react';

export type ActivityData = {
  protectionTicks: number;
  vacation: boolean;
  vacationTicks: number;
  research: Array<{ id: number; name: string; ticksLeft: number }>;
  construction: Array<{ name: string; quantity: number; ticksLeft: number }>;
  training: Array<{ name: string; quantity: number; ticksLeft: number }>;
  exploration: Array<{ id: number; acres: number; ticksLeft: number }>;
  armies: Array<{ id: number; target: string; ticksLeft: number; phase: string }>;
  effects: Array<{ id: number; name: string; ticksLeft: number }>;
};

function TickLabel({ ticks }: { ticks: number }) {
  return <span className="activity-ticks">{ticks} tick{ticks === 1 ? '' : 's'}</span>;
}

function ActivityGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <section className="activity-group" aria-label={`${title}, ${count} active`}>
      <header className="activity-group-heading">
        <h3>{title}</h3>
        <span className="activity-group-count">{count}</span>
      </header>
      <div className="activity-group-grid">
        {children}
      </div>
    </section>
  );
}

export default function ActivityCentre({ activity }: { activity: ActivityData | null }) {
  if (!activity) return null;
  const developmentCount = activity.research.length
    + activity.construction.length
    + activity.exploration.length;
  const militaryCount = activity.training.length + activity.armies.length;
  const conditionCount = activity.effects.length
    + (activity.vacation || activity.protectionTicks > 0 ? 1 : 0);
  const hasActivity = developmentCount + militaryCount + conditionCount > 0;

  return (
    <section className="game-panel activity-centre" aria-labelledby="activity-heading">
      <div className="game-panel-heading">
        <div>
          <p className="eyebrow">Realm schedule</p>
          <h2 id="activity-heading">Activity Centre</h2>
        </div>
        <span className="activity-status">
          {activity.vacation
            ? `Vacation · ${activity.vacationTicks} ticks`
            : activity.protectionTicks > 0
              ? `Protected · ${activity.protectionTicks} ticks`
              : 'Realm active'}
        </span>
      </div>

      {!hasActivity ? (
        <div className="activity-empty">
          <ShieldCheck aria-hidden="true" />
          <span><strong>No work is currently queued.</strong> Your realm is ready for its next command.</span>
        </div>
      ) : (
        <div className="activity-groups">
          <ActivityGroup title="Realm Development" count={developmentCount}>
            {activity.research.map(item => (
              <Link className="activity-item" href="/dashboard/science" key={`r-${item.id}`}>
                <FlaskConical aria-hidden="true" /><span><small>Research</small><strong>{item.name}</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
            {activity.construction.map(item => (
              <Link className="activity-item" href="/dashboard/buildings" key={`b-${item.name}`}>
                <Hammer aria-hidden="true" /><span><small>Construction</small><strong>{item.quantity.toLocaleString()} {item.name}</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
            {activity.exploration.map(item => (
              <Link className="activity-item" href="/dashboard/explore" key={`e-${item.id}`}>
                <Compass aria-hidden="true" /><span><small>Exploration</small><strong>{item.acres.toLocaleString()} incoming acres</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
          </ActivityGroup>

          <ActivityGroup title="Military" count={militaryCount}>
            {activity.training.map(item => (
              <Link className="activity-item" href="/dashboard/military" key={`m-${item.name}`}>
                <Swords aria-hidden="true" /><span><small>Training</small><strong>{item.quantity.toLocaleString()} {item.name}</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
            {activity.armies.map(item => (
              <Link className="activity-item" href="/dashboard/war-room" key={`a-${item.id}`}>
                <Castle aria-hidden="true" /><span><small>Army {item.phase}</small><strong>{item.target}</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
          </ActivityGroup>

          <ActivityGroup title="Active Effects" count={conditionCount}>
            {activity.vacation ? (
              <div className="activity-item activity-condition">
                <ShieldCheck aria-hidden="true" /><span><small>Realm condition</small><strong>Vacation mode</strong></span><TickLabel ticks={activity.vacationTicks} />
              </div>
            ) : activity.protectionTicks > 0 ? (
              <div className="activity-item activity-condition">
                <ShieldCheck aria-hidden="true" /><span><small>Realm condition</small><strong>New-realm protection</strong></span><TickLabel ticks={activity.protectionTicks} />
              </div>
            ) : null}
            {activity.effects.map(item => (
              <Link className="activity-item" href="/dashboard/magic" key={`f-${item.id}`}>
                <Sparkles aria-hidden="true" /><span><small>Spell effect</small><strong>{item.name}</strong></span><TickLabel ticks={item.ticksLeft} />
              </Link>
            ))}
          </ActivityGroup>
        </div>
      )}

      <div className="activity-shortcuts" aria-label="Suggested next actions">
        <Link href="/dashboard/guide"><BookOpen aria-hidden="true" />Guide</Link>
        <Link href="/dashboard/buildings"><Hammer aria-hidden="true" />Build</Link>
        <Link href="/dashboard/science"><FlaskConical aria-hidden="true" />Research</Link>
      </div>
    </section>
  );
}
