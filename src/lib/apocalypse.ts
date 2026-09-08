import { LEGACY_NORMAL_AGE_TICKS, LEGACY_TOTAL_AGE_TICKS } from './legacy-rules';

/** A scripted disaster the tick engine fires at a fixed point in the age. */
export interface AgeEvent {
  atTick: number;
  label: string;
  detail: string;
}

// Each event fires when the engine's "ticks remaining" counter reaches the
// legacy threshold. Remaining = total age ticks minus the tick being processed.
const eventAt = (remaining: number, label: string, detail: string): AgeEvent => ({
  atTick: LEGACY_TOTAL_AGE_TICKS - remaining,
  label,
  detail,
});

export const AGE_EVENTS: AgeEvent[] = [
  eventAt(500, 'The Apocalypse begins', 'Every council advisor flees. Housing shortages become twice as deadly.'),
  eventAt(440, 'Plague sweeps the land', 'Half of every province\'s peasants die before growth is applied.'),
  eventAt(240, 'Mana drains from the world', 'Every province\'s mana is reset to 50 before regeneration.'),
  eventAt(150, 'Armies lose heart', 'Every province\'s morale is reset to 50.'),
  eventAt(100, 'The thieves flee', 'Every province\'s influence is reset to 50 before regeneration.'),
  eventAt(0, 'The age ends', 'Final standings are enshrined in the Hall of Fame and the world resets.'),
];

export interface AgeOutlook {
  tick: number;
  phase: 'running' | 'apocalypse';
  normalTicks: number;
  totalTicks: number;
  ticksUntilApocalypse: number;
  ticksUntilAgeEnd: number;
  /** 0 to 100 through the whole age. */
  progressPercent: number;
  next: (AgeEvent & { inTicks: number }) | null;
  upcoming: Array<AgeEvent & { inTicks: number }>;
}

/**
 * Where the world is in its age. `tick` is the last completed tick, so an
 * event scheduled for tick N fires when tick N is processed, N - tick ticks
 * from now.
 */
export function ageOutlook(tick: number, phase?: string | null): AgeOutlook {
  const safeTick = Math.max(0, Math.floor(tick));
  const apocalypse = phase === 'Apocalypse' || safeTick >= LEGACY_NORMAL_AGE_TICKS;
  const upcoming = AGE_EVENTS
    .map(event => ({ ...event, inTicks: event.atTick - safeTick }))
    .filter(event => event.inTicks > 0);
  return {
    tick: safeTick,
    phase: apocalypse ? 'apocalypse' : 'running',
    normalTicks: LEGACY_NORMAL_AGE_TICKS,
    totalTicks: LEGACY_TOTAL_AGE_TICKS,
    ticksUntilApocalypse: Math.max(0, LEGACY_NORMAL_AGE_TICKS - safeTick),
    ticksUntilAgeEnd: Math.max(0, LEGACY_TOTAL_AGE_TICKS - safeTick),
    progressPercent: Math.min(100, Math.round((safeTick / LEGACY_TOTAL_AGE_TICKS) * 1000) / 10),
    next: upcoming[0] ?? null,
    upcoming,
  };
}
