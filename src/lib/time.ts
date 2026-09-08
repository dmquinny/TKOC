/** Countdown and tick-duration formatting used by the world clock. */

export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Approximate wall-clock duration for a number of ticks. */
export function ticksToDuration(ticks: number, intervalSeconds: number): string {
  const seconds = Math.max(0, ticks) * intervalSeconds;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function tickWeek(tick: number): number {
  return Math.floor(tick / 168) + 1;
}

export function tickDay(tick: number): number {
  return (Math.floor(tick / 24) % 7) + 1;
}
