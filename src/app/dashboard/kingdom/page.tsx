"use client";

import { useEffect, useState } from 'react';
import Notices from '@/components/Notices';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import { apiPost } from '@/lib/client/api';
import { useGameAction, useGameData } from '@/lib/client/useGameData';

interface Member {
  id: number;
  provinceName: string | null;
  rulerName: string | null;
  networth: number | null;
  acres: number | null;
  race: string;
  votes: number;
  isKing: boolean;
  isMe: boolean;
}

interface Relation {
  relationId: number;
  kiId?: number;
  name?: string | null;
  declaredByMe?: boolean;
}

interface Diplomacy {
  isKing: boolean;
  allies: Relation[];
  wars: Relation[];
  incomingProposals: Relation[];
  outgoingProposals: Relation[];
  otherKingdoms: Array<{ id: number; name: string | null }>;
}

interface KingdomData {
  inKingdom: boolean;
  kingdom: {
    id: number;
    name: string | null;
    king: number;
    banner: string | null;
    signature: string | null;
    numProvinces: number;
    relationMerge: string | null;
  } | null;
  members: Member[];
  myVote?: number;
  diplomacy?: Diplomacy | null;
  kingdomNews?: Array<{ id: number; message: string; createdAt: string }>;
}

type KingdomAction = Record<string, unknown> & { action: string };

