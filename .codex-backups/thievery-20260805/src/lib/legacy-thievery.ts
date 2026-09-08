import type { KnowledgeLevels } from '@/lib/science';

export interface LegacyThieveryOperation {
  id: number;
  className: string;
  name: string;
  difficulty: number;
  influence: number;
  optimalThieves: number;
  thieveryRequired: number;
  randomness: number;
  description: string;
}

// Active ThieveryT records from the original database. RetributiveStrike was
// not present in that table and is therefore not part of the 14-operation set.
export const LEGACY_THIEVERY_OPERATIONS: LegacyThieveryOperation[] = [
  { id: 1, className: 'SpyOnProvince', name: 'Spy on Province', difficulty: 20, influence: 3, optimalThieves: 2000, thieveryRequired: 0, randomness: 5, description: 'View the target province, excluding exact thief and wizard numbers.' },
  { id: 2, className: 'SpyOnSciences', name: 'Spy on Sciences', difficulty: 10, influence: 3, optimalThieves: 1000, thieveryRequired: 0, randomness: 0, description: 'Reveal the target’s completed sciences.' },
  { id: 3, className: 'RobSupplies', name: 'Rob Supplies', difficulty: -5, influence: 4, optimalThieves: 0, thieveryRequired: 0, randomness: 0, description: 'Steal gold, food, and metal, limited by thief carrying capacity.' },
  { id: 4, className: 'SpyOnMilitary', name: 'Spy on Military', difficulty: 15, influence: 3, optimalThieves: 1000, thieveryRequired: 0, randomness: 5, description: 'Report military currently away at war.' },
  { id: 5, className: 'PoisonWater', name: 'Poison Water', difficulty: -15, influence: 4, optimalThieves: 0, thieveryRequired: 2, randomness: 0, description: 'Kill 4% of the target’s peasants.' },
  { id: 7, className: 'Infiltrate', name: 'Infiltrate', difficulty: -10, influence: 5, optimalThieves: 4000, thieveryRequired: 2, randomness: 0, description: 'Drain 22% of the target’s mana and influence, modified by size.' },
  { id: 8, className: 'SpyOnKingdom', name: 'Spy on Kingdom', difficulty: 0, influence: 3, optimalThieves: 1000, thieveryRequired: 1, randomness: 0, description: 'Reveal the target kingdom and its provinces.' },
  { id: 9, className: 'AssasinateCouncil', name: 'Assasinate Council', difficulty: -25, influence: 30, optimalThieves: 0, thieveryRequired: 4, randomness: 0, description: 'Dismiss the target’s council advisor.' },
  { id: 10, className: 'SpyOnBuildings', name: 'Spy on Buildings', difficulty: 10, influence: 3, optimalThieves: 1000, thieveryRequired: 0, randomness: 0, description: 'Reveal the target’s completed buildings.' },
  { id: 11, className: 'Screen', name: 'Screen', difficulty: -15, influence: 5, optimalThieves: 4000, thieveryRequired: 2, randomness: 10, description: 'Estimate the target’s covert units and other military.' },
  { id: 12, className: 'Investigate', name: 'Investigate', difficulty: 5, influence: 2, optimalThieves: 1000, thieveryRequired: 1, randomness: 5, description: 'Estimate the target’s mana, influence, and morale.' },
  { id: 13, className: 'AssasinateMilitary', name: 'Assasinate Military', difficulty: -20, influence: 5, optimalThieves: 0, thieveryRequired: 8, randomness: 10, description: 'Assassinate a portion of every enemy troop category.' },
  { id: 14, className: 'SabotageArmy', name: 'Sabotage Army', difficulty: -15, influence: 3, optimalThieves: 0, thieveryRequired: 1, randomness: 0, description: 'Triple the target’s military upkeep for 1–7 ticks.' },
  { id: 15, className: 'Riots', name: 'Riots', difficulty: -15, influence: 3, optimalThieves: 0, thieveryRequired: 1, randomness: 0, description: 'Halve the target’s income for 1–7 ticks.' },
];

const THIEVERY_IMAGE_BY_CLASS: Record<string, string> = {
  SpyOnProvince: '/game/thievery/spy-on-province.webp',
  SpyOnSciences: '/game/thievery/spy-on-sciences.webp',
  RobSupplies: '/game/thievery/rob-supplies.webp',
  SpyOnMilitary: '/game/thievery/spy-on-military.webp',
  PoisonWater: '/game/thievery/poison-water.webp',
  Infiltrate: '/game/thievery/infiltrate.webp',
  SpyOnKingdom: '/game/thievery/spy-on-kingdom.webp',
  AssasinateCouncil: '/game/thievery/assassinate-council.webp',
  SpyOnBuildings: '/game/thievery/spy-on-buildings.webp',
  Screen: '/game/thievery/screen.webp',
  Investigate: '/game/thievery/investigate.webp',
  AssasinateMilitary: '/game/thievery/assassinate-military.webp',
  SabotageArmy: '/game/thievery/sabotage-army.webp',
  Riots: '/game/thievery/riots.webp',
};

export function thieveryImageForClass(className: string): string {
  return THIEVERY_IMAGE_BY_CLASS[className] ?? '/game/units/thieves.webp';
}

export const LEGACY_THIEVERY_BY_NAME = new Map(LEGACY_THIEVERY_OPERATIONS.map(entry => [entry.name, entry]));

export function hasThieveryKnowledge(levels: KnowledgeLevels, required: number): boolean {
  return !required || Boolean(required & levels.thievery);
}

export function randomEstimate(value: number, randomness: number): number {
  if (!randomness) return Math.max(0, Math.floor(value));
  return Math.max(0, Math.floor(value * (1 + ((Math.random() * 2 - 1) * randomness / 100))));
}
