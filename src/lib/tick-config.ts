const DEFAULT_TICK_INTERVAL_SECONDS = 60 * 60;
const MINIMUM_TICK_INTERVAL_SECONDS = 60;

export function getTickIntervalSeconds(): number {
  const configured = Number.parseInt(process.env.TICK_INTERVAL_SECONDS ?? '', 10);
  if (!Number.isFinite(configured) || configured < MINIMUM_TICK_INTERVAL_SECONDS) {
    return DEFAULT_TICK_INTERVAL_SECONDS;
  }
  return configured;
}

export function getTickIntervalMs(): number {
  return getTickIntervalSeconds() * 1000;
}

// Align a new world clock to a stable UTC boundary. Once initialized, the
// persisted nextTickAt value is the authority, so restarts do not reset/drift it.
export function nextTickBoundary(now: Date, intervalMs = getTickIntervalMs()): Date {
  return new Date(Math.ceil((now.getTime() + 1) / intervalMs) * intervalMs);
}
