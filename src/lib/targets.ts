/**
 * Target intelligence shared by the War Room, Wizard's Tower, and Thieves
 * Guild. Pure helpers only; the database query lives in server/target-intel.
 */
export type TargetRelation = 'self' | 'kingdom' | 'ally' | 'war' | 'neutral';

export interface TargetIntel {
  id: number;
  provinceName: string;
  rulerName: string;
  race: string;
  kiID: number;
  kingdomName: string;
  networth: number;
  acres: number;
  relation: TargetRelation;
  /** Target networth divided by yours. 1 means an even match. */
  networthRatio: number;
  /** Target acres divided by yours. */
  landRatio: number;
  /** Percent of the target's acres a winning standard attack would seize. */
  expectedLandPercent: number;
  /** Acres you would hold after a winning standard attack returned. */
  expectedAcresGained: number;
  protection: boolean;
  vacation: boolean;
  /** Recent hostile attacks absorbed; 5 or more blocks further attacks. */
  attackPressure: number;
}

export const RELATION_LABEL: Record<TargetRelation, string> = {
  self: 'You',
  kingdom: 'Kingdom-mate',
  ally: 'Allied',
  war: 'At war',
  neutral: 'Neutral',
};

export type TargetFilter = 'all' | 'range' | 'war' | 'kingdom' | 'ally';

export const TARGET_FILTERS: Array<{ id: TargetFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'range', label: 'In range' },
  { id: 'war', label: 'At war' },
  { id: 'kingdom', label: 'Kingdom' },
  { id: 'ally', label: 'Allies' },
];

/** A target between 70% and 145% of your networth is a fair fight. */
export function inRange(target: Pick<TargetIntel, 'networthRatio'>): boolean {
  return target.networthRatio >= 0.7 && target.networthRatio <= 1.45;
}

export function targetMatchesFilter(target: TargetIntel, filter: TargetFilter): boolean {
  switch (filter) {
    case 'range': return inRange(target) && target.relation !== 'self';
    case 'war': return target.relation === 'war';
    case 'kingdom': return target.relation === 'kingdom' || target.relation === 'self';
    case 'ally': return target.relation === 'ally';
    default: return true;
  }
}

export function targetMatchesQuery(target: TargetIntel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return target.provinceName.toLowerCase().includes(needle)
    || target.rulerName.toLowerCase().includes(needle)
    || target.kingdomName.toLowerCase().includes(needle)
    || target.race.toLowerCase().includes(needle);
}

/** Closest networth matches first; your own province always leads. */
export function sortTargetsByCloseness(targets: TargetIntel[]): TargetIntel[] {
  return [...targets].sort((a, b) => {
    if (a.relation === 'self') return -1;
    if (b.relation === 'self') return 1;
    return Math.abs(a.networthRatio - 1) - Math.abs(b.networthRatio - 1)
      || b.networth - a.networth;
  });
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${ratio.toFixed(2)}×`;
}

/** Why a province cannot be attacked right now, or null when it can. */
export function attackBlocker(target: TargetIntel): string | null {
  if (target.relation === 'self') return 'You cannot attack yourself.';
  if (target.relation === 'ally') return 'Allied kingdoms cannot attack each other.';
  if (target.vacation) return 'On vacation.';
  if (target.protection) return 'Under protection.';
  if (target.relation !== 'kingdom' && target.attackPressure >= 5) return 'Has suffered too many recent attacks.';
  return null;
}
