import type { AgeOutlook } from '@/lib/apocalypse';

/** Shape returned by /api/gamestate and consumed by the sidebar clock. */
export interface WorldClock {
  age: number;
  tick: number;
  season: string;
  phase: string;
  nextTickAt: string | null;
  lastTickAt: string | null;
  intervalSeconds: number;
  outlook: AgeOutlook;
}

/** Shape returned by /api/notifications. */
export interface NotificationCounts {
  unreadMessages: number;
  unseenBattles: number;
  newNews: number;
  latestNewsId: number;
}

export const EMPTY_NOTIFICATIONS: NotificationCounts = {
  unreadMessages: 0,
  unseenBattles: 0,
  newNews: 0,
  latestNewsId: 0,
};
