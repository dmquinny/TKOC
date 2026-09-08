"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackNotice from '@/components/FeedbackNotice';

interface Race {
  id: number;
  name: string;
  description: string;
  offenseBonus: number;
  defenseBonus: number;
  incomeBonus: number;
  magicBonus: number;
}

interface KingdomOption {
  id: number;
  name: string;
  numProvinces: number;
  cap: number;
  hasPassword: boolean;
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(10,8,5,0.7)',
  border: '1px solid var(--stone-border)',
  color: 'var(--parchment)',
  padding: '0.8rem 1rem',
  borderRadius: '4px',
  fontSize: '1rem',
};

export default function CreateProvince() {
  const router = useRouter();
  const [provinceName, setProvinceName] = useState('');
  const [rulerName, setRulerName] = useState('');
  const [gender, setGender] = useState('M');
  const [races, setRaces] = useState<Race[]>([]);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [kingdoms, setKingdoms] = useState<KingdomOption[]>([]);
  const [kingdomChoice, setKingdomChoice] = useState('random'); // 'random' | 'new' | 'join:<id>'
  const [newKingdomName, setNewKingdomName] = useState('');
  const [kingdomPassword, setKingdomPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/races').then(r => r.json()).then(d => {
      setRaces(d.races || []);
      if (d.races?.length) setRaceId(d.races[0].id);
    }).catch(() => setError('Could not load races'));
    fetch('/api/kingdoms').then(r => r.json()).then(d => setKingdoms(d.kingdoms || [])).catch(() => {});
  }, []);

  const mode = kingdomChoice === 'random' ? 'random' : kingdomChoice === 'new' ? 'new' : 'join';
  const selectedJoin = kingdoms.find(k => `join:${k.id}` === kingdomChoice);
  const needsJoinPassword = mode === 'join' && selectedJoin?.hasPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const kingdom =
      mode === 'new'
        ? { mode: 'new', name: newKingdomName, password: kingdomPassword }
        : mode === 'join'
          ? { mode: 'join', id: selectedJoin?.id, password: kingdomPassword }
          : { mode: 'random' };

    try {
      const res = await fetch('/api/province/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provinceName, rulerName, gender, race: raceId, kingdom }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create province');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRace = races.find(r => r.id === raceId);

  return (
    <div className="landing-container">
      <div className="auth-box" style={{ width: '100%', maxWidth: '560px' }}>
        <h2>Found Your Province</h2>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>Every empire has a beginning. Name your lands, choose your people, and claim your title. Your province name is fixed for this age.</p>

        {error && (
          <FeedbackNotice tone="error">
            {error}
          </FeedbackNotice>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="provinceName">Province Name</label>
            <input type="text" id="provinceName" placeholder="e.g. The Sapphire Valley" value={provinceName} onChange={(e) => setProvinceName(e.target.value)} maxLength={40} required />
          </div>

          <div className="input-group">
            <label htmlFor="rulerName">Ruler Title &amp; Name</label>
            <input type="text" id="rulerName" placeholder="e.g. Lord Alexander" value={rulerName} onChange={(e) => setRulerName(e.target.value)} maxLength={40} required />
          </div>

          <div className="input-group">
            <span className="input-label" id="race-label">Race</span>
            <div className="race-picker" role="radiogroup" aria-labelledby="race-label">
              {races.map(r => {
                const selected = raceId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`race-option${selected ? ' is-selected' : ''}`}
                    onClick={() => setRaceId(r.id)}
                  >
                    <img src={`/game/races/${r.name.toLowerCase()}.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <strong>{r.name}</strong>
                  </button>
                );
              })}
            </div>
            {selectedRace && (
              <p className="race-description" aria-live="polite">
                {selectedRace.description}
                <br />
                <span style={{ color: 'var(--gold)' }}>
                  Offense {selectedRace.offenseBonus}% · Defense {selectedRace.defenseBonus}% · Income {selectedRace.incomeBonus}% · Magic {selectedRace.magicBonus}%
                </span>
              </p>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="kingdom">Kingdom</label>
            <select id="kingdom" value={kingdomChoice} onChange={(e) => setKingdomChoice(e.target.value)} style={fieldStyle}>
              <option value="random">Random (recommended)</option>
              <option value="new">Create a new kingdom…</option>
              {kingdoms.length > 0 && <option disabled>──────────</option>}
              {kingdoms.map(k => (
                <option key={k.id} value={`join:${k.id}`}>
                  {k.name} ({k.numProvinces}/{k.cap}){k.hasPassword ? ' (password)' : ''}
                </option>
              ))}
            </select>

            {mode === 'new' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                <input type="text" maxLength={40} placeholder="New kingdom name" value={newKingdomName} onChange={(e) => setNewKingdomName(e.target.value)} style={fieldStyle} required />
                <input type="password" maxLength={64} placeholder="Join password (optional — leave blank for open)" value={kingdomPassword} onChange={(e) => setKingdomPassword(e.target.value)} style={fieldStyle} />
                <p style={{ fontSize: '0.8rem', color: 'var(--parchment-dim)', margin: 0 }}>You will be the King of this new kingdom.</p>
              </div>
            )}
            {needsJoinPassword && (
              <input type="password" maxLength={64} placeholder="Kingdom password" value={kingdomPassword} onChange={(e) => setKingdomPassword(e.target.value)} style={{ ...fieldStyle, marginTop: '0.75rem' }} required />
            )}
          </div>

          <div className="input-group">
            <label>Gender</label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--parchment)', textTransform: 'none', letterSpacing: 0 }}>
                <input type="radio" name="gender" value="M" checked={gender === 'M'} onChange={() => setGender('M')} /> Male
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--parchment)', textTransform: 'none', letterSpacing: 0 }}>
                <input type="radio" name="gender" value="F" checked={gender === 'F'} onChange={() => setGender('F')} /> Female
              </label>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading || !raceId}>
            {isLoading ? 'Founding...' : 'Found Province'}
          </button>
        </form>
      </div>
    </div>
  );
}
