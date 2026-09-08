export interface BuildingRequirement {
  science: string;
  level: number;
  legacyName: string;
}

export interface OriginalBuilding {
  name: string;
  costGold: number;
  costMetal: number;
  buildTicks: number;
  description: string;
  image: string;
  allowedRaces?: string[];
  requirements?: BuildingRequirement[];
  maxEffectivePercent?: number;
  peasantHousing?: number;
}

// Values and descriptions ported from the legacy *Building.class.inc.php files.
export const ORIGINAL_BUILDINGS: OriginalBuilding[] = [
  {
    name: 'Barrack',
    costGold: 750,
    costMetal: 50,
    buildTicks: 10,
    description: 'Reduces military gold cost by 2% for each 1% of your land developed with Barracks, effective up to 25% of your land.',
    image: '/game/buildings/barracks.webp',
    maxEffectivePercent: 25,
  },
  {
    name: 'Beast den',
    costGold: 2000,
    costMetal: 150,
    buildTicks: 20,
    description: 'Orc structure. Reduces attack time by 2% for each 1% of land developed, effective up to 15%.',
    image: '/game/buildings/beast-dens.webp',
    allowedRaces: ['Orc'],
    requirements: [
      { science: 'Military:4', level: 1, legacyName: 'Military 4' },
      { science: 'Infrastructure:4', level: 1, legacyName: 'Infrastructure 4' },
    ],
    maxEffectivePercent: 15,
  },
  {
    name: 'Blacksmith',
    costGold: 1000,
    costMetal: 500,
    buildTicks: 24,
    description: 'Increases army attack by 2% for each 1% of land developed, effective up to 20%.',
    image: '/game/buildings/blacksmith.webp',
    requirements: [{ science: 'Infrastructure:4', level: 1, legacyName: 'Infrastructure 4' }],
    maxEffectivePercent: 20,
  },
  {
    name: 'Crypt',
    costGold: 1500,
    costMetal: 0,
    buildTicks: 20,
    description: 'Undead structure. Adds 100 gold each tick and improves peasant growth by 5% for each 1% of land developed, effective up to 20%.',
    image: '/game/buildings/crypt.webp',
    allowedRaces: ['Undead'],
    maxEffectivePercent: 20,
  },
  {
    name: 'Dock',
    costGold: 1500,
    costMetal: 1500,
    buildTicks: 20,
    description: 'Produces 50 gold, 15 metal and 15 food; provides specialist housing and modifies growth, attack and research speed.',
    image: '/game/buildings/dock.webp',
    requirements: [{ science: 'Infrastructure:8', level: 1, legacyName: 'Infrastructure 8' }],
    maxEffectivePercent: 20,
    peasantHousing: 25,
  },
  {
    name: 'Farm',
    costGold: 1000,
    costMetal: 0,
    buildTicks: 10,
    description: 'Produces 65 food every tick.',
    image: '/game/buildings/farms.webp',
  },
  {
    name: 'Home',
    costGold: 1000,
    costMetal: 0,
    buildTicks: 10,
    description: 'Houses 40 people and improves peasant growth by 1% for each 1% of land developed.',
    image: '/game/buildings/town-homes.webp',
    peasantHousing: 40,
  },
  {
    name: 'Inn',
    costGold: 750,
    costMetal: 50,
    buildTicks: 20,
    description: 'Houses 30 thieves and 20 people, and improves thievery offense and defense by 1% for each 1% of land developed.',
    image: '/game/buildings/inn.webp',
  },
  {
    name: 'Marketplace',
    costGold: 2200,
    costMetal: 250,
    buildTicks: 20,
    description: 'Adds 3% to gold, metal and food production and reduces trade loss by 2% for each 1% of land developed, effective up to 40%.',
    image: '/game/buildings/marketplace.webp',
    maxEffectivePercent: 40,
  },
  {
    name: 'Mine',
    costGold: 1500,
    costMetal: 0,
    buildTicks: 15,
    description: 'Produces 10 gold and 100 metal every tick.',
    image: '/game/buildings/metal-mines.webp',
    requirements: [{ science: 'Infrastructure:1', level: 1, legacyName: 'Infrastructure 1' }],
  },
  {
    name: 'Stable',
    costGold: 2000,
    costMetal: 150,
    buildTicks: 20,
    description: 'Reduces attack time by 2% for each 1% of land developed, effective up to 15%.',
    image: '/game/buildings/stable.webp',
    allowedRaces: ['Human', 'Elf', 'Dwarf', 'Undead', 'Giant'],
    requirements: [
      { science: 'Military:4', level: 1, legacyName: 'Military 4' },
      { science: 'Infrastructure:4', level: 1, legacyName: 'Infrastructure 4' },
    ],
    maxEffectivePercent: 15,
  },
  {
    name: 'Temple',
    costGold: 1500,
    costMetal: 0,
    buildTicks: 20,
    description: 'Adds 100 gold each tick and improves peasant growth by 5% for each 1% of land developed, effective up to 20%.',
    image: '/game/buildings/temples.webp',
    allowedRaces: ['Human', 'Elf', 'Dwarf', 'Orc', 'Giant'],
    maxEffectivePercent: 20,
  },
  {
    name: 'Wall',
    costGold: 200,
    costMetal: 250,
    buildTicks: 20,
    description: 'Increases defense by 2% for each 1% of land developed, effective up to 10%, and houses 10 people.',
    image: '/game/buildings/guard-towers.webp',
    maxEffectivePercent: 10,
    peasantHousing: 10,
  },
  {
    name: 'Wizard Tower',
    costGold: 750,
    costMetal: 0,
    buildTicks: 20,
    description: 'Houses 30 wizards and 20 people, and improves spell success and magic protection by 1% for each 1% of land developed.',
    image: '/game/buildings/wizard-towers.webp',
  },
];