export default function KingdomPage() {
  const { data, error, loading, refresh } = useGameData<KingdomData>('/api/kingdom');
  const action = useGameAction();
  const [profile, setProfile] = useState({ name: '', banner: '', signature: '' });
  const [diploTarget, setDiploTarget] = useState('');

  useEffect(() => {
    if (!data?.kingdom) return;
    setProfile({
      name: data.kingdom.name ?? '',
      banner: data.kingdom.banner ?? '',
      signature: data.kingdom.signature ?? '',
    });
  }, [data?.kingdom]);

  if (!data) {
    return loading ? <PageSkeleton cards={3} /> : <Notices error={error || 'The court could not be gathered.'} />;
  }

  const act = (body: KingdomAction, key = body.action) => action.run(key, () => apiPost<{ message: string }>('/api/kingdom', body), result => {
    void refresh();
    return result.message;
  });

  const kingdom = data.kingdom;
  const members = data.members;
  const diplomacy = data.diplomacy ?? null;
  const kingdomNews = data.kingdomNews ?? [];
  const myVote = data.myVote ?? 0;
  const busy = action.busy !== null;

  return (
    <>
      <PageBanner
        image="/game/headers/header-kingdom.webp"
        title={data.inKingdom ? (kingdom?.name || 'Your Kingdom') : 'Independent'}
        subtitle={data.inKingdom ? 'Provinces united under one banner.' : 'You answer to no crown, for now.'}
        right={data.inKingdom ? <div className="networth-badge">{members.length} Province{members.length === 1 ? '' : 's'}</div> : undefined}
      />

      <Notices error={error || action.error} notice={action.notice} />

      {!data.inKingdom || !kingdom ? (
        <section className="stat-card">
          <h2>No Kingdom Assigned</h2>
          <p className="empty-state">Kingdom membership is chosen when a province is founded and remains fixed for the age.</p>
        </section>
      ) : (
        <>
          {(kingdom.banner || kingdom.signature) && (
            <section className="stat-card kingdom-banner mb-2">
              {kingdom.banner && <img src={kingdom.banner} alt={`${kingdom.name} banner`} />}
              {kingdom.signature && <p>{kingdom.signature}</p>}
            </section>
          )}

          {diplomacy?.isKing && (
            <section className="stat-card mb-2">
              <h2>Kingdom Management</h2>
              <div className="stack">
                <label className="game-field">
                  <span>Name</span>
                  <input value={profile.name} maxLength={40} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="game-field">
                  <span>Banner URL</span>
                  <input value={profile.banner} maxLength={100} onChange={event => setProfile(current => ({ ...current, banner: event.target.value }))} />
                </label>
                <label className="game-field">
                  <span>Signature</span>
                  <input value={profile.signature} maxLength={100} onChange={event => setProfile(current => ({ ...current, signature: event.target.value }))} />
                </label>
                <div className="responsive-actions row">
                  <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void act({ action: 'updateKingdom', ...profile })}>
                    Save profile
                  </button>
                  {diplomacy.allies.length > 0 && (
                    <button type="button" className="btn-primary btn-small btn-muted" disabled={busy} onClick={() => void act({ action: 'toggleMerge', enabled: kingdom.relationMerge !== 'true' })}>
                      {kingdom.relationMerge === 'true' ? 'Withdraw merge consent' : 'Consent to allied merge'}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="stat-card table-card">
            <h2>Members</h2>
            <table className="wide-table mobile-data-table">
              <thead>
                <tr>
                  <th>Province</th>
                  <th>Ruler</th>
                  <th>Race</th>
                  <th className="text-right">Acres</th>
                  <th className="text-right">Networth</th>
                  <th className="text-center">Votes</th>
                  <th><span className="sr-only">Vote</span></th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className={member.isMe ? 'rank-me' : ''}>
                    <td data-label="Province">
                      {member.provinceName}
                      {member.isKing && <span className="rank-crown" title="King"> ♛</span>}
                    </td>
                    <td data-label="Ruler">{member.rulerName}</td>
                    <td data-label="Race">{member.race}</td>
                    <td data-label="Acres" className="text-right">{(member.acres ?? 0).toLocaleString()}</td>
                    <td data-label="Networth" className="text-right">{(member.networth ?? 0).toLocaleString()}</td>
                    <td data-label="Votes" className="text-center">{member.votes}</td>
                    <td data-label="Action" className="text-right">
                      {myVote === member.id ? (
                        <span className="text-gold text-small">★ Voted</span>
                      ) : (
                        <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void act({ action: 'vote', targetPID: member.id }, `vote-${member.id}`)}>
                          Vote
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted text-small mt-1 mb-0">
              The King (crowned) gains an income bonus each tick. A candidate needs votes from at least half of the kingdom before the crown changes hands. Kingdom membership is fixed for the age.
            </p>
          </section>

          {diplomacy && (
            <section className="stat-card mt-2">
              <h2>Diplomacy</h2>
              {!diplomacy.isKing && <p className="text-muted text-small mt-0">Only the King can change diplomatic relations.</p>}

              {(diplomacy.allies.length > 0 || diplomacy.wars.length > 0) && (
                <div className="diplomacy-list divided mb-1">
                  {diplomacy.allies.map(ally => (
                    <div key={`ally-${ally.relationId}`} className="responsive-split">
                      <span className="text-success">Allied with <strong>{ally.name}</strong></span>
                      {diplomacy.isKing && <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void act({ action: 'cancelRelation', relationId: ally.relationId }, `rel-${ally.relationId}`)}>End alliance</button>}
                    </div>
                  ))}
                  {diplomacy.wars.map(war => (
                    <div key={`war-${war.relationId}`} className="responsive-split">
                      <span className="text-danger">At war with <strong>{war.name}</strong></span>
                      {diplomacy.isKing && <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void act({ action: 'cancelRelation', relationId: war.relationId }, `rel-${war.relationId}`)}>Sue for peace</button>}
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.isKing && diplomacy.incomingProposals.length > 0 && (
                <div className="diplomacy-list mb-1">
                  <h3 className="text-small">Alliance offers</h3>
                  {diplomacy.incomingProposals.map(proposal => (
                    <div key={`in-${proposal.relationId}`} className="responsive-split">
                      <span>{proposal.name} proposes an alliance</span>
                      <span className="row">
                        <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void act({ action: 'acceptRelation', relationId: proposal.relationId }, `rel-${proposal.relationId}`)}>Accept</button>
                        <button type="button" className="btn-primary btn-small btn-muted" disabled={busy} onClick={() => void act({ action: 'cancelRelation', relationId: proposal.relationId }, `rel-${proposal.relationId}`)}>Decline</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.outgoingProposals.length > 0 && (
                <div className="diplomacy-list mb-1">
                  {diplomacy.outgoingProposals.map(proposal => (
                    <div key={`out-${proposal.relationId}`} className="responsive-split">
                      <span className="text-muted">Alliance offered to {proposal.name} (pending)</span>
                      {diplomacy.isKing && <button type="button" className="btn-primary btn-small btn-muted" disabled={busy} onClick={() => void act({ action: 'cancelRelation', relationId: proposal.relationId }, `rel-${proposal.relationId}`)}>Withdraw</button>}
                    </div>
                  ))}
                </div>
              )}

              {diplomacy.isKing && diplomacy.otherKingdoms.length > 0 && (
                <div className="diplomacy-form">
                  <select value={diploTarget} aria-label="Kingdom" onChange={event => setDiploTarget(event.target.value)}>
                    <option value="">Choose a kingdom…</option>
                    {diplomacy.otherKingdoms.map(other => <option key={other.id} value={other.id}>{other.name}</option>)}
                  </select>
                  <button type="button" className="btn-primary btn-small" disabled={busy || !diploTarget} onClick={() => void act({ action: 'proposeAlly', kingdomId: Number(diploTarget) })}>Propose alliance</button>
                  <button type="button" className="btn-primary btn-small btn-danger" disabled={busy || !diploTarget} onClick={() => void act({ action: 'declareWar', kingdomId: Number(diploTarget) })}>Declare war</button>
                </div>
              )}
            </section>
          )}

          <section className="stat-card mt-2">
            <h2>Kingdom News</h2>
            {kingdomNews.length === 0 ? (
              <p className="empty-state">No kingdom news has been recorded yet.</p>
            ) : (
              <div className="kingdom-news divided">
                {kingdomNews.map(item => (
                  <div key={item.id}>
                    <div>{item.message}</div>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
