"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackNotice from '@/components/FeedbackNotice';
import { apiGet, apiPost, errorMessage } from '@/lib/client/api';

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

export default function CreateProvince() {
  const router = useRouter();
  const [provinceName, setProvinceName] = useState('');
  const [rulerName, setRulerName] = useState('');
  const [gender, setGender] = useState('M');
  const [races, setRaces] = useState<Race[]>([]);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [kingdoms, setKingdoms] = useState<KingdomOption[]>([]);
  const [kingdomChoice, setKingdomChoice] = useState('random');
  const [newKingdomName, setNewKingdomName] = useState('');
  const [kingdomPassword, setKingdomPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    apiGet<{ races?: Race[] }>('/api/races')
      .then(data => {
        setRaces(data.races ?? []);
        if (data.races?.length) setRaceId(data.races[0].id);
      })
      .catch(() => setError('Could not load races'));
    apiGet<{ kingdoms?: KingdomOption[] }>('/api/kingdoms')
      .then(data => setKingdoms(data.kingdoms ?? []))
      .catch(() => {});
  }, []);

  const mode = kingdomChoice === 'random' ? 'random' : kingdomChoice === 'new' ? 'new' : 'join';
  const selectedJoin = kingdoms.find(kingdom => `join:${kingdom.id}` === kingdomChoice);
  const needsJoinPassword = mode === 'join' && selectedJoin?.hasPassword;
  const selectedRace = races.find(race => race.id === raceId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    const kingdom = mode === 'new'
      ? { mode: 'new', name: newKingdomName, password: kingdomPassword }
      : mode === 'join'
        ? { mode: 'join', id: selectedJoin?.id, password: kingdomPassword }
        : { mode: 'random' };
    try {
      await apiPost('/api/province/create', { provinceName, rulerName, gender, race: raceId, kingdom });
      router.push('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, 'Failed to create province'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="auth-box create-box">
        <h2>Found Your Province</h2>
        <p className="subtitle">Every empire has a beginning. Name your lands, choose your people, and claim your title. Your province name is fixed for this age.</p>

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="provinceName">Province Name</label>
            <input type="text" id="provinceName" placeholder="e.g. The Sapphire Valley" value={provinceName} onChange={event => setProvinceName(event.target.value)} maxLength={40} required />
          </div>

          <div className="input-group">
            <label htmlFor="rulerName">Ruler Title &amp; Name</label>
            <input type="text" id="rulerName" placeholder="e.g. Lord Alexander" value={rulerName} onChange={event => setRulerName(event.target.value)} maxLength={40} required />
          </div>

          <div className="input-group">
            <span className="input-label" id="race-label">Race</span>
            <div className="race-picker" role="radiogroup" aria-labelledby="race-label">
              {races.map(race => {
                const selected = raceId === race.id;
                return (
                  <button
                    key={race.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`race-option${selected ? ' is-selected' : ''}`}
                    onClick={() => setRaceId(race.id)}
                  >
                    <img src={`/game/races/${race.name.toLowerCase()}.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <strong>{race.name}</strong>
                  </button>
                );
              })}
            </div>
            {selectedRace && (
              <p className="race-description" aria-live="polite">
                {selectedRace.description}
                <br />
                <span className="race-stats">
                  Offense {selectedRace.offenseBonus}% · Defense {selectedRace.defenseBonus}% · Income {selectedRace.incomeBonus}% · Magic {selectedRace.magicBonus}%
                </span>
              </p>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="kingdom">Kingdom</label>
            <select id="kingdom" value={kingdomChoice} onChange={event => setKingdomChoice(event.target.value)}>
              <option value="random">Random (recommended)</option>
              <option value="new">Create a new kingdom…</option>
              {kingdoms.length > 0 && <option disabled>──────────</option>}
              {kingdoms.map(kingdom => (
                <option key={kingdom.id} value={`join:${kingdom.id}`}>
                  {kingdom.name} ({kingdom.numProvinces}/{kingdom.cap}){kingdom.hasPassword ? ' (password)' : ''}
                </option>
              ))}
            </select>

            {mode === 'new' && (
              <div className="kingdom-extra">
                <input type="text" maxLength={40} placeholder="New kingdom name" aria-label="New kingdom name" value={newKingdomName} onChange={event => setNewKingdomName(event.target.value)} required />
                <input type="password" maxLength={64} placeholder="Join password (optional, leave blank for open)" aria-label="Kingdom join password" value={kingdomPassword} onChange={event => setKingdomPassword(event.target.value)} />
                <p>You will be the King of this new kingdom. Kingdoms hold up to three provinces and membership is fixed for the age.</p>
              </div>
            )}
            {needsJoinPassword && (
              <div className="kingdom-extra">
                <input type="password" maxLength={64} placeholder="Kingdom password" aria-label="Kingdom password" value={kingdomPassword} onChange={event => setKingdomPassword(event.target.value)} required />
              </div>
            )}
          </div>

          <div className="input-group">
            <span className="input-label">Gender</span>
            <div className="gender-options">
              <label>
                <input type="radio" name="gender" value="M" checked={gender === 'M'} onChange={() => setGender('M')} /> Male
              </label>
              <label>
                <input type="radio" name="gender" value="F" checked={gender === 'F'} onChange={() => setGender('F')} /> Female
              </label>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading || !raceId}>
            {isLoading ? 'Founding…' : 'Found Province'}
          </button>
        </form>
      </div>
    </div>
  );
}
