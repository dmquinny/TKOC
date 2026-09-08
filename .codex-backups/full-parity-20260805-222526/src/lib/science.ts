export interface OriginalScienceType {
  className: string;
  name: string;
  category: 'military' | 'infrastructure' | 'magic' | 'thievery';
  researchTicks: number;
  costGold: number;
  costMetal: number;
  reqMilitary: number;
  reqInfrastructure: number;
  reqMagic: number;
  reqThievery: number;
  givesMilitary: number;
  givesInfrastructure: number;
  givesMagic: number;
  givesThievery: number;
  effect: string;
  bonusPerLevel: number;
  maxLevel: number;
  description: string;
  races?: string[];
  hidden?: boolean;
}

const science = (
  className: string,
  name: string,
  category: OriginalScienceType['category'],
  researchTicks: number,
  costGold: number,
  costMetal: number,
  requirements: [number, number, number, number],
  gives: [number, number, number, number],
  effect: string,
  bonusPerLevel: number,
  description: string,
  extra: Pick<OriginalScienceType, 'races' | 'hidden'> = {},
): OriginalScienceType => ({
  className,
  name,
  category,
  researchTicks,
  costGold,
  costMetal,
  reqMilitary: requirements[0],
  reqInfrastructure: requirements[1],
  reqMagic: requirements[2],
  reqThievery: requirements[3],
  givesMilitary: gives[0],
  givesInfrastructure: gives[1],
  givesMagic: gives[2],
  givesThievery: gives[3],
  effect,
  bonusPerLevel,
  maxLevel: 1,
  description,
  ...extra,
});

