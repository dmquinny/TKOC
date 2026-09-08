"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PageBanner from '@/components/PageBanner';
import FeedbackNotice from '@/components/FeedbackNotice';
import OnboardingTip from '@/components/OnboardingTip';
import TargetSearch from '@/components/TargetSearch';

type Target = {
  id: number;
  provinceName: string | null;
  rulerName: string | null;
  networth: number | null;
  acres: number | null;
};

type Operation = {
  id: number;
  name: string;
  image: string;
  className: string;
  difficulty: number;
  influence: number;
  optimalThieves: number;
  thieveryRequired: number;
  description: string;
  available: boolean;
};

const REPORT_LABELS: Record<string, string> = {
  ruler: 'Ruler',
  race: 'Race',
  gender: 'Gender',
  knowledge: 'Completed sciences',
  gold: 'Gold',
  food: 'Food',
  metal: 'Metal',
  peasants: 'Peasants',
  acres: 'Acres',
  morale: 'Morale',
  mana: 'Mana',
  influence: 'Influence',
  military: 'Military at home',
  militaryAway: 'Military away',
  sciences: 'Completed sciences',
  buildings: 'Completed buildings',
  covertUnits: 'Wizards and thieves',
  otherUnits: 'Other military units',
  kingdom: 'Kingdom intelligence',
  provinces: 'Provinces',
  provinceName: 'Province',
  rulerName: 'Ruler',
  networth: 'Networth',
  name: 'Name',
  num: 'Number',
};

const PERCENT_FIELDS = new Set(['morale', 'mana', 'influence']);

function reportLabel(key: string): string {
  return REPORT_LABELS[key]
    ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, value => value.toUpperCase());
}

function reportScalar(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unknown';
  if (typeof value === 'number') {
    return `${value.toLocaleString()}${PERCENT_FIELDS.has(key) ? '%' : ''}`;
  }
  return String(value);
}

function isReportRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ReportValue({ name, value }: { name: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return (
        <div className="thievery-report-section">
          <h4>{reportLabel(name)}</h4>
          <p className="empty-state">None reported.</p>
        </div>
      );
    }
    if (value.every(isReportRecord)) {
      const columns = Array.from(new Set(value.flatMap(item => Object.keys(item))));
      return (
        <div className="thievery-report-section">
          <h4>{reportLabel(name)}</h4>
          <div className="thievery-report-table-wrap">
            <table className="thievery-report-table">
              <thead><tr>{columns.map(column => <th key={column}>{reportLabel(column)}</th>)}</tr></thead>
              <tbody>
                {value.map((item, index) => (
                  <tr key={`${name}-${index}`}>
                    {columns.map(column => <td key={column}>{reportScalar(column, item[column])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return (
      <div className="thievery-report-section">
        <h4>{reportLabel(name)}</h4>
        <ul className="thievery-report-list">
          {value.map((item, index) => <li key={`${name}-${index}`}>{reportScalar(name, item)}</li>)}
        </ul>
      </div>
    );
  }

  if (isReportRecord(value)) {
    return (
      <div className="thievery-report-section">
        <h4>{reportLabel(name)}</h4>
        <div className="thievery-report-nested">
          {Object.entries(value).map(([key, nested]) => <ReportValue key={key} name={key} value={nested} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="thievery-report-stat">
      <span>{reportLabel(name)}</span>
      <strong>{reportScalar(name, value)}</strong>
    </div>
  );
}

function ThieveryReport({ report }: { report: Record<string, unknown> }) {
  return (
    <section className="thievery-report" aria-label="Thievery intelligence report">
      <h3>Intelligence report</h3>
      <div className="thievery-report-grid">
        {Object.entries(report).map(([name, value]) => <ReportValue key={name} name={name} value={value} />)}
      </div>
    </section>
  );
}

export default function Thievery() {
  const router = useRouter();
  const [targets, setTargets] = useState<Target[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [availableThieves, setAvailableThieves] = useState(0);
  const [influence, setInfluence] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileTargetsOpen, setMobileTargetsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executingOpId, setExecutingOpId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string; revealed?: Record<string, unknown> } | null>(null);

  const fetchThievery = async () => {
    try {
      const response = await fetch('/api/thievery/execute');
      if (response.status === 401) return router.push('/');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTargets(data.targets ?? []);
      setOperations(data.operations ?? []);
      setAvailableThieves(data.availableThieves ?? 0);
      setInfluence(data.influence ?? 0);
      setSelectedOperation(current => (
        current
        || data.operations?.find((operation: Operation) => operation.available)?.name
        || data.operations?.[0]?.name
        || ''
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load thievery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchThievery();
  }, []);

  const filteredTargets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return targets.filter(target => (
      !query
      || (target.provinceName ?? '').toLowerCase().includes(query)
      || (target.rulerName ?? '').toLowerCase().includes(query)
    )).slice(0, 50);
  }, [searchTerm, targets]);
  const target = targets.find(entry => entry.id === selectedTarget);
  const availableOperations = useMemo(
    () => operations.filter(operation => operation.available),
    [operations],
  );
  const chosenOperation = availableOperations.find(operation => operation.name === selectedOperation) ?? availableOperations[0];

  const execute = async (operation: Operation) => {
    if (!selectedTarget) return;
    setExecutingOpId(operation.id);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/thievery/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetID: selectedTarget, operation: operation.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      await fetchThievery();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Operation failed');
    } finally {
      setExecutingOpId(null);
    }
  };

  if (loading) return <div className="loading-screen">Loading Thieves Guild...</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar active="/dashboard/thievery" />
      <main id="main-content" className="dashboard-content">
        <PageBanner
          image="/game/headers/header-thievery.webp"
          title="Thieves Guild"
          subtitle="Choose a target, then send all ready thieves on an operation."
          right={<div className="networth-badge">Thieves: {availableThieves.toLocaleString()} &middot; Influence: {influence}</div>}
        />
        <OnboardingTip
          id="thievery"
          title="Operations use every ready thief"
          description="Choose a valid target first. Your thievery science, influence, and thieves per acre determine which operations are available and likely to succeed."
          href="/dashboard/guide"
          linkLabel="Read the covert operations guide"
        />

        {error && <FeedbackNotice tone="error">{error}</FeedbackNotice>}
        {result && (
          <FeedbackNotice tone={result.success ? 'success' : 'error'}>
            <p>{result.message}</p>
            {result.revealed && <ThieveryReport report={result.revealed} />}
          </FeedbackNotice>
        )}

        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .8fr) minmax(360px, 1.2fr)', gap: '2rem' }}>
          <section className="stat-card target-panel">
            <h2 className="desktop-target-heading">Select Target</h2>
            <button type="button" className="mobile-target-toggle mobile-only" onClick={() => setMobileTargetsOpen(open => !open)}>
              <span><small>Target</small><strong>{target?.provinceName ?? 'Choose a province'}</strong></span>
              <span>{mobileTargetsOpen ? 'Close' : target ? 'Change' : 'Choose'}</span>
            </button>
            <div className={`target-picker-body${mobileTargetsOpen ? ' is-open' : ''}`}>
              <TargetSearch value={searchTerm} onChange={setSearchTerm} />
              <div className="target-list" style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', maxHeight: 560, overflowY: 'auto' }}>
              {filteredTargets.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="target-option"
                  aria-pressed={selectedTarget === entry.id}
                  onClick={() => { setSelectedTarget(entry.id); setMobileTargetsOpen(false); }}
                  style={{
                    padding: '.8rem',
                    border: `2px solid ${selectedTarget === entry.id ? '#8a2be2' : '#33333d'}`,
                    borderRadius: 8,
                    color: 'inherit',
                    textAlign: 'left',
                    background: selectedTarget === entry.id ? 'rgba(138,43,226,.1)' : 'transparent',
                  }}
                >
                  <strong>{entry.provinceName ?? 'Unnamed province'}</strong>
                  <div style={{ color: '#adb5bd', fontSize: '.85rem' }}>
                    {(entry.acres ?? 0).toLocaleString()} acres &middot; NW {(entry.networth ?? 0).toLocaleString()}
                  </div>
                </button>
              ))}
              {!filteredTargets.length && <p className="empty-state">No provinces match that search.</p>}
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h2>Run Operation</h2>
            {!target ? <p>Select a target province.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p>Target: <strong>{target.provinceName ?? 'Unnamed province'}</strong></p>
                <div className="spell-picker spell-picker-scroll" role="radiogroup" aria-label="Choose a thievery operation">
                  {availableOperations.map(operation => (
                    <button
                      key={operation.id}
                      type="button"
                      role="radio"
                      aria-checked={chosenOperation?.name === operation.name}
                      className={`spell-option${chosenOperation?.name === operation.name ? ' is-selected' : ''}`}
                      onClick={() => setSelectedOperation(operation.name)}
                    >
                      <img
                        src={operation.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="spell-option-body">
                        <span className="spell-option-heading">
                          <strong>{operation.name}</strong>
                          <small>{operation.influence} influence</small>
                        </span>
                        <span className="spell-type">Available</span>
                        <span className="spell-description">{operation.description}</span>
                        <span className="spell-lock">
                          Difficulty: {operation.difficulty > 0 ? '+' : ''}{operation.difficulty}%
                          {operation.optimalThieves > 0 ? ` · Smart optimum: ${operation.optimalThieves.toLocaleString()}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!availableOperations.length && (
                    <p className="empty-state">No thievery operations are currently available.</p>
                  )}
                </div>

                {chosenOperation && (
                  <>
                    <div style={{ color: '#adb5bd', fontSize: '.9rem' }}>
                      Cost: {chosenOperation.influence} influence &middot; All {availableThieves.toLocaleString()} ready thieves will be sent.
                    </div>
                    <button
                      className="btn-primary mobile-sticky-action"
                      type="button"
                      disabled={
                        executingOpId !== null
                        || !chosenOperation.available
                        || availableThieves < 1
                        || influence < 40
                      }
                      onClick={() => execute(chosenOperation)}
                    >
                      {executingOpId !== null
                        ? 'Infiltrating...'
                        : !chosenOperation.available
                          ? 'Requirements not met'
                          : availableThieves < 1
                            ? 'No ready thieves'
                            : influence < 40
                              ? 'Need 40 influence'
                              : `Run ${chosenOperation.name}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
