"use client";

/**
 * Browser-side coordination between pages and the persistent sidebar. Pages
 * dispatch these after actions so badges refresh without a full poll cycle.
 */
export const NOTIFICATIONS_REFRESH_EVENT = 'tkoc:notifications-refresh';
export const NEWS_SEEN_EVENT = 'tkoc:news-seen';
export const MOBILE_NAV_UPDATED_EVENT = 'mobile-nav-updated';

const NEWS_SEEN_KEY = 'tkoc:news-seen-id';
const CHECKLIST_KEY = 'tkoc:checklist-dismissed';

export function requestNotificationRefresh(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

export function readNewsSeenId(): number {
  try {
    return Number(window.localStorage.getItem(NEWS_SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Record the newest news item the player has looked at and clear the badge. */
export function markNewsSeen(latestId: number): void {
  if (!latestId || latestId <= readNewsSeenId()) return;
  try {
    window.localStorage.setItem(NEWS_SEEN_KEY, String(latestId));
  } catch {
    /* storage unavailable: the badge simply refreshes on the next poll */
  }
  window.dispatchEvent(new Event(NEWS_SEEN_EVENT));
}

export function readChecklistDismissed(): boolean {
  try {
    return window.localStorage.getItem(CHECKLIST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeChecklistDismissed(): void {
  try {
    window.localStorage.setItem(CHECKLIST_KEY, '1');
  } catch {
    /* ignore */
  }
}