// ScienceCat IDs 1..23 from tkoc_stable.sql, paired with the values in each
// legacy ScienceBase constructor.
export const ORIGINAL_SCIENCES: OriginalScienceType[] = [
  science('ConstructionScience', 'Architecture', 'infrastructure', 36, 3_000_000, 200_000, [8, 4, 0, 0], [0, 8, 0, 0], 'buildTime', -30, 'Reduces construction time by 30%.'),
  science('AgricultureScience', 'Agriculture', 'infrastructure', 24, 750_000, 0, [0, 1, 0, 0], [0, 2, 0, 0], 'foodProduction', 30, 'Increases food production by 30%.'),
  science('MetalWorkingScience', 'Metal Working', 'infrastructure', 36, 150_000, 50_000, [0, 2, 0, 0], [0, 4, 0, 0], 'knowledge', 0, 'Unlocks advanced infrastructure and metal equipment.'),
  science('MiningScience', 'Mining', 'infrastructure', 12, 100_000, 0, [0, 0, 0, 0], [0, 1, 0, 0], 'knowledge', 0, 'Unlocks mines and the infrastructure knowledge tree.'),
  science('LeatherArmourScience', 'Leather Armour', 'military', 28, 500_000, 5_000, [1, 0, 0, 0], [2, 0, 0, 0], 'combatBoth', 5, 'Increases attack and defense by 5%.'),
  science('MetalWeaponsScience', 'Metal Weapons', 'military', 35, 2_000_000, 50_000, [2, 4, 0, 0], [8, 0, 0, 0], 'combatBoth', 10, 'Increases attack and defense by 10%.'),
  science('EspionageScience', 'Espionage', 'thievery', 20, 500_000, 0, [0, 0, 0, 0], [0, 0, 0, 1], 'thieveryOffense', 25, 'Increases offensive thievery by 25% and unlocks Spy on Kingdom.'),
  science('MageCircleScience', 'Mage circle', 'magic', 18, 250_000, 0, [0, 0, 0, 0], [0, 0, 1, 0], 'wizardUse', -25, 'Reduces the number of wizards required to cast by 25%.'),
  science('CovertOperationsScience', 'Covert Operations', 'thievery', 40, 2_500_000, 0, [0, 0, 0, 1], [0, 0, 0, 2], 'thieveryLoss', -30, 'Reduces thievery losses by 30% and unlocks covert operations.'),
  science('AttackMagicScience', 'Attack Magic', 'magic', 28, 1_500_000, 500_000, [0, 0, 1, 0], [0, 0, 2, 0], 'knowledge', 0, 'Unlocks offensive magic.'),
  science('EarthQuakeMagicScience', 'Devastating Spells', 'magic', 36, 10_000_000, 4_000_000, [0, 0, 2, 0], [0, 0, 8, 0], 'knowledge', 0, 'Unlocks devastating spells.'),
  science('BugInfestationMagicScience', 'Bug infestation', 'magic', 40, 5_000_000, 750_000, [0, 0, 2, 0], [0, 0, 4, 0], 'knowledge', 0, 'Unlocks infestation magic.'),
  science('ApocalypseScience', 'Apocalypse', 'magic', 240, 10_000_001, 5_000_000, [16, 8, 8, 8], [128, 128, 128, 128], 'apocalypse', 0, 'Forbidden knowledge said to bring about the Apocalypse.'),
  science('BasicWarScience', 'Basic Attacking', 'military', 12, 50_000, 0, [0, 0, 0, 0], [1, 0, 0, 0], 'knowledge', 0, 'Unlocks basic military training and attacks.'),
  science('EliteMilitaryScience', 'Military Training', 'military', 40, 2_000_000, 100_000, [2, 0, 0, 0], [4, 0, 0, 0], 'knowledge', 0, 'Unlocks elite military training.'),
  science('StrategicWarScience', 'Strategic War', 'military', 12, 2_500_000, 1_500_000, [8, 0, 0, 0], [16, 0, 0, 0], 'knowledge', 0, 'Unlocks strategic attacks such as Massacre.'),
  science('TradeScience', 'Trade', 'infrastructure', 35, 1_500_000, 100_000, [0, 2, 0, 0], [0, 8, 0, 0], 'tradeCosts', -25, 'Reduces military metal cost by 25% and magic costs.'),
  science('EndGameScience', 'Time Stop', 'magic', 300, 0, 0, [1024, 1024, 1024, 1024], [1024, 1024, 1024, 1024], 'endGame', 0, 'Internal age-ending timer.', { hidden: true }),
  science('SmartThievesScience', 'Smart thieves', 'thievery', 36, 250_000, 0, [0, 0, 0, 2], [0, 0, 0, 4], 'knowledge', 0, 'Unlocks advanced thievery.'),
  science('DarkOpsScience', 'Dark Operations', 'thievery', 46, 2_500_000, 0, [4, 4, 0, 4], [0, 0, 0, 8], 'knowledge', 0, 'Unlocks dark operations.'),
  science('ReligionScience', 'Theology', 'infrastructure', 48, 5_000_000, 1_500_000, [8, 4, 0, 0], [8, 4, 0, 16], 'theology', 5, 'Adds 1 mana and influence regeneration and 5% attack.', { races: ['Human', 'Elf', 'Orc', 'Dwarf', 'Undead'] }),
  science('CityPlanningScience', 'City planning', 'infrastructure', 48, 5_000_000, 1_500_000, [8, 8, 0, 0], [8, 8, 0, 2], 'housing', 10, 'Increases population capacity by 10%.', { races: ['Human', 'Elf', 'Orc', 'Dwarf', 'Undead'] }),
  science('ReligionScienceGiant', "Giant's Theology", 'infrastructure', 48, 5_000_000, 1_500_000, [8, 4, 0, 0], [8, 4, 0, 0], 'theology', 5, 'Giant theology adds regeneration and 5% attack.', { races: ['Giant'] }),
];

const SCIENCE_IMAGE_BY_CLASS: Record<string, string> = {
  ConstructionScience: '/game/buildings/marketplace.webp',
  AgricultureScience: '/game/science/agriculture.webp',
  MetalWorkingScience: '/game/science/metallurgy.webp',
  MiningScience: '/game/buildings/metal-mines.webp',
  LeatherArmourScience: '/game/units/pikemen.webp',
  MetalWeaponsScience: '/game/units/swordsmen.webp',
  EspionageScience: '/game/science/crime.webp',
  MageCircleScience: '/game/science/alchemy.webp',
  CovertOperationsScience: '/game/spells/alarm.webp',
  AttackMagicScience: '/game/spells/fireball.webp',
  EarthQuakeMagicScience: '/game/spells/earthquake.webp',
  BugInfestationMagicScience: '/game/spells/bug-infestation.webp',
  ApocalypseScience: '/game/spells/apocalypse.webp',
  BasicWarScience: '/game/units/recruits.webp',
  EliteMilitaryScience: '/game/buildings/barracks.webp',
  StrategicWarScience: '/game/science/warfare.webp',
  TradeScience: '/game/science/banking.webp',
  EndGameScience: '/game/spells/slow.webp',
  SmartThievesScience: '/game/units/thieves.webp',
  DarkOpsScience: '/game/spells/doom.webp',
  ReligionScience: '/game/buildings/temples.webp',
  CityPlanningScience: '/game/buildings/town-homes.webp',
  ReligionScienceGiant: '/game/races/giant.webp',
};

