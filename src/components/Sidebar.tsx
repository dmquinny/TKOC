"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, LogOut, MoreHorizontal, X } from 'lucide-react';
import MobileNavIcon from '@/components/MobileNavIcon';
import TickCountdown from '@/components/TickCountdown';
import { apiGet } from '@/lib/client/api';
import {
  MOBILE_NAV_UPDATED_EVENT,
  NEWS_SEEN_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
  readNewsSeenId,
} from '@/lib/client/events';
import { DEFAULT_MOBILE_NAV, MOBILE_NAV_OPTIONS, parseMobileNav, type MobileNavId } from '@/lib/mobile-nav';
import { badgeFor, categoryFor, navLabelFor, visibleCategories, type BadgeKey } from '@/lib/navigation';
import { tickDay, tickWeek } from '@/lib/time';
import { EMPTY_NOTIFICATIONS, type NotificationCounts, type WorldClock } from '@/lib/world-clock';

type Badges = Record<BadgeKey, number>;

const CLOCK_POLL_MS = 60_000;
const NOTIFICATION_POLL_MS = 60_000;
const TICK_SETTLE_MS = 8_000;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <em className="nav-badge" aria-label={`${count} new`}>{count > 99 ? '99+' : count}</em>;
}

function badgeCount(badges: Badges, key: BadgeKey | undefined): number {
  return key ? badges[key] : 0;
}

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const active = pathname ?? '/dashboard';
  const activeLabel = navLabelFor(active);
  const categories = visibleCategories(isAdmin);

  const [openCategory, setOpenCategory] = useState<string>(() => categoryFor(active));
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState<WorldClock | null>(null);
  const [badges, setBadges] = useState<Badges>({ news: 0, messages: 0, battles: 0 });
  const [mobileNav, setMobileNav] = useState<MobileNavId[]>(DEFAULT_MOBILE_NAV);
  const settleTimer = useRef<number | null>(null);

  const mobileNavItems = mobileNav.map(id => MOBILE_NAV_OPTIONS.find(option => option.id === id)!);
  const primaryMobileRoute = mobileNavItems.some(item => item.href === active);
  const hiddenBadgeTotal = (Object.keys(badges) as BadgeKey[])
    .filter(key => !mobileNavItems.some(item => badgeFor(item.href) === key))
    .reduce((sum, key) => sum + badges[key], 0);

  // Keep the open category in step with client-side navigation.
  useEffect(() => {
    setOpenCategory(categoryFor(active));
    setMenuOpen(false);
  }, [active]);

  const loadClock = useCallback(async () => {
    try {
      const next = await apiGet<WorldClock>('/api/gamestate');
      setClock(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const counts = await apiGet<NotificationCounts>(`/api/notifications?sinceNews=${readNewsSeenId()}`);
      setBadges({
        news: counts.newNews,
        messages: counts.unreadMessages,
        battles: counts.unseenBattles,
      });
    } catch {
      setBadges({ news: EMPTY_NOTIFICATIONS.newNews, messages: EMPTY_NOTIFICATIONS.unreadMessages, battles: EMPTY_NOTIFICATIONS.unseenBattles });
    }
  }, []);

  useEffect(() => {
    void loadClock();
    void loadNotifications();
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      void loadClock();
      void loadNotifications();
    };
    const clockTimer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadClock(); }, CLOCK_POLL_MS);
    const noteTimer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadNotifications(); }, NOTIFICATION_POLL_MS);
    const refresh = () => { void loadNotifications(); };
    const newsSeen = () => setBadges(current => ({ ...current, news: 0 }));
    document.addEventListener('visibilitychange', poll);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    window.addEventListener(NEWS_SEEN_EVENT, newsSeen);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(noteTimer);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
      window.removeEventListener(NEWS_SEEN_EVENT, newsSeen);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, [loadClock, loadNotifications]);

  // When the countdown reaches zero, poll until the engine records the tick.
  const handleTickElapsed = useCallback(() => {
    const previous = clock?.nextTickAt ?? null;
    let attempts = 0;
    const settle = async () => {
      attempts += 1;
      const next = await loadClock();
      const changed = next?.nextTickAt && next.nextTickAt !== previous;
      if (changed) {
        void loadNotifications();
        return;
      }
      if (attempts < 8) settleTimer.current = window.setTimeout(() => { void settle(); }, TICK_SETTLE_MS);
    };
    settleTimer.current = window.setTimeout(() => { void settle(); }, TICK_SETTLE_MS);
  }, [clock?.nextTickAt, loadClock, loadNotifications]);

  useEffect(() => {
    apiGet<{ mobileNav?: unknown }>('/api/preferences')
      .then(data => setMobileNav(parseMobileNav(data.mobileNav)))
      .catch(() => {});
    const updateMobileNav = (event: Event) => {
      setMobileNav(parseMobileNav((event as CustomEvent<unknown>).detail));
    };
    window.addEventListener(MOBILE_NAV_UPDATED_EVENT, updateMobileNav);
    return () => window.removeEventListener(MOBILE_NAV_UPDATED_EVENT, updateMobileNav);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const seasonLabel = clock
    ? (clock.phase === 'Apocalypse' ? 'Apocalypse' : clock.season)
    : '';
  const outlookLine = clock
    ? clock.outlook.phase === 'apocalypse'
      ? `Age ends in ${clock.outlook.ticksUntilAgeEnd.toLocaleString()} ticks`
      : `Apocalypse in ${clock.outlook.ticksUntilApocalypse.toLocaleString()} ticks`
    : '';

  return (
    <>
      <header className="mobile-header">
        <Link href="/dashboard" className="mobile-brand" aria-label="Kingdoms of Chaos overview">
          <span>
            <small>Kingdoms of Chaos</small>
            <strong>{activeLabel}</strong>
          </span>
        </Link>
        {clock ? (
          <div className="mobile-clock" aria-label={`Age ${clock.age}, week ${tickWeek(clock.tick)}, day ${tickDay(clock.tick)}`}>
            <span><small>Age</small><strong>{clock.age}</strong></span>
            <span><small>Day</small><strong>{tickDay(clock.tick)}</strong></span>
            <TickCountdown nextTickAt={clock.nextTickAt} compact onElapsed={handleTickElapsed} />
          </div>
        ) : (
          <img className="mobile-header-emblem" src="/game/ui/sidebar-emblem-v3.webp" alt="" aria-hidden="true" width={512} height={512} />
        )}
      </header>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav id="dashboard-navigation" className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Game navigation">
        <div className="mobile-menu-shell">
          <header className="mobile-menu-top">
            <Link href="/dashboard" className="mobile-menu-identity" onClick={() => setMenuOpen(false)}>
              <img src="/game/ui/sidebar-emblem-v3.webp" alt="" aria-hidden="true" width={512} height={512} />
              <span>
                <small>The Kingdoms of Chaos</small>
                <strong>Game Menu</strong>
              </span>
            </Link>
            <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
              <X aria-hidden="true" />
            </button>
          </header>

          {clock && (
            <div className="mobile-menu-cycle">
              <span><small>Age</small><strong>{clock.age}</strong></span>
              <span><small>Week</small><strong>{tickWeek(clock.tick)}</strong></span>
              <span><small>Day</small><strong>{tickDay(clock.tick)}</strong></span>
              <span><small>Season</small><strong>{seasonLabel}</strong></span>
            </div>
          )}

          <div className="mobile-menu-sections">
            {categories.map(category => {
              const CategoryIcon = category.icon;
              return (
                <section className="mobile-menu-section" key={category.name}>
                  <h2>
                    <CategoryIcon aria-hidden="true" />
                    <span>{category.name}</span>
                  </h2>
                  <div className="mobile-menu-grid">
                    {category.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={active === item.href ? 'is-active' : ''}
                        aria-current={active === item.href ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                        <NavBadge count={badgeCount(badges, item.badge)} />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <button type="button" className="mobile-menu-logout" onClick={logout}>
            <LogOut aria-hidden="true" />
            <span>Leave the Realm</span>
          </button>
        </div>

        <div className="desktop-sidebar-content">
          <div className="sidebar-logo-container">
            <Link href="/dashboard" className="sidebar-brand-lockup" aria-label="The Kingdoms of Chaos overview">
              <img src="/game/ui/sidebar-emblem-v3.webp" alt="" aria-hidden="true" className="sidebar-emblem" width={512} height={512} decoding="async" />
              <span className="sidebar-game-title">
                <small>The</small>
                <strong>Kingdoms of Chaos</strong>
              </span>
            </Link>
          </div>
          {clock && (
            <div className="sidebar-clock">
              <div className="sidebar-clock-units">
                <span><small>Age</small>{clock.age}</span>
                <span><small>Week</small>{tickWeek(clock.tick)}</span>
                <span><small>Day</small>{tickDay(clock.tick)}</span>
              </div>
              <div className={`sidebar-season${clock.phase === 'Apocalypse' ? ' is-apocalypse' : ''}`}>
                {clock.phase === 'Apocalypse' ? '☄ Apocalypse' : clock.season.toUpperCase()}
              </div>
              <TickCountdown nextTickAt={clock.nextTickAt} onElapsed={handleTickElapsed} />
              <div className={`sidebar-outlook${clock.outlook.phase === 'apocalypse' ? ' is-apocalypse' : ''}`}>{outlookLine}</div>
            </div>
          )}
          <ul className="nav-links">
            {categories.map(category => {
              const categoryId = `nav-${category.name.toLowerCase().replaceAll(' ', '-')}`;
              const categoryOpen = openCategory === category.name;
              const CategoryIcon = category.icon;
              const categoryBadge = category.items.reduce((sum, item) => sum + badgeCount(badges, item.badge), 0);

              return (
                <li key={category.name} className={`nav-category${categoryOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="category-header"
                    aria-controls={categoryId}
                    aria-expanded={categoryOpen}
                    onClick={() => setOpenCategory(categoryOpen ? '' : category.name)}
                  >
                    <span className="category-heading-content">
                      <CategoryIcon size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span>{category.name}</span>
                    </span>
                    {!categoryOpen && <NavBadge count={categoryBadge} />}
                    {categoryOpen ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
                  </button>

                  {categoryOpen && (
                    <ul id={categoryId} className="category-items">
                      {category.items.map(item => (
                        <li key={item.href} className={active === item.href ? 'active' : ''}>
                          <Link href={item.href} aria-current={active === item.href ? 'page' : undefined}>
                            {item.label}
                            <NavBadge count={badgeCount(badges, item.badge)} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            <li className="logout-item">
              <a href="#" className="logout-btn" onClick={(event) => { event.preventDefault(); void logout(); }}>
                <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Logout</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <nav className="mobile-bottom-nav" aria-label="Primary game navigation">
        {mobileNavItems.map(item => {
          const selected = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={selected ? 'is-active' : ''}
              aria-current={selected ? 'page' : undefined}
            >
              <MobileNavIcon id={item.id} />
              <span>{item.label}</span>
              <NavBadge count={badgeCount(badges, badgeFor(item.href))} />
            </Link>
          );
        })}
        <button
          type="button"
          className={!primaryMobileRoute ? 'is-active' : ''}
          aria-label={hiddenBadgeTotal > 0 ? `Open all game sections, ${hiddenBadgeTotal} new` : 'Open all game sections'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <MoreHorizontal aria-hidden="true" />
          <span>More</span>
          {hiddenBadgeTotal > 0 && <i className="nav-dot" aria-hidden="true" />}
        </button>
      </nav>
    </>
  );
}
