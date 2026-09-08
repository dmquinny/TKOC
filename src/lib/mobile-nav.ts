export const MOBILE_NAV_OPTIONS = [
  { id: 'overview', href: '/dashboard', label: 'Realm' },
  { id: 'guide', href: '/dashboard/guide', label: 'Guide' },
  { id: 'buildings', href: '/dashboard/buildings', label: 'Build' },
  { id: 'science', href: '/dashboard/science', label: 'Science' },
  { id: 'council', href: '/dashboard/council', label: 'Council' },
  { id: 'preferences', href: '/dashboard/preferences', label: 'Settings' },
  { id: 'rankings', href: '/dashboard/rankings', label: 'Ranks' },
  { id: 'hall-of-fame', href: '/dashboard/hall-of-fame', label: 'Hall' },
  { id: 'explore', href: '/dashboard/explore', label: 'Explore' },
  { id: 'kingdom', href: '/dashboard/kingdom', label: 'Kingdom' },
  { id: 'aid', href: '/dashboard/aid', label: 'Aid' },
  { id: 'chat', href: '/dashboard/chat', label: 'Chat' },
  { id: 'messages', href: '/dashboard/messages', label: 'Messages' },
  { id: 'military', href: '/dashboard/military', label: 'Military' },
  { id: 'war-room', href: '/dashboard/war-room', label: 'Warfare' },
  { id: 'thievery', href: '/dashboard/thievery', label: 'Thievery' },
  { id: 'magic', href: '/dashboard/magic', label: 'Magic' },
  { id: 'admin', href: '/dashboard/admin', label: 'Admin' },
] as const;

export type MobileNavId = (typeof MOBILE_NAV_OPTIONS)[number]['id'];

export const DEFAULT_MOBILE_NAV: MobileNavId[] = ['overview', 'buildings', 'science', 'war-room'];

const MOBILE_NAV_IDS = new Set<string>(MOBILE_NAV_OPTIONS.map(option => option.id));

export function isValidMobileNav(value: unknown): value is MobileNavId[] {
  return Array.isArray(value)
    && value.length === 4
    && new Set(value).size === 4
    && value.every(item => typeof item === 'string' && MOBILE_NAV_IDS.has(item));
}

export function parseMobileNav(value: unknown): MobileNavId[] {
  if (isValidMobileNav(value)) return [...value];
  if (typeof value !== 'string' || !value.trim()) return [...DEFAULT_MOBILE_NAV];

  try {
    const parsed: unknown = JSON.parse(value);
    return isValidMobileNav(parsed) ? [...parsed] : [...DEFAULT_MOBILE_NAV];
  } catch {
    return [...DEFAULT_MOBILE_NAV];
  }
}

