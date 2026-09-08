"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import MobileNavIcon from '@/components/MobileNavIcon';
import { MoreHorizontal } from 'lucide-react';
import {
  DEFAULT_MOBILE_NAV,
  MOBILE_NAV_OPTIONS,
  parseMobileNav,
  type MobileNavId,
} from '@/lib/mobile-nav';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.75rem 1rem',
  borderRadius: '4px',
  border: '1px solid var(--stone-border)',
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: 'var(--parchment)',
  fontFamily: 'var(--font-display)',
  fontSize: '1rem',
  outline: 'none',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
};

export default function Preferences() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [mobileNav, setMobileNav] = useState<MobileNavId[]>(DEFAULT_MOBILE_NAV);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/preferences');
      if (res.status === 401) return router.push('/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPrefs(data);
      setMobileNav(parseMobileNav(data.mobileNav));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [router]);

  const act = async (label: string, body: any, clear?: () => void) => {
    setBusy(label); setError(''); setNotice('');
    try {
      const res = await fetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(data.message);
      clear?.();
      await load();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const updateMobileNavSlot = (slot: number, nextId: MobileNavId) => {
    setMobileNav(current => {
      const next = [...current];
      const existingSlot = next.indexOf(nextId);
      if (existingSlot >= 0 && existingSlot !== slot) {
        [next[slot], next[existingSlot]] = [next[existingSlot], next[slot]];
      } else {
        next[slot] = nextId;
      }
      return next;
    });
  };

  const saveMobileNav = async () => {
    const saved = await act('mobileNav', { action: 'mobileNav', mobileNav });
    if (saved) window.dispatchEvent(new CustomEvent('mobile-nav-updated', { detail: mobileNav }));
  };

  if (loading) return <div className="loading-screen">Loading Preferences…</div>;

  const onVacation = prefs?.vacation;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/preferences" />
      <main id="main-content" className="dashboard-content">
        <PageBanner image="/game/headers/header-preferences.webp" title="Preferences" subtitle="Manage your province and account." />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          <section className="stat-card mobile-nav-settings">
            <h2 style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--stone-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Mobile Bottom Bar</h2>
            <p className="mobile-nav-help">
              Choose the four destinations shown at the bottom of the mobile interface. Selecting a destination already in another slot swaps the two. More always remains in the fifth slot.
            </p>
            <div className="mobile-nav-slot-grid">
              {mobileNav.map((selectedId, index) => (
                <label className="mobile-nav-slot" key={index}>
                  <span>Slot {index + 1}</span>
                  <select value={selectedId} onChange={event => updateMobileNavSlot(index, event.target.value as MobileNavId)}>
                    {MOBILE_NAV_OPTIONS.map(option => (
                      <option value={option.id} key={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mobile-nav-preview" aria-label="Mobile bottom navigation preview">
              {mobileNav.map(id => {
                const option = MOBILE_NAV_OPTIONS.find(item => item.id === id)!;
                return (
                  <span key={id}>
                    <MobileNavIcon id={id} />
                    <small>{option.label}</small>
                  </span>
                );
              })}
              <span>
                <MoreHorizontal aria-hidden="true" />
                <small>More</small>
              </span>
            </div>
            <button type="button" className="btn-primary" disabled={busy === 'mobileNav'} onClick={saveMobileNav}>
              {busy === 'mobileNav' ? 'Saving…' : 'Save Mobile Bar'}
            </button>
          </section>

          <section className="stat-card">
            <h2 style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--stone-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Vacation Mode</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <p style={{ color: 'var(--parchment-dim)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                {onVacation
                  ? `Active — your province is frozen and safe from attack. (${prefs.vacationTicks}/${prefs.minVacationTicks} ticks; you can end it after the minimum.)`
                  : 'Freeze your province and make it immune to attack while you are away. A minimum stay applies before you can return.'}
              </p>
              <button
                className="btn-primary"
                style={{ 
                  margin: 'auto 0', 
                  padding: '0.75rem', 
                  fontSize: '1rem', 
                  background: onVacation ? undefined : 'linear-gradient(rgba(58, 85, 112, 0.6), rgba(28, 45, 62, 0.8)), url(/game/ui/btn-bg-2.webp) center/cover no-repeat', 
                  borderColor: onVacation ? undefined : '#4a6f93',
                  color: onVacation ? undefined : '#e2e8f0',
                  boxShadow: onVacation ? undefined : 'inset 0 0 10px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5)'
                }}
                disabled={busy === 'vacation'}
                onClick={() => act('vacation', { action: 'vacation', enable: !onVacation })}
              >
                {busy === 'vacation' ? '…' : onVacation ? 'End Vacation' : 'Go on Vacation'}
              </button>
            </div>
          </section>

          <section className="stat-card">
            <h2 style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--stone-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Change Password</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <input type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} style={fieldStyle} />
              <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={fieldStyle} />
              <button
                className="btn-primary"
                style={{ margin: 'auto 0', padding: '0.75rem', fontSize: '1rem' }}
                disabled={busy === 'password' || !curPw || !newPw}
                onClick={() => act('password', { action: 'password', currentPassword: curPw, newPassword: newPw }, () => { setCurPw(''); setNewPw(''); })}
              >
                {busy === 'password' ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