export function scienceImageForClass(className: string): string {
  return SCIENCE_IMAGE_BY_CLASS[className] ?? '/game/science/tools.webp';
}

export interface KnowledgeLevels {
  military: number;
  infrastructure: number;
  magic: number;
  thievery: number;
}

export interface ScienceRequirementDetail {
  category: keyof KnowledgeLevels;
  names: string[];
  met: boolean;
}

const KNOWLEDGE_FIELDS = [
  { category: 'military', requires: 'reqMilitary', gives: 'givesMilitary', label: 'Military' },
  { category: 'infrastructure', requires: 'reqInfrastructure', gives: 'givesInfrastructure', label: 'Infrastructure' },
  { category: 'magic', requires: 'reqMagic', gives: 'givesMagic', label: 'Magic' },
  { category: 'thievery', requires: 'reqThievery', gives: 'givesThievery', label: 'Thievery' },
] as const;

export function scienceRequirementDetails(
  scienceType: OriginalScienceType,
  availableSciences: OriginalScienceType[],
  knowledge: KnowledgeLevels,
): ScienceRequirementDetail[] {
  return KNOWLEDGE_FIELDS.flatMap(field => {
    const requiredKnowledge = scienceType[field.requires];
    if (!requiredKnowledge) return [];
    const sources = availableSciences
      .filter(candidate => (
        candidate.className !== scienceType.className
        && Boolean(candidate[field.gives] & requiredKnowledge)
        && !Boolean(candidate[field.requires] & requiredKnowledge)
      ))
      .map(candidate => candidate.name);
    return [{
      category: field.category,
      names: sources.length ? sources : [`${field.label} knowledge`],
      met: Boolean(knowledge[field.category] & requiredKnowledge),
    }];
  });
}

export function scienceUnlockNames(
  scienceType: OriginalScienceType,
  availableSciences: OriginalScienceType[],
): string[] {
  return availableSciences
    .filter(candidate => (
      candidate.className !== scienceType.className
      && KNOWLEDGE_FIELDS.some(field => {
        const newlyGranted = scienceType[field.gives] & ~scienceType[field.requires];
        return Boolean(newlyGranted && (candidate[field.requires] & newlyGranted));
      })
    ))
    .map(candidate => candidate.name);
}

export function scienceKnowledge(
  completed: Array<{ type: {
    givesMilitary: number;
    givesInfrastructure: number;
    givesMagic: number;
    givesThievery: number;
  } }>,
): KnowledgeLevels {
  return completed.reduce<KnowledgeLevels>((levels, entry) => ({
    military: levels.military | entry.type.givesMilitary,
    infrastructure: levels.infrastructure | entry.type.givesInfrastructure,
    magic: levels.magic | entry.type.givesMagic,
    thievery: levels.thievery | entry.type.givesThievery,
  }), { military: 0, infrastructure: 0, magic: 0, thievery: 0 });
}

export function requirementsMet(
  type: Pick<OriginalScienceType, 'reqMilitary' | 'reqInfrastructure' | 'reqMagic' | 'reqThievery'>,
  levels: KnowledgeLevels,
): boolean {
  return (
    (!type.reqMilitary || Boolean(type.reqMilitary & levels.military))
    && (!type.reqInfrastructure || Boolean(type.reqInfrastructure & levels.infrastructure))
    && (!type.reqMagic || Boolean(type.reqMagic & levels.magic))
    && (!type.reqThievery || Boolean(type.reqThievery & levels.thievery))
  );
}
