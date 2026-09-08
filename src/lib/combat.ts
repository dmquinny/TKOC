/**
 * Pure combat definitions shared by the attack route, target intelligence,
 * and the War Room interface. Values are the legacy attack classes.
 */
import type { KnowledgeLevels } from '@/lib/science';

export type AttackId = 1 | 2 | 5;

export interface AttackDefinition {
  id: AttackId;
  name: string;
  legacyName: string;
  description: string;
  backTicks: number;
  requirement: { military: number; thievery: number };
  requirementLabel: string | null;
  attackerWin: readonly [number, number];
  attackerLose: readonly [number, number];
  defenderWin: readonly [number, number];
  defenderLose: readonly [number, number];
}

export const ATTACK_DEFINITIONS: Record<AttackId, AttackDefinition> = {
  1: {
    id: 1,
    name: 'Standard',
    legacyName: 'Ordinary Attack',
    description: 'Take land and plunder. The balanced choice.',
    backTicks: 10,
    requirement: { military: 0, thievery: 0 },
    requirementLabel: null,
    attackerWin: [4, 9],
    attackerLose: [5, 10],
    defenderWin: [2, 8],
    defenderLose: [3, 9],
  },
  2: {
    id: 2,
    name: 'Massacre',
    legacyName: 'Massacre',
    description: 'Maximise enemy losses and drive peasants from their land. Little loot.',
    backTicks: 10,
    requirement: { military: 16, thievery: 0 },
    requirementLabel: 'Strategic War',
    attackerWin: [4, 10],
    attackerLose: [8, 20],
    defenderWin: [1, 5],
    defenderLose: [4, 8],
  },
  5: {
    id: 5,
    name: 'Pillage',
    legacyName: 'Pillage',
    description: 'Maximise plunder and return quickly. No land.',
    backTicks: 6,
    requirement: { military: 1, thievery: 1 },
    requirementLabel: 'Basic Attacking and Espionage',
    attackerWin: [0, 3],
    attackerLose: [1, 5],
    defenderWin: [0, 2],
    defenderLose: [1, 2],
  },
};

export const ATTACK_LIST: AttackDefinition[] = [ATTACK_DEFINITIONS[1], ATTACK_DEFINITIONS[2], ATTACK_DEFINITIONS[5]];

export function isAttackId(value: unknown): value is AttackId {
  return value === 1 || value === 2 || value === 5;
}

export function attackTypeName(attackType: number): string {
  return isAttackId(attackType) ? ATTACK_DEFINITIONS[attackType].name : 'Attack';
}

/** True when the province's science knowledge permits this attack class. */
export function attackAvailable(definition: AttackDefinition, knowledge: KnowledgeLevels): boolean {
  const { military, thievery } = definition.requirement;
  if (military && !(knowledge.military & military)) return false;
  if (thievery && !(knowledge.thievery & thievery)) return false;
  return true;
}

/**
 * Fraction of the target's land an ordinary victory seizes. Peaks when the
 * attacker is slightly smaller than the target and drops off sharply for
 * lopsided matchups, exactly as the legacy engine computed it.
 */
export function gaussianLandPercent(ownAcres: number, targetAcres: number): number {
  const inOptimalBand = ownAcres >= 0.75 * targetAcres && ownAcres <= 1.45 * targetAcres;
  const peak = inOptimalBand ? 0.10225 : 0.15;
  const distribution = inOptimalBand ? -2 : -5.2;
  const exponent = distribution * Math.pow(((1.1 * ownAcres) - targetAcres) / Math.max(1, ownAcres), 2);
  return peak * Math.exp(exponent);
}

/** Expected acres seized and acres gained by a winning standard attack. */
export function expectedLandGain(ownAcres: number, targetAcres: number): { seized: number; gained: number; percent: number } {
  if (targetAcres <= 0) return { seized: 0, gained: 0, percent: 0 };
  const percent = gaussianLandPercent(Math.max(1, ownAcres), targetAcres);
  const seized = Math.max(1, Math.round(targetAcres * percent));
  const gained = Math.round(seized * 1.25);
  return { seized, gained, percent: Math.round(percent * 1000) / 10 };
}

export interface BattleUnitLine {
  name: string;
  sent: number;
  lost: number;
}

/** A persisted battle as shown to either participant. */
export interface BattleReportView {
  id: number;
  age: number;
  tick: number;
  attackerPID: number;
  defenderPID: number;
  attackerName: string;
  defenderName: string;
  attackType: number;
  attackName: string;
  won: boolean;
  attackPoints: number;
  defensePoints: number;
  attackerLost: number;
  defenderLost: number;
  acresSeized: number;
  acresGained: number;
  gold: number;
  food: number;
  metal: number;
  buildingsLost: number;
  moraleLoss: number;
  returnTicks: number;
  targetKilled: boolean;
  units: BattleUnitLine[];
  createdAt: string;
  seen: boolean;
}

export function parseBattleUnits(value: string | null | undefined): BattleUnitLine[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (typeof item !== 'object' || item === null) return [];
      const line = item as Record<string, unknown>;
      return [{
        name: String(line.name ?? 'Unit'),
        sent: Number(line.sent) || 0,
        lost: Number(line.lost) || 0,
      }];
    });
  } catch {
    return [];
  }
}
