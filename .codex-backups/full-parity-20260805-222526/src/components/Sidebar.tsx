"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Castle,
  ChevronDown,
  ChevronRight,
  Eye,
  Globe2,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Settings,
  Swords,
  X,
} from 'lucide-react';
import MobileNavIcon from '@/components/MobileNavIcon';
import {
  DEFAULT_MOBILE_NAV,
  MOBILE_NAV_OPTIONS,
  parseMobileNav,
  type MobileNavId,
} from '@/lib/mobile-nav';

const CATEGORIES = [
  {
    name: 'Province',
    icon: Castle,
    items: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/dashboard/guide', label: 'Guide' },
      { href: '/dashboard/buildings', label: 'Buildings' },
      { href: '/dashboard/science', label: 'Science' },
      { href: '/dashboard/council', label: 'Council' },
      { href: '/dashboard/preferences', label: 'Preferences' },
    ]
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
    ]
  },
  {
    name: 'Community',
    icon: MessagesSquare,
    items: [
      { href: '/dashboard/chat', label: 'Chat' },
      { href: '/dashboard/messages', label: 'Messages' },
    ]
  },
  {
    name: 'Warfare',
    icon: Swords,
    items: [
      { href: '/dashboard/military', label: 'Military' },
      { href: '/dashboard/war-room', label: 'War Room' },
    ]
  },
  {
    name: 'Covert Ops',
    icon: Eye,
    items: [
      { href: '/dashboard/thievery', label: 'Thievery' },
      { href: '/dashboard/magic', label: 'Magic' },
    ]
  },
  {
    name: 'System',
    icon: Settings,
    items: [
      { href: '/dashboard/admin', label: 'Admin' },
    ]
  }
];

export default function Sidebar({ active }: { active: string }) {
  const initialCategory = CATEGORIES.find(c => c.items.some(i => i.href === active))?.name || 'Province';
  const activeLabel = CATEGORIES.flatMap(category => category.items).find(item => item.href === active)?.label ?? 'Overview';
  const [openCategory, setOpenCategory] = useState<string>(initialCategory);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState<{ age: number; tick: number; season: string; phase: string } | null>(null);
  const [mobileNav, setMobileNav] = useState<MobileNavId[]>(DEFAULT_MOBILE_NAV);
  const mobileNavItems = mobileNav.map(id => MOBILE_NAV_OPTIONS.find(option => option.id === id)!);
  const primaryMobileRoute = mobileNavItems.some(item => item.href === active);

  useEffect(() => {
    const load = () => fetch('/api/gamestate').then(r => (r.ok ? r.json() : null)).then(d => d && setClock(d)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch('/api/preferences')
      .then(response => (response.ok ? response.json() : null))
      .then(data => data && setMobileNav(parseMobileNav(data.mobileNav)))
      .catch(() => {});

    const updateMobileNav = (event: Event) => {
      setMobileNav(parseMobileNav((event as CustomEvent<unknown>).detail));
    };
    window.addEventListener('mobile-nav-updated', updateMobileNav);
    return () => window.removeEventListener('mobile-nav-updated', updateMobileNav);
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
          <div className="mobile-clock" aria-label={`Age ${clock.age}, week ${Math.floor(clock.tick / 168) + 1}, day ${(Math.floor(clock.tick / 24) % 7) + 1}`}>
            <span><small>Age</small><strong>{clock.age}</strong></span>
            <span><small>Week</small><strong>{Math.floor(clock.tick / 168) + 1}</strong></span>
            <span><small>Day</small><strong>{(Math.floor(clock.tick / 24) % 7) + 1}</strong></span>
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
              <span><small>Week</small><strong>{Math.floor(clock.tick / 168) + 1}</strong></span>
              <span><small>Day</small><strong>{(Math.floor(clock.tick / 24) % 7) + 1}</strong></span>
              <span><small>Season</small><strong>{clock.phase === 'Apocalypse' ? 'Apocalypse' : clock.season}</strong></span>
            </div>
          )}

          <div className="mobile-menu-sections">
            {CATEGORIES.map(category => {
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
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <button
            type="button"
            className="mobile-menu-logout"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/';
            }}
          >
            <LogOut aria-hidden="true" />
            <span>Leave the Realm</span>
          </button>
        </div>

        <div className="desktop-sidebar-content">
        <div className="sidebar-mobile-heading">
          <span>Menu</span>
          <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
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
              <span><small>Week</small>{Math.floor(clock.tick / 168) + 1}</span>
              <span><small>Day</small>{(Math.floor(clock.tick / 24) % 7) + 1}</span>
            </div>
            <div className={`sidebar-season${clock.phase === 'Apocalypse' ? ' is-apocalypse' : ''}`}>
              {clock.phase === 'Apocalypse' ? '☄ Apocalypse' : clock.season.toUpperCase()}
            </div>
          </div>
        )}
        <ul className="nav-links">
          {CATEGORIES.map(category => {
            const categoryId = `nav-${category.name.toLowerCase().replaceAll(' ', '-')}`;
            const categoryOpen = openCategory === category.name;
            const CategoryIcon = category.icon;

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
                  {categoryOpen ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
                </button>

                {categoryOpen && (
                  <ul id={categoryId} className="category-items">
                    {category.items.map(item => (
                      <li key={item.href} className={active === item.href ? 'active' : ''}>
                        <Link
                          href={item.href}
                          aria-current={active === item.href ? 'page' : undefined}
                          onClick={() => setMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          <li className="logout-item">
            <a href="#" className="logout-btn" onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', {method: 'POST'}); window.location.href = '/'; }}>
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
            </Link>
          );
        })}
        <button
          type="button"
          className={!primaryMobileRoute ? 'is-active' : ''}
          aria-label="Open all game sections"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <MoreHorizontal aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
