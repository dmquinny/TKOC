export const LEGACY_NETWORTH = {
  gold: 0.001,
  food: 0.0005,
  metal: 0.001,
  peasants: 1,
  acres: 15,
  building: 15,
  science: 1000,
} as const;

const MILITARY_NETWORTH: Record<string, number> = {
  soldiers: 2,
  offense: 5,
  defense: 5,
  elite: 12,
  wizards: 6,
  thieves: 6,
  raiders: 8,
  special: 8,
};

export interface NetworthMilitaryUnit {
  num: number;
  mID: number;
  type: { category: string | null };
}

export interface NetworthTrainingOrder {
  num: number;
  mID: number;
}

export interface LegacyNetworthInput {
  gold: number;
  food: number;
  metal: number;
  peasants: number;
  acres: number;
  buildings: number;
  sciences: number;
  military: NetworthMilitaryUnit[];
  training: NetworthTrainingOrder[];
}

export function legacyMilitaryNetworth(
  military: NetworthMilitaryUnit[],
  training: NetworthTrainingOrder[],
): number {
  const trainingByType = new Map<number, number>();
  for (const order of training) {
    trainingByType.set(order.mID, (trainingByType.get(order.mID) ?? 0) + order.num);
  }
  let total = 0;
  for (const unit of military) {
    const ready = Math.max(0, unit.num - (trainingByType.get(unit.mID) ?? 0));
    total += ready * (MILITARY_NETWORTH[unit.type.category ?? ''] ?? 0);
  }
  // The original valued every unit still in training as its race's basic soldier.
  total += training.reduce((sum, order) => sum + order.num * MILITARY_NETWORTH.soldiers, 0);
  return total;
}

export function legacyProvinceNetworth(input: LegacyNetworthInput): number {
  return Math.round(
    input.gold * LEGACY_NETWORTH.gold
    + input.food * LEGACY_NETWORTH.food
    + input.metal * LEGACY_NETWORTH.metal
    + input.peasants * LEGACY_NETWORTH.peasants
    + input.acres * LEGACY_NETWORTH.acres
    + input.buildings * LEGACY_NETWORTH.building
    + input.sciences * LEGACY_NETWORTH.science
    + legacyMilitaryNetworth(input.military, input.training),
  );
}

const THIEVERY_RANKS: Array<[string, number]> = [
  ['Peasant', 800],
  ['Bandit', 1001],
  ['Thief Lord', 1500],
  ['Thief Baron', 2250],
  ['Viscount', 3000],
  ['Thief King', 4000],
];

const MAGIC_RANKS: Array<[string, number]> = [
  ['Ungifted', 50],
  ['Gifted', 100],
  ['Student', 200],
  ['Apprentice', 500],
  ['Maegi', 1000],
  ['Battle mage', 1750],
  ['High mage', 3000],
  ['Archmage', 5000],
];

function legacyRank(points: number, ranks: Array<[string, number]>): string {
  let result = 'Decent';
  let lower = 0;
  for (const [rank, upper] of ranks) {
    if (points >= lower && points < upper) result = rank;
    lower = upper;
  }
  return result;
}

export const legacyThieveryRank = (points: number) => legacyRank(points, THIEVERY_RANKS);
export const legacyMagicRank = (points: number) => legacyRank(points, MAGIC_RANKS);
