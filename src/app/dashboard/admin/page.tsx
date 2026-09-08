"use client";

import {
  Activity,
  AlertTriangle,
  Ban,
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Eye,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import FeedbackNotice from '@/components/FeedbackNotice';
import ActionBar from '@/components/ActionBar';
import FormField from '@/components/FormField';
import GamePanel from '@/components/GamePanel';
import ConfirmDialog from '@/components/ConfirmDialog';

type HealthData = {
  status: 'ok' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  checkedAt: string;
  tick?: {
    healthy: boolean;
    age: number;
    number: number;
    lastTickAt: string | null;
    nextTickAt: string | null;
    lagSeconds: number;
    lastDurationMs: number | null;
    intervalSeconds: number;
  };
};

type OperationalEvent = {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'error';
  summary: string;
  detail?: string | null;
  requestId?: string | null;
  route?: string | null;
  userId?: number | null;
  pID?: number | null;
  createdAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: number | null;
};

type ProvinceSummary = {
  id: number;
  provinceName: string | null;
  rulerName: string | null;
  kiID: number;
  kingdomName: string | null;
  status: string;
  acres: number | null;
  networth: number | null;
  protection: number | null;
  vacation: boolean;
};

type AdminUser = {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  country: string | null;
  status: string | null;
  pID: number;
  access: number | null;
  created: string;
  activeSessions: number | null;
  province: ProvinceSummary | null;
};

type AdminData = {
  admin: { id: number; username: string };
  stats: {
    provinces: number;
    alive: number;
    killed: number;
    protected: number;
    vacation: number;
    kingdoms: number;
    users: number;
    newUsers24h: number;
    activeOrders: number;
    exploreOrders: number;
    buildOrders: number;
    researchOrders: number;
    militaryOrders: number;
    armiesAway: number;
    activeEffects: number;
  };
  state: {
    age: number;
    tick: number;
    phase: string;
    lastTickAt?: string | null;
    nextTickAt?: string | null;
  } | null;
  users: {
    items: AdminUser[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  operational: {
    errors24h: number;
    warnings24h: number;
    openEvents: number;
    events: OperationalEvent[];
    kinds: string[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  broadcasts: OperationalEvent[];
  features: { startFresh: boolean };
};

type AdminTab = 'overview' | 'players' | 'operations' | 'controls';
type DialogAction = {
  key: string;
  title: string;
  description: string;
  confirmLabel: string;
  confirmationText?: string;
  tone?: 'default' | 'warning' | 'danger';
  body: Record<string, unknown>;
};

const audienceLabels: Record<string, string> = {
  all: 'All living provinces',
  active: 'All active provinces',
  protected: 'Protected provinces only',
  unprotected: 'Unprotected active provinces',
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

function formatDuration(milliseconds: number | null | undefined) {
  if (milliseconds === null || milliseconds === undefined) return 'Not yet';
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(1)} sec`;
}

function formatLag(seconds: number | undefined) {
  if (!seconds) return 'On time';
  if (seconds < 60) return `${seconds} sec late`;
  return `${Math.floor(seconds / 60)} min late`;
}

function broadcastDetails(detail: string | null | undefined) {
  if (!detail) return null;
  try {
    return JSON.parse(detail) as { audience?: string; recipients?: number; message?: string };
  } catch {
    return null;
  }
}

function Pager({
  page,
  totalPages,
  total,
  label,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="admin-pager" aria-label={`${label} pages`}>
      <span>{formatNumber(total)} {label}</span>
      <div>
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>Page {page} of {totalPages}</strong>
        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}

export default function Admin() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [notAuth, setNotAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const [audience, setAudience] = useState('all');
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [severity, setSeverity] = useState('all');
  const [eventKind, setEventKind] = useState('all');
  const [eventRoute, setEventRoute] = useState('');
  const [requestQuery, setRequestQuery] = useState('');
  const [acknowledgement, setAcknowledgement] = useState('all');
  const [hours, setHours] = useState('24');
  const [eventPage, setEventPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      userPage: String(userPage),
      userQuery,
      userStatus,
      eventPage: String(eventPage),
      severity,
      eventKind,
      eventRoute,
      requestQuery,
      acknowledgement,
      hours,
    });
    return params.toString();
  }, [
    acknowledgement,
    eventKind,
    eventPage,
    eventRoute,
    hours,
    requestQuery,
    severity,
    userPage,
    userQuery,
    userStatus,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRefreshing(true);
      try {
        const response = await fetch(`/api/admin?${queryString}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.push('/');
          return;
        }
        if (response.status === 403) {
          setNotAuth(true);
          return;
        }
        const result = await response.json() as AdminData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? 'Administration could not be loaded.');
        setData(result);
        setSelectedUser(current => {
          if (!current) return null;
          return result.users.items.find(user => user.id === current.id) ?? current;
        });
        setError('');
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError(errorMessage(loadError));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [queryString, refreshNonce, router]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const result = await response.json() as HealthData;
      setHealth(result);
      if (!response.ok) setHealthError('The database health check failed.');
    } catch {
      setHealthError('System health could not be loaded.');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const timer = window.setInterval(() => { void loadHealth(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadHealth]);

  const act = async (body: Record<string, unknown>, key: string) => {
    setBusyKey(key);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The action failed.');
      setNotice(result.message ?? 'Action completed.');
      if (body.action === 'broadcast') setBroadcast('');
      setRefreshNonce(value => value + 1);
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError));
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const confirmDialog = async (confirmation?: string) => {
    if (!dialog) return;
    const current = dialog;
    const completed = await act(
      confirmation ? { ...current.body, confirmation } : current.body,
      current.key,
    );
    if (completed) setDialog(null);
  };

  const openOperations = (nextSeverity = 'all', nextAcknowledgement = 'all') => {
    setSeverity(nextSeverity);
    setAcknowledgement(nextAcknowledgement);
    setEventPage(1);
    setActiveTab('operations');
  };

  if (loading) return <PageSkeleton cards={4} />;

  if (notAuth) {
    return (
      <>
        <PageBanner image="/game/headers/header-admin.webp" title="Administration" subtitle="Restricted." />
        <section className="stat-card"><p className="empty-state">You are not an administrator.</p></section>
      </>
    );
  }

  const tickHealthy = Boolean(health?.tick?.healthy);
  const selectedIsBusy = selectedUser ? busyKey === `user-${selectedUser.id}` : false;
  const worldMetrics: Array<[string, number, LucideIcon]> = data ? [
    ['Living provinces', data.stats.alive, Users],
    ['Killed provinces', data.stats.killed, Skull],
    ['In protection', data.stats.protected, ShieldCheck],
    ['On vacation', data.stats.vacation, Clock3],
    ['Active orders', data.stats.activeOrders, Activity],
    ['Armies away', data.stats.armiesAway, ShieldAlert],
    ['New users (24h)', data.stats.newUsers24h, CircleUserRound],
    ['Active effects', data.stats.activeEffects, BellRing],
  ] : [];

  return (
    <div className="admin-page">
      <div>
        <PageBanner
          image="/game/headers/header-admin.webp"
          title="Administration"
          subtitle="World operations and moderation."
          right={(
            <div className="networth-badge">
              Age {data?.state?.age ?? 1} &middot; {data?.state?.phase ?? 'Unknown'} &middot; Tick {data?.state?.tick ?? 0}
            </div>
          )}
        />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}

        <section className="admin-status-strip" aria-label="System status" aria-live="polite">
          <div className="admin-status-brand">
            <span className={`status-light ${health?.database === 'connected' ? 'is-good' : 'is-bad'}`} />
            <div><small>Database</small><strong>{health?.database === 'connected' ? 'Connected' : 'Unavailable'}</strong></div>
          </div>
          <div>
            <Clock3 size={18} />
            <div><small>Scheduler</small><strong>{!health?.tick ? 'Checking' : tickHealthy ? 'On schedule' : 'Delayed'}</strong></div>
          </div>
          <div>
            <Activity size={18} />
            <div><small>Last tick</small><strong>{formatDateTime(health?.tick?.lastTickAt)}</strong></div>
          </div>
          <div>
            <AlertTriangle size={18} />
            <div><small>Open events</small><strong>{formatNumber(data?.operational.openEvents)}</strong></div>
          </div>
          <button
            className="admin-icon-button"
            type="button"
            aria-label="Refresh administration data"
            disabled={healthLoading || refreshing}
            onClick={() => {
              void loadHealth();
              setRefreshNonce(value => value + 1);
            }}
          >
            <RefreshCw size={18} className={healthLoading || refreshing ? 'is-spinning' : ''} />
          </button>
        </section>
        {healthError && <div className="health-warning">{healthError}</div>}

        <nav className="admin-tabs" aria-label="Administration sections">
          {([
            ['overview', Activity, 'Overview'],
            ['players', Users, 'Players'],
            ['operations', ShieldAlert, 'Operations'],
            ['controls', Skull, 'World Controls'],
          ] as const).map(([tab, Icon, label]) => (
            <button
              key={tab}
              type="button"
              aria-current={activeTab === tab ? 'page' : undefined}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {tab === 'operations' && Boolean(data?.operational.openEvents) && (
                <em>{data?.operational.openEvents}</em>
              )}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && data && (
          <div className="admin-tab-content">
            <section className="admin-metric-grid" aria-label="World metrics">
              {worldMetrics.map(([label, value, Icon]) => (
                <article className="admin-metric" key={label}>
                  <Icon size={20} />
                  <span>{label}</span>
                  <strong>{formatNumber(value)}</strong>
                </article>
              ))}
            </section>

            <div className="admin-overview-grid">
              <GamePanel
                eyebrow="System"
                title="Scheduler detail"
                actions={(
                  <span className={`admin-health-pill ${tickHealthy ? 'is-good' : 'is-bad'}`}>
                    {tickHealthy ? 'Healthy' : 'Needs attention'}
                  </span>
                )}
              >
                <dl className="admin-detail-list">
                  <div><dt>Last completed</dt><dd>{formatDateTime(health?.tick?.lastTickAt)}</dd></div>
                  <div><dt>Next scheduled</dt><dd>{formatDateTime(health?.tick?.nextTickAt)}</dd></div>
                  <div><dt>Last duration</dt><dd>{formatDuration(health?.tick?.lastDurationMs)}</dd></div>
                  <div><dt>Schedule</dt><dd>{health?.tick ? `Every ${Math.round(health.tick.intervalSeconds / 60)} minutes` : 'Unavailable'}</dd></div>
                  <div><dt>Current lag</dt><dd>{formatLag(health?.tick?.lagSeconds)}</dd></div>
                  <div><dt>Checked</dt><dd>{formatDateTime(health?.checkedAt)}</dd></div>
                </dl>
              </GamePanel>

              <GamePanel eyebrow="Attention" title="Operational alerts">
                <button className="admin-alert-row is-error" type="button" onClick={() => openOperations('error')}>
                  <span><AlertTriangle size={18} />Errors in 24 hours</span>
                  <strong>{data.operational.errors24h}</strong>
                </button>
                <button className="admin-alert-row is-warning" type="button" onClick={() => openOperations('warning')}>
                  <span><ShieldAlert size={18} />Warnings in 24 hours</span>
                  <strong>{data.operational.warnings24h}</strong>
                </button>
                <button className="admin-alert-row" type="button" onClick={() => openOperations('all', 'open')}>
                  <span><Eye size={18} />Awaiting acknowledgement</span>
                  <strong>{data.operational.openEvents}</strong>
                </button>
              </GamePanel>
            </div>

            <GamePanel
              className="admin-broadcast-panel"
              eyebrow="Communication"
              title="World broadcast"
              actions={<span className="admin-character-count">{broadcast.length}/280</span>}
            >
              <div className="admin-broadcast-grid">
                <div>
                  <FormField label="Audience">
                    {(id) => (
                      <select id={id} value={audience} onChange={event => setAudience(event.target.value)}>
                        {Object.entries(audienceLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    )}
                  </FormField>
                  <FormField label="Message" hint="All recipients receive this in their province news. World-wide messages also appear in chat.">
                    {(id, hintId) => (
                      <textarea
                        id={id}
                        aria-describedby={hintId}
                        value={broadcast}
                        maxLength={280}
                        rows={5}
                        onChange={event => setBroadcast(event.target.value)}
                        placeholder="Write a message from the Herald..."
                      />
                    )}
                  </FormField>
                  <ActionBar>
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={!broadcast.trim() || busyKey === 'broadcast'}
                      onClick={() => setDialog({
                        key: 'broadcast',
                        title: 'Send this broadcast?',
                        description: `${audienceLabels[audience]} will receive the message shown in the preview.`,
                        confirmLabel: 'Send broadcast',
                        body: { action: 'broadcast', message: broadcast, audience },
                      })}
                    >
                      <Megaphone size={17} /> Review and send
                    </button>
                  </ActionBar>
                </div>
                <aside className="admin-broadcast-preview">
                  <small>Recipient preview</small>
                  <strong>Herald</strong>
                  <p>{broadcast.trim() || 'Your message will appear here.'}</p>
                  <span>{audienceLabels[audience]}</span>
                </aside>
              </div>

              <div className="admin-broadcast-history">
                <h3>Recent broadcasts</h3>
                {!data.broadcasts.length ? (
                  <p className="empty-state">No broadcasts have been sent.</p>
                ) : data.broadcasts.map(item => {
                  const detail = broadcastDetails(item.detail);
                  return (
                    <article key={item.id}>
                      <div>
                        <strong>{detail?.message ?? item.summary}</strong>
                        <small>{formatDateTime(item.createdAt)} &middot; {audienceLabels[detail?.audience ?? 'all'] ?? detail?.audience}</small>
                      </div>
                      <span>{formatNumber(detail?.recipients)} recipients</span>
                    </article>
                  );
                })}
              </div>
            </GamePanel>
          </div>
        )}

        {activeTab === 'players' && data && (
          <div className="admin-tab-content">
            <GamePanel
              eyebrow="Moderation"
              title="Players"
              actions={refreshing ? <span className="admin-loading-label">Updating...</span> : undefined}
            >
              <div className="admin-filter-bar admin-player-filters">
                <label className="admin-search-field">
                  <Search size={18} />
                  <span className="sr-only">Search players</span>
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={userQuery}
                    onChange={event => {
                      setUserQuery(event.target.value);
                      setUserPage(1);
                    }}
                    placeholder="Username, email, ruler, or province..."
                  />
                  {userQuery && (
                    <button type="button" aria-label="Clear search" onClick={() => setUserQuery('')}><X size={16} /></button>
                  )}
                </label>
                <label>
                  <span className="sr-only">Account status</span>
                  <select value={userStatus} onChange={event => { setUserStatus(event.target.value); setUserPage(1); }}>
                    <option value="all">All accounts</option>
                    <option value="active">Active players</option>
                    <option value="banned">Banned players</option>
                    <option value="admin">Administrators</option>
                  </select>
                </label>
              </div>

              <div className="admin-table-wrap">
                <table className="wide-table admin-users-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Province</th>
                      <th>Kingdom</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.items.map(user => (
                      <tr key={user.id} className={selectedUser?.id === user.id ? 'is-selected' : ''}>
                        <td data-label="Player">
                          <button className="admin-user-link" type="button" onClick={() => setSelectedUser(user)}>
                            <strong>{user.username ?? `User ${user.id}`}</strong>
                            <small>{user.email ?? 'No email'}</small>
                          </button>
                        </td>
                        <td data-label="Province">{user.province?.provinceName ?? 'No province'}</td>
                        <td data-label="Kingdom">{user.province?.kingdomName ?? '-'}</td>
                        <td data-label="Status">
                          <span className={`admin-status-badge ${user.status === 'Banned' ? 'is-banned' : user.access === 1 ? 'is-admin' : 'is-active'}`}>
                            {user.access === 1 ? 'Administrator' : user.status ?? 'Active'}
                          </span>
                        </td>
                        <td data-label="Joined">{formatDateTime(user.created)}</td>
                        <td data-label="Actions">
                          <button className="admin-icon-button" type="button" aria-label={`View ${user.username ?? 'user'}`} onClick={() => setSelectedUser(user)}>
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.users.items.length && <p className="empty-state">No players match these filters.</p>}
              </div>
              <Pager page={data.users.page} totalPages={data.users.totalPages} total={data.users.total} label="players" onChange={setUserPage} />
            </GamePanel>
          </div>
        )}

        {activeTab === 'operations' && data && (
          <div className="admin-tab-content">
            <GamePanel
              className="operations-panel"
              eyebrow="Diagnostics and audit"
              title="Operational events"
              actions={(
                <div className="operations-totals">
                  <span className="event-count event-error">{data.operational.errors24h} errors</span>
                  <span className="event-count event-warning">{data.operational.warnings24h} warnings</span>
                </div>
              )}
            >
              <div className="admin-filter-bar admin-operation-filters">
                <label>
                  <span>Severity</span>
                  <select value={severity} onChange={event => { setSeverity(event.target.value); setEventPage(1); }}>
                    <option value="all">All severities</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Information</option>
                  </select>
                </label>
                <label>
                  <span>Event type</span>
                  <select value={eventKind} onChange={event => { setEventKind(event.target.value); setEventPage(1); }}>
                    <option value="all">All event types</option>
                    {data.operational.kinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </label>
                <label>
                  <span>Time range</span>
                  <select value={hours} onChange={event => { setHours(event.target.value); setEventPage(1); }}>
                    <option value="1">Last hour</option>
                    <option value="24">Last 24 hours</option>
                    <option value="168">Last 7 days</option>
                    <option value="720">Last 30 days</option>
                    <option value="2160">Last 90 days</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value={acknowledgement} onChange={event => { setAcknowledgement(event.target.value); setEventPage(1); }}>
                    <option value="all">All events</option>
                    <option value="open">Needs acknowledgement</option>
                    <option value="acknowledged">Acknowledged</option>
                  </select>
                </label>
                <label>
                  <span>Route contains</span>
                  <input type="text" autoComplete="off" spellCheck={false} value={eventRoute} onChange={event => { setEventRoute(event.target.value); setEventPage(1); }} placeholder="/api/..." />
                </label>
                <label>
                  <span>Request reference</span>
                  <input type="text" autoComplete="off" spellCheck={false} value={requestQuery} onChange={event => { setRequestQuery(event.target.value); setEventPage(1); }} placeholder="Request ID..." />
                </label>
              </div>

              {!data.operational.events.length ? (
                <p className="empty-state">No operational events match these filters.</p>
              ) : (
                <div className="operations-list admin-operations-list">
                  {data.operational.events.map(event => (
                    <article className={`operation-event event-${event.severity} ${event.acknowledgedAt ? 'is-acknowledged' : ''}`} key={event.id}>
                      <div className="operation-event-main">
                        <span className="event-severity">{event.severity}</span>
                        <div>
                          <strong>{event.summary}</strong>
                          <small>
                            {formatDateTime(event.createdAt)}
                            {event.kind ? ` · ${event.kind}` : ''}
                            {event.route ? ` · ${event.route}` : ''}
                          </small>
                        </div>
                        {event.acknowledgedAt ? (
                          <span className="admin-acknowledged"><Check size={15} /> Acknowledged</span>
                        ) : event.severity === 'info' ? (
                          <span className="admin-informational">Informational</span>
                        ) : (
                          <button
                            className="admin-ack-button"
                            type="button"
                            disabled={busyKey === `event-${event.id}`}
                            onClick={() => void act({ action: 'acknowledgeEvent', eventId: event.id }, `event-${event.id}`)}
                          >
                            <Check size={15} /> Acknowledge
                          </button>
                        )}
                      </div>
                      {(event.requestId || event.detail || event.userId || event.pID) && (
                        <details>
                          <summary>Technical details</summary>
                          {event.requestId && <p>Reference: <code>{event.requestId}</code></p>}
                          {event.userId && <p>Actor user ID: <code>{event.userId}</code></p>}
                          {event.pID && <p>Province ID: <code>{event.pID}</code></p>}
                          {event.detail && <pre>{event.detail}</pre>}
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <Pager page={data.operational.page} totalPages={data.operational.totalPages} total={data.operational.total} label="events" onChange={setEventPage} />
            </GamePanel>
          </div>
        )}

        {activeTab === 'controls' && data && (
          <div className="admin-tab-content">
            <div className="admin-control-intro">
              <ShieldAlert size={24} />
              <div>
                <h2>World controls</h2>
                <p>These actions alter or reset the live world. Every action requires confirmation and is written to the audit trail.</p>
              </div>
            </div>
            <div className="admin-control-grid">
              <GamePanel className="admin-control-card is-warning" eyebrow="Age progression" title="Start Apocalypse">
                <p>Moves the current world immediately into the Apocalypse phase. Normal end-of-age rules will begin.</p>
                <dl><div><dt>World data</dt><dd>Retained</dd></div><div><dt>Reversible</dt><dd>No</dd></div></dl>
                <button
                  className="btn-primary btn-warning"
                  type="button"
                  disabled={busyKey === 'apocalypse'}
                  onClick={() => setDialog({
                    key: 'apocalypse',
                    title: 'Start the Apocalypse?',
                    description: 'This immediately advances the live world into its final phase and cannot be reversed from this panel.',
                    confirmLabel: 'Start Apocalypse',
                    confirmationText: 'APOCALYPSE',
                    tone: 'warning',
                    body: { action: 'startApocalypse' },
                  })}
                >
                  Start Apocalypse
                </button>
              </GamePanel>

              <GamePanel className="admin-control-card is-danger" eyebrow="World reset" title="End current age">
                <p>Records the Hall of Fame, ends the current age, and resets all playable world progress.</p>
                <dl><div><dt>Hall of Fame</dt><dd>Recorded</dd></div><div><dt>World data</dt><dd>Reset</dd></div></dl>
                <button
                  className="btn-primary btn-danger"
                  type="button"
                  disabled={busyKey === 'end-age'}
                  onClick={() => setDialog({
                    key: 'end-age',
                    title: `End age ${data.state?.age ?? 1}?`,
                    description: 'The Hall of Fame will be recorded and the entire playable world will reset. This cannot be undone.',
                    confirmLabel: 'End age and reset',
                    confirmationText: 'END AGE',
                    tone: 'danger',
                    body: { action: 'endAge' },
                  })}
                >
                  End Age and Reset
                </button>
              </GamePanel>

              {data.features.startFresh && (
                <GamePanel className="admin-control-card is-danger" eyebrow="Launch reset" title="Start fresh world">
                  <p>Clears world, rankings, and tick history while preserving user accounts, administrator access, and reference data.</p>
                  <dl><div><dt>User accounts</dt><dd>Retained</dd></div><div><dt>History</dt><dd>Cleared</dd></div></dl>
                  <button
                    className="btn-primary btn-danger"
                    type="button"
                    disabled={busyKey === 'start-fresh'}
                    onClick={() => setDialog({
                      key: 'start-fresh',
                      title: 'Clear the playable world?',
                      description: 'All world, ranking, and tick history will be permanently deleted. User accounts and seeded game data remain.',
                      confirmLabel: 'Start fresh',
                      confirmationText: 'START FRESH',
                      tone: 'danger',
                      body: { action: 'startFresh' },
                    })}
                  >
                    Start Fresh
                  </button>
                </GamePanel>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          <button className="admin-drawer-backdrop" type="button" aria-label="Close player details" onClick={() => setSelectedUser(null)} />
          <aside className="admin-player-drawer" aria-label={`${selectedUser.username ?? 'Player'} details`}>
            <header>
              <div>
                <small>Player #{selectedUser.id}</small>
                <h2>{selectedUser.username ?? `User ${selectedUser.id}`}</h2>
              </div>
              <button className="admin-icon-button" type="button" aria-label="Close player details" onClick={() => setSelectedUser(null)}>
                <X size={20} />
              </button>
            </header>
            <div className="admin-drawer-body">
              <span className={`admin-status-badge ${selectedUser.status === 'Banned' ? 'is-banned' : selectedUser.access === 1 ? 'is-admin' : 'is-active'}`}>
                {selectedUser.access === 1 ? 'Administrator' : selectedUser.status ?? 'Active'}
              </span>
              <dl className="admin-detail-list">
                <div><dt>Email</dt><dd>{selectedUser.email ?? '-'}</dd></div>
                <div><dt>Real name</dt><dd>{selectedUser.name ?? '-'}</dd></div>
                <div><dt>Country</dt><dd>{selectedUser.country ?? '-'}</dd></div>
                <div><dt>Joined</dt><dd>{formatDateTime(selectedUser.created)}</dd></div>
                <div><dt>Active sessions</dt><dd>{formatNumber(selectedUser.activeSessions)}</dd></div>
              </dl>
              <h3>Province</h3>
              {selectedUser.province ? (
                <dl className="admin-detail-list">
                  <div><dt>Name</dt><dd>{selectedUser.province.provinceName ?? '-'}</dd></div>
                  <div><dt>Ruler</dt><dd>{selectedUser.province.rulerName ?? '-'}</dd></div>
                  <div><dt>Kingdom</dt><dd>{selectedUser.province.kingdomName ?? '-'}</dd></div>
                  <div><dt>Status</dt><dd>{selectedUser.province.status}</dd></div>
                  <div><dt>Acres</dt><dd>{formatNumber(selectedUser.province.acres)}</dd></div>
                  <div><dt>Networth</dt><dd>{formatNumber(selectedUser.province.networth)}</dd></div>
                  <div><dt>Protection</dt><dd>{formatNumber(selectedUser.province.protection)} ticks</dd></div>
                  <div><dt>Vacation</dt><dd>{selectedUser.province.vacation ? 'Yes' : 'No'}</dd></div>
                </dl>
              ) : <p className="empty-state">This account has no province.</p>}
            </div>
            {selectedUser.access !== 1 && selectedUser.id !== data?.admin.id && (
              <footer>
                {selectedUser.status === 'Banned' ? (
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={selectedIsBusy}
                    onClick={() => setDialog({
                      key: `user-${selectedUser.id}`,
                      title: `Reinstate ${selectedUser.username ?? 'this player'}?`,
                      description: 'The player will be able to sign in again. Existing sessions remain invalid and they must sign in afresh.',
                      confirmLabel: 'Reinstate player',
                      body: { action: 'unban', userId: selectedUser.id },
                    })}
                  >
                    Reinstate Player
                  </button>
                ) : (
                  <button
                    className="btn-primary btn-danger"
                    type="button"
                    disabled={selectedIsBusy}
                    onClick={() => setDialog({
                      key: `user-${selectedUser.id}`,
                      title: `Ban ${selectedUser.username ?? 'this player'}?`,
                      description: 'The account will be blocked immediately and all active sessions will be revoked.',
                      confirmLabel: 'Ban player',
                      tone: 'danger',
                      body: { action: 'ban', userId: selectedUser.id },
                    })}
                  >
                    <Ban size={17} /> Ban Player
                  </button>
                )}
              </footer>
            )}
          </aside>
        </>
      )}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmLabel={dialog?.confirmLabel ?? 'Confirm'}
        confirmationText={dialog?.confirmationText}
        tone={dialog?.tone}
        busy={Boolean(dialog && busyKey === dialog.key)}
        onCancel={() => setDialog(null)}
        onConfirm={confirmation => void confirmDialog(confirmation)}
      />
    </div>
  );
}
