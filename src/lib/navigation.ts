import type { LucideIcon } from 'lucide-react';
import { Castle, Eye, Globe2, MessagesSquare, Settings, Swords } from 'lucide-react';

/** Which live counter, if any, decorates a navigation entry. */
export type BadgeKey = 'news' | 'messages' | 'battles';

export type NavItem = {
  href: string;
  label: string;
  badge?: BadgeKey;
};

export type NavCategory = {
  name: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  items: NavItem[];
};

export const NAV_CATEGORIES: NavCategory[] = [
  {
    name: 'Province',
    icon: Castle,
    items: [
      { href: '/dashboard', label: 'Overview', badge: 'news' },
      { href: '/dashboard/guide', label: 'Guide' },
      { href: '/dashboard/buildings', label: 'Buildings' },
      { href: '/dashboard/science', label: 'Science' },
      { href: '/dashboard/council', label: 'Council' },
      { href: '/dashboard/preferences', label: 'Preferences' },
    ],
  },
  {
    name: 'World',
    icon: Globe2,
    items: [
      { href: '/dashboard/rankings', label: 'Rankings' },
      { href: '/dashboard/hall-of-fame', label: 'Hall of Fame' },
      { href: '/dashboard/explore', label: 'Explore' },
      { href: '/dashboard/kingdom', label: 'Kingdom' },
      { href: '/dashboard/aid', label: 'Send Aid' },
    ],
  },
  {
    name: 'Community',
    icon: MessagesSquare,
    items: [
      { href: '/dashboard/chat', label: 'Chat' },
      { href: '/dashboard/forums', label: 'Forums' },
      { href: '/dashboard/messages', label: 'Messages', badge: 'messages' },
    ],
  },
  {
    name: 'Warfare',
    icon: Swords,
    items: [
      { href: '/dashboard/military', label: 'Military' },
      { href: '/dashboard/war-room', label: 'War Room', badge: 'battles' },
    ],
  },
  {
    name: 'Covert Ops',
    icon: Eye,
    items: [
      { href: '/dashboard/thievery', label: 'Thievery' },
      { href: '/dashboard/magic', label: 'Magic' },
    ],
  },
  {
    name: 'System',
    icon: Settings,
    adminOnly: true,
    items: [
      { href: '/dashboard/admin', label: 'Admin' },
    ],
  },
];

export function visibleCategories(isAdmin: boolean): NavCategory[] {
  return NAV_CATEGORIES.filter(category => !category.adminOnly || isAdmin);
}

export function navLabelFor(pathname: string): string {
  for (const category of NAV_CATEGORIES) {
    const item = category.items.find(entry => entry.href === pathname);
    if (item) return item.label;
  }
  return 'Overview';
}

export function categoryFor(pathname: string): string {
  return NAV_CATEGORIES.find(category => category.items.some(item => item.href === pathname))?.name ?? 'Province';
}

export function badgeFor(href: string): BadgeKey | undefined {
  for (const category of NAV_CATEGORIES) {
    const item = category.items.find(entry => entry.href === href);
    if (item) return item.badge;
  }
  return undefined;
}
