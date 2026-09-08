export const EXPLORE_TICKS = 24;
export const EXPLORE_MAX_LAND_PERCENT = 50;

const START_LAND = 200;
const BASE_GOLD_COST = 300;
const RANDOM_PERCENT = 5;

export interface ExploreRates {
  costPerSoldier: number;
  landPerSoldier: number;
  soldiersPerAcre: number;
  recommendedSoldiers: number;
}

/** Port of the rate calculations in the original Explore class. */
export function getExploreRates(
  currentAcres: number,
  incomingAcres: number,
  costReductionPercent = 0,
): ExploreRates {
  const acres = Math.max(1, currentAcres);
  const useLand = Math.max(acres, acres + Math.max(0, incomingAcres));

  // Negative "reduction" represents a legacy cost increase (Humans pay 5%
  // more). Effect::makeNumberBetween caps the resulting multiplier at 2.
  const reduction = Math.min(99.99, Math.max(-100, costReductionPercent));
  const baseCost = Math.ceil(BASE_GOLD_COST * (1 - reduction / 100));
  const costPerSoldier = baseCost + Math.floor((useLand / 1200) ** 4);

  let growthFactor = 0.2;
  let growthModifier = (useLand * 2.2) / 1200;
  if (useLand > 1500 && useLand < 2000) growthModifier *= useLand / 1200;
  if (useLand > 2000 && useLand < 3000) growthModifier *= useLand / 800;
  if (useLand > 3000) growthModifier *= useLand / 400;
  if (useLand > 1200) growthFactor *= 1200 / (growthModifier * useLand);

  const landPerSoldier = START_LAND / (useLand - useLand * growthFactor);
  const soldiersPerAcre = Math.ceil(1 / landPerSoldier);
  const recommendedSoldiers = Math.floor(
    ((acres / 100) * EXPLORE_MAX_LAND_PERCENT) / landPerSoldier,
  );

  return { costPerSoldier, landPerSoldier, soldiersPerAcre, recommendedSoldiers };
}

/**
 * The original rolls an integer -5%..+5% after limiting the base result to
 * 50% of the province's current land.
 */
export function getExploredLand(
  soldiers: number,
  currentAcres: number,
  landPerSoldier: number,
  randomPercent = Math.floor(Math.random() * (RANDOM_PERCENT * 2 + 1)) - RANDOM_PERCENT,
): number {
  const cappedLand = Math.min(
    soldiers * landPerSoldier,
    (Math.max(0, currentAcres) / 100) * EXPLORE_MAX_LAND_PERCENT,
  );
  return Math.max(0, Math.floor(cappedLand + (cappedLand / 100) * randomPercent));
}

/** Faithful port of the legacy Misc::getRandomArray used by Explore. */
export function distributeExploredLand(total: number, size = EXPLORE_TICKS): Map<number, number> {
  return distributeAcrossTicks(total, size);
}
import { distributeAcrossTicks } from '@/lib/trickle';
