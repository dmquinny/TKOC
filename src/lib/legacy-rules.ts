/**
 * Authoritative constants from the 2011 legacy PHP source. Keep cross-cutting
 * rules here so API actions and the hourly tick cannot silently drift apart.
 */

export const LEGACY_TOTAL_AGE_TICKS = 1500;
export const LEGACY_APOCALYPSE_TICKS = 500;
export const LEGACY_NORMAL_AGE_TICKS =
  LEGACY_TOTAL_AGE_TICKS - LEGACY_APOCALYPSE_TICKS;

export const LEGACY_PROTECTION_TICKS = 50;
export const LEGACY_MIN_VACATION_TICKS = 48;
export const LEGACY_MAX_VACATION_TICKS = 336;
// Province names were chosen when founding a province and were immutable for
// the rest of that age. A fresh province (and name) is chosen after age reset.
export const LEGACY_PROVINCE_RENAMES_PER_AGE = 0;

export const LEGACY_SEASON_LENGTH = 96;
export const LEGACY_SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type LegacySeason = (typeof LEGACY_SEASONS)[number];

export interface LegacySeasonModifiers {
  buildingTime: number;
  attackTime: number;
  defense: number;
  militaryGoldCost: number;
  militaryMetalCost: number;
  militaryFoodCost: number;
  metalIncome: number;
  peasantGrowth: number;
  morale: number;
}

const NEUTRAL_SEASON: LegacySeasonModifiers = {
  buildingTime: 1,
  attackTime: 1,
  defense: 1,
  militaryGoldCost: 1,
  militaryMetalCost: 1,
  militaryFoodCost: 1,
  metalIncome: 1,
  peasantGrowth: 1,
  morale: 1,
};

export const LEGACY_SEASON_MODIFIERS: Record<LegacySeason, LegacySeasonModifiers> = {
  Spring: { ...NEUTRAL_SEASON, morale: 1.1 },
  Summer: { ...NEUTRAL_SEASON, buildingTime: 0.9, peasantGrowth: 1.1 },
  Autumn: {
    ...NEUTRAL_SEASON,
    militaryGoldCost: 0.9,
    militaryMetalCost: 0.9,
    militaryFoodCost: 0.9,
    metalIncome: 1.1,
  },
  Winter: { ...NEUTRAL_SEASON, attackTime: 1.2, defense: 1.05 },
};

export function legacySeasonForTick(tick: number): LegacySeason {
  return LEGACY_SEASONS[Math.floor(Math.max(0, tick - 1) / LEGACY_SEASON_LENGTH) % 4];
}

export interface LegacyRaceModifiers {
  attack: number;
  defense: number;
  goldIncome: number;
  metalIncome: number;
  foodIncome: number;
  peasantGrowth: number;
  peasantHousing: number;
  buildingTime: number;
  researchTime: number;
  attackTime: number;
  manaCap: number;
  influenceCap: number;
  exploreGoldCost: number;
  magicProtection: number;
  wizardUse: number;
  manaCost: number;
  caravanLoss: number;
  morale: number;
}

const NEUTRAL_RACE: LegacyRaceModifiers = {
  attack: 1,
  defense: 1,
  goldIncome: 1,
  metalIncome: 1,
  foodIncome: 1,
  peasantGrowth: 1,
  peasantHousing: 1,
  buildingTime: 1,
  researchTime: 1,
  attackTime: 1,
  manaCap: 100,
  influenceCap: 100,
  exploreGoldCost: 1,
  magicProtection: 1,
  wizardUse: 1,
  manaCost: 1,
  caravanLoss: 1,
  morale: 1,
};

export const LEGACY_RACE_MODIFIERS: Record<string, LegacyRaceModifiers> = {
  Human: {
    ...NEUTRAL_RACE,
    peasantHousing: 1.05,
    buildingTime: 0.8,
    researchTime: 0.7,
    influenceCap: 110,
    exploreGoldCost: 1.05,
    caravanLoss: 0.8,
  },
  Elf: {
    ...NEUTRAL_RACE,
    foodIncome: 1.1,
    peasantGrowth: 0.9,
    buildingTime: 0.8,
    manaCap: 110,
    magicProtection: 1.2,
    wizardUse: 0.9,
    manaCost: 0.8,
  },
  Orc: {
    ...NEUTRAL_RACE,
    attack: 1.09,
    defense: 1.06,
    researchTime: 1.1,
    attackTime: 0.85,
    morale: 1.15,
  },
  Dwarf: {
    ...NEUTRAL_RACE,
    goldIncome: 1.05,
    metalIncome: 1.1,
    peasantHousing: 1.2,
    attackTime: 1.2,
    defense: 1.05,
    magicProtection: 1.7,
  },
  Undead: {
    ...NEUTRAL_RACE,
    foodIncome: 1.5,
    buildingTime: 0.8,
    researchTime: 1.3,
    wizardUse: 0.9,
    manaCost: 0.8,
    caravanLoss: 0.8,
  },
  Giant: {
    ...NEUTRAL_RACE,
    attack: 1.15,
    defense: 1.15,
    foodIncome: 0.8,
    peasantGrowth: 0.8,
    peasantHousing: 0.86,
    attackTime: 0.8,
  },
};

export function legacyRaceModifiers(raceName: string | null | undefined): LegacyRaceModifiers {
  return LEGACY_RACE_MODIFIERS[raceName ?? ''] ?? NEUTRAL_RACE;
}

/**
 * Server.class.inc.php scales the king's production bonus from 2% to 15%
 * according to the number of provinces in the kingdom. The shipped database
 * configured three provinces per kingdom.
 */
export function legacyKingProductionMultiplier(
  provinceCount: number,
  maxProvinceCount = 3,
): number {
  const count = Math.max(1, Math.min(maxProvinceCount, Math.floor(provinceCount)));
  if (count === 1) return 1.02;
  if (count === maxProvinceCount) return 1.15;
  const step = Math.trunc((115 - 102) / maxProvinceCount);
  return (102 + step * (count - 1)) / 100;
}

export const LEGACY_TICK_ORDER = [
  'prepare',
  'attack',
  'military',
  'triggeredEffects',
  'explore',
  'buildings',
  'science',
  'magic',
  'thievery',
  'race',
  'news',
  'kingdom',
  'server',
  'recruitBonus',
  'season',
  'beasts',
] as const;
