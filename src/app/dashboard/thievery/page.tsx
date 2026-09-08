"use client";

import { useEffect, useMemo, useState } from 'react';
import FeedbackNotice from '@/components/FeedbackNotice';
import Notices from '@/components/Notices';
import OnboardingTip from '@/components/OnboardingTip';
import PageBanner from '@/components/PageBanner';
import PageSkeleton from '@/components/PageSkeleton';
import RelationBadge from '@/components/RelationBadge';
import TargetPicker from '@/components/TargetPicker';
import { apiPost } from '@/lib/client/api';
import { requestNotificationRefresh } from '@/lib/client/events';
import { useGameAction, useGameData } from '@/lib/client/useGameData';
import type { TargetIntel } from '@/lib/targets';

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

interface ThieveryData {
  targets: TargetIntel[];
  operations: Operation[];
  availableThieves: number;
  influence: number;
}

interface OperationResult {
  success: boolean;
  message: string;
  revealed?: Record<string, unknown>;
}

const MIN_INFLUENCE = 40;

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
  const { data, error, loading, refresh } = useGameData<ThieveryData>('/api/thievery/execute');
  const action = useGameAction();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState('');
  const [result, setResult] = useState<OperationResult | null>(null);

  const availableOperations = useMemo(
    () => data?.operations.filter(operation => operation.available) ?? [],
    [data?.operations],
  );
  useEffect(() => {
    if (availableOperations.length && !availableOperations.some(operation => operation.name === selectedOperation)) {
      setSelectedOperation(availableOperations[0].name);
    }
  }, [availableOperations, selectedOperation]);

  if (!data) {
    return loading ? <PageSkeleton cards={2} /> : <Notices error={error || 'The Thieves Guild could not be opened.'} />;
  }

  const target = data.targets.find(entry => entry.id === selectedTarget) ?? null;
  const chosen = availableOperations.find(operation => operation.name === selectedOperation) ?? availableOperations[0] ?? null;
  const blocker = target?.protection ? 'The target is under protection.' : target?.vacation ? 'The target is on vacation.' : null;

  const execute = async () => {
    if (!selectedTarget || !chosen) return;
    setResult(null);
    const outcome = await action.run('execute', () => apiPost<OperationResult>('/api/thievery/execute', {
      targetID: selectedTarget,
      operation: chosen.name,
    }));
    if (outcome) {
      setResult(outcome);
      void refresh();
      requestNotificationRefresh();
    }
  };

  const buttonLabel = () => {
    if (action.busy === 'execute') return 'Infiltrating…';
    if (!chosen) return 'No operation available';
    if (data.availableThieves < 1) return 'No ready thieves';
    if (data.influence < MIN_INFLUENCE) return `Need ${MIN_INFLUENCE} influence`;
    return `Run ${chosen.name}`;
  };

  return (
    <>
      <PageBanner
        image="/game/headers/header-thievery.webp"
        title="Thieves Guild"
        subtitle="Choose a target, then send all ready thieves on an operation."
        right={<div className="networth-badge">Thieves: {data.availableThieves.toLocaleString()} · Influence: {data.influence}</div>}
      />
      <OnboardingTip
        id="thievery"
        title="Operations use every ready thief"
        description="Choose a valid target first. Your thievery science, influence, and thieves per acre determine which operations are available and likely to succeed."
        href="/dashboard/guide"
        linkLabel="Read the covert operations guide"
      />

      <Notices error={error || action.error} />
      {result && (
        <FeedbackNotice tone={result.success ? 'success' : 'error'}>
          <p>{result.message}</p>
          {result.revealed && <ThieveryReport report={result.revealed} />}
        </FeedbackNotice>
      )}

      <div className="responsive-grid page-grid is-targets">
        <TargetPicker targets={data.targets} selectedId={selectedTarget} onSelect={setSelectedTarget} title="Select Target" />

        <section className="stat-card">
          <h2>Run Operation</h2>
          {!target ? <p className="empty-state">Select a target province.</p> : (
            <div className="stack">
              <p className="row mb-0">
                <span>Target: <strong>{target.provinceName}</strong></span>
                <RelationBadge relation={target.relation} />
              </p>
              {blocker && <FeedbackNotice tone="warning">{blocker}</FeedbackNotice>}
              <div className="spell-picker spell-picker-scroll" role="radiogroup" aria-label="Choose a thievery operation">
                {availableOperations.map(operation => (
                  <button
                    key={operation.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen?.name === operation.name}
                    className={`spell-option${chosen?.name === operation.name ? ' is-selected' : ''}`}
                    onClick={() => setSelectedOperation(operation.name)}
                  >
                    <img src={operation.image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
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
                  <p className="empty-state">No thievery operations are currently available. Research Espionage to begin.</p>
                )}
              </div>

              {chosen && (
                <>
                  <p className="text-muted text-small mb-0">
                    Cost: {chosen.influence} influence · All {data.availableThieves.toLocaleString()} ready thieves will be sent.
                  </p>
                  <button
                    className="btn-primary mobile-sticky-action"
                    type="button"
                    disabled={action.busy !== null || Boolean(blocker) || data.availableThieves < 1 || data.influence < MIN_INFLUENCE}
                    onClick={() => void execute()}
                  >
                    {buttonLabel()}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
