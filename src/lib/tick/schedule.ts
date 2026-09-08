import { nextTickBoundary } from '../tick-config';

export function followingScheduledTick(scheduledFor: Date, now: Date, intervalMs: number): Date {
  const nominal = new Date(scheduledFor.getTime() + intervalMs);
  // Missed wall-clock slots are skipped instead of granting a burst of offline
  // production after downtime.
  return nominal.getTime() <= now.getTime()
    ? nextTickBoundary(now, intervalMs)
    : nominal;
}
