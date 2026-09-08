"use client";

import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import MobileNavIcon from '@/components/MobileNavIcon';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { MOBILE_NAV_UPDATED_EVENT } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';
import { DEFAULT_MOBILE_NAV, MOBILE_NAV_OPTIONS, parseMobileNav, type MobileNavId } from '@/lib/mobile-nav';

interface PreferencesData {
  provinceName: string | null;
  vacation: boolean;
  vacationTicks: number;
  minVacationTicks: number;
  mobileNav: unknown;
}

export default function Preferences() {
  const { data: prefs, error, loading, refresh } = useGameData<PreferencesData>('/api/preferences');
  const action = useGameAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mobileNav, setMobileNav] = useState<MobileNavId[]>(DEFAULT_MOBILE_NAV);

  useEffect(() => {
    if (prefs) setMobileNav(parseMobileNav(prefs.mobileNav));
  }, [prefs]);

  if (!prefs) {
    return loading ? <PageSkeleton cards={3} /> : <Notices error={error || 'Preferences could not be loaded.'} />;
  }

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
    await action.run('mobileNav', () => apiPost<{ message: string }>('/api/preferences', { action: 'mobileNav', mobileNav }), result => {
      window.dispatchEvent(new CustomEvent(MOBILE_NAV_UPDATED_EVENT, { detail: mobileNav }));
      return result.message;
    });
  };

  const toggleVacation = async () => {
    await action.run('vacation', () => apiPost<{ message: string }>('/api/preferences', { action: 'vacation', enable: !prefs.vacation }), result => {
      void refresh();
      return result.message;
    });
  };

  const changePassword = async () => {
    await action.run('password', () => apiPost<{ message: string }>('/api/preferences', {
      action: 'password',
      currentPassword,
      newPassword,
    }), result => {
      setCurrentPassword('');
      setNewPassword('');
      return result.message;
    });
  };

  const onVacation = prefs.vacation;

  return (
    <>
      <PageBanner image="/game/headers/header-preferences.webp" title="Preferences" subtitle="Manage your province and account." />

      <Notices error={error || action.error} notice={action.notice} />

      <div className="responsive-grid page-grid">
        <section className="stat-card mobile-nav-settings">
          <h2 className="card-title-rule">Mobile Bottom Bar</h2>
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
          <button type="button" className="btn-primary" disabled={action.busy !== null} onClick={() => void saveMobileNav()}>
            {action.busy === 'mobileNav' ? 'Saving…' : 'Save mobile bar'}
          </button>
        </section>

        <section className="stat-card prefs-card">
          <h2 className="card-title-rule">Vacation Mode</h2>
          <div>
            <p className="text-muted text-small mt-0 mb-0">
              {onVacation
                ? `Active: your province is frozen and safe from attack (${prefs.vacationTicks}/${prefs.minVacationTicks} ticks; you can end it after the minimum).`
                : 'Freeze your province and make it immune to attack while you are away. Research and mana keep going; the economy, construction, and training pause. A minimum stay applies before you can return.'}
            </p>
            <button
              type="button"
              className={`btn-primary${onVacation ? '' : ' btn-calm'}`}
              disabled={action.busy !== null}
              onClick={() => void toggleVacation()}
            >
              {action.busy === 'vacation' ? 'Working…' : onVacation ? 'End vacation' : 'Go on vacation'}
            </button>
          </div>
        </section>

        <section className="stat-card prefs-card">
          <h2 className="card-title-rule">Change Password</h2>
          <div>
            <input type="password" placeholder="Current password" aria-label="Current password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
            <input type="password" placeholder="New password" aria-label="New password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            <button
              type="button"
              className="btn-primary"
              disabled={action.busy !== null || !currentPassword || !newPassword}
              onClick={() => void changePassword()}
            >
              {action.busy === 'password' ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