const LEGACY_ALIASES: Record<string, string> = {
  Farms: 'Farm',
  'Town Homes': 'Home',
  Barracks: 'Barrack',
  'Gold Mines': 'Mine',
  'Metal Mines': 'Mine',
  'Guard Towers': 'Wall',
  'Wizard Towers': 'Wizard Tower',
  Temples: 'Temple',
  'Beast Dens': 'Beast den',
};

export const BUILDING_BY_NAME = new Map(ORIGINAL_BUILDINGS.map(building => [building.name, building]));

export function canonicalBuildingName(name: string | null | undefined): string {
  const value = name ?? '';
  return LEGACY_ALIASES[value] ?? value;
}

export function getBuildingRule(name: string | null | undefined): OriginalBuilding | undefined {
  return BUILDING_BY_NAME.get(canonicalBuildingName(name));
}

export function unmetBuildingRequirements(
  building: OriginalBuilding,
  raceName: string,
  scienceLevels: Map<string, number>,
): string[] {
  const unmet: string[] = [];
  if (building.allowedRaces && !building.allowedRaces.includes(raceName)) {
    unmet.push(`Available to ${building.allowedRaces.join(', ')} only`);
  }
  for (const requirement of building.requirements ?? []) {
    if ((scienceLevels.get(requirement.science) ?? 0) < requirement.level) {
      unmet.push(`Requires ${requirement.legacyName}`);
    }
  }
  return unmet;
}

/**
 * The original Effect engine multiplies independent modifiers. Human, Elf and
 * Undead build 20% faster; Summer is another 10% faster; Architecture is 30%.
 */
export function effectiveBuildTicks(
  baseTicks: number,
  raceName: string,
  season: string,
  hasArchitecture: boolean,
): number {
  let multiplier = 1;
  if (['Human', 'Elf', 'Undead'].includes(raceName)) multiplier *= 0.8;
  if (season === 'Summer') multiplier *= 0.9;
  if (hasArchitecture) multiplier *= 0.7;
  return Math.max(1, Math.round(baseTicks * multiplier));
}

/** Returns the legacy additive effect as a fraction (0.02 means +2%). */
export function buildingEffect(
  count: number,
  acres: number,
  bonusPerLandFraction: number,
  maxEffectivePercent = 0,
): number {
  if (acres <= 0 || count <= 0) return 0;
  const fraction = count / acres;
  const effectiveFraction = maxEffectivePercent > 0
    ? Math.min(fraction, maxEffectivePercent / 100)
    : fraction;
  return effectiveFraction * bonusPerLandFraction;
}
