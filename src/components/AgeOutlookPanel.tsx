import type { AgeOutlook } from '@/lib/apocalypse';
import { ticksToDuration } from '@/lib/time';

type Props = {
  outlook: AgeOutlook;
  intervalSeconds: number;
  /** Show only the headline and the next event. */
  compact?: boolean;
};

export default function AgeOutlookPanel({ outlook, intervalSeconds, compact = false }: Props) {
  const apocalypse = outlook.phase === 'apocalypse';
  const headline = apocalypse
    ? `The age ends in ${outlook.ticksUntilAgeEnd.toLocaleString()} ticks`
    : `The Apocalypse begins in ${outlook.ticksUntilApocalypse.toLocaleString()} ticks`;
  const events = compact ? outlook.upcoming.slice(0, 1) : outlook.upcoming;
  const markerLeft = `${(outlook.normalTicks / outlook.totalTicks) * 100}%`;

  return (
    <section className={`game-panel age-outlook${apocalypse ? ' is-apocalypse' : ''}`} aria-labelledby="age-outlook-heading">
      <div className="game-panel-heading">
        <div>
          <p className="eyebrow">{apocalypse ? 'The Apocalypse' : 'The age'}</p>
          <h2 id="age-outlook-heading">{headline}</h2>
        </div>
        <span className="activity-status">Tick {outlook.tick.toLocaleString()} of {outlook.totalTicks.toLocaleString()}</span>
      </div>
      <div
        className="age-progress"
        role="progressbar"
        aria-label="Progress through the age"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={outlook.progressPercent}
      >
        <span style={{ width: `${outlook.progressPercent}%` }} />
        <i className="age-progress-marker" style={{ left: markerLeft }} title="Apocalypse begins" aria-hidden="true" />
      </div>
      {events.length > 0 ? (
        <ol className="age-events">
          {events.map(event => (
            <li key={event.atTick}>
              <span className="age-event-when">
                In {event.inTicks.toLocaleString()} ticks · about {ticksToDuration(event.inTicks, intervalSeconds)}
              </span>
              <strong>{event.label}</strong>
              <small>{event.detail}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">The final tick is upon us.</p>
      )}
    </section>
  );
}
