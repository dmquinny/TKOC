import type { KnowledgeLevels } from '@/lib/science';

export type SpellTarget = 'friendly' | 'hostile' | 'self';
export type SpellMode = 'direct' | 'timed' | 'dispel';

export interface LegacySpell {
  id: number;
  className: string;
  name: string;
  target: SpellTarget;
  mode: SpellMode;
  mana: number;
  gold: number;
  metal: number;
  food: number;
  peasants: number;
  wizards: number;
  req: Partial<KnowledgeLevels>;
  races?: string[];
  targetRaces?: string[];
  immuneRaces?: string[];
  kingdom?: boolean;
  maxStack?: number;
  description: string;
}

const spell = (
  id: number,
  className: string,
  name: string,
  target: SpellTarget,
  mode: SpellMode,
  mana: number,
  costs: [number, number, number, number, number],
  description: string,
  extra: Partial<Omit<LegacySpell, 'id' | 'className' | 'name' | 'target' | 'mode' | 'mana' | 'gold' | 'metal' | 'food' | 'peasants' | 'wizards' | 'description'>> = {},
): LegacySpell => ({
  id, className, name, target, mode, mana,
  gold: costs[0], metal: costs[1], food: costs[2], peasants: costs[3], wizards: costs[4],
  req: {},
  description,
  ...extra,
});

// SpellT IDs and constructor values from the original PHP game. CleansingSpell
// is intentionally absent: the old loader explicitly disabled that class.
export const LEGACY_SPELLS: LegacySpell[] = [
  spell(1, 'DispelSpell', 'Dispel', 'friendly', 'dispel', 2.5, [3, 2, 0, 0, 1], 'Remove one active spell from the target.'),
  spell(2, 'EnchantedLandSpell', 'Enchanted Land', 'friendly', 'timed', 8, [1.1, .55, 0, 0, .44], 'Raises metal 9%, food 7%, gold 5%, and peasant growth 6%.', { races: ['Human', 'Elf', 'Dwarf', 'Orc', 'Giant'], kingdom: true }),
  spell(3, 'FireworksSpell', 'Fireworks', 'friendly', 'direct', 10, [4, 2, 10, 0, 1], 'Raises morale by 5–15%.', { races: ['Human', 'Elf', 'Orc', 'Giant'], req: { magic: 2 }, kingdom: true }),
  spell(4, 'MagicShieldSpell', 'Magic Shield', 'friendly', 'timed', 5, [2, 0, 5, 0, 1.5], 'Raises magic protection by 25%.', { kingdom: true }),
  spell(5, 'RottenLandSpell', 'Rotten Land', 'hostile', 'timed', 10, [1, 1, 2, 0, .75], 'Reduces gold and metal 7.5%, food and growth 10%.'),
  spell(6, 'RainSpell', 'Rain', 'hostile', 'direct', 15, [2.5, 7.5, 5, 0, 1.75], 'Lowers enemy morale by 5–15%.', { races: ['Human', 'Elf', 'Orc', 'Giant'], req: { magic: 2 } }),
  spell(7, 'ReduceMagicProtectionSpell', 'Reduce Magic Protection', 'hostile', 'timed', 10, [3, 0, 3, 0, 1.75], 'Reduces enemy magic protection by 25%.'),
  spell(8, 'BugInfestationSpell', 'Bug Infestation', 'hostile', 'direct', 25, [7.5, 5, 10, 0, 2], 'Returns 5–20% of buildings to construction for 10–20 ticks.', { req: { magic: 4 } }),
  spell(10, 'ApocalypseSpell', 'Apocalypse', 'hostile', 'direct', 75, [110, 110, 75, 0, 10], 'Devastates land, population, military, morale, mana, influence, and resources.', { req: { military: 128, infrastructure: 128, magic: 128, thievery: 128 } }),
  spell(9, 'EarthQuakeSpell', 'Earthquake', 'hostile', 'direct', 40, [50, 15, 0, 0, 3], 'Destroys 5–8% land, 3–10% peasants, and 1–3% military.', { races: ['Human', 'Elf', 'Orc', 'Giant'], req: { magic: 8 } }),
  spell(11, 'HolySpell', 'Holy', 'hostile', 'direct', 20, [15, 2, 0, 0, .75], 'Damages Undead population, troops, and Crypts.', { races: ['Human', 'Elf'], targetRaces: ['Undead'], req: { magic: 2 } }),
  spell(12, 'FearSpell', 'Fear', 'hostile', 'direct', 15, [5, 5, 2.5, .1, 1], 'Lowers enemy morale by 8–15%.', { races: ['Undead'], immuneRaces: ['Undead'], req: { magic: 2 } }),
  spell(13, 'VerminPlagueSpell', 'Vermin Plague', 'hostile', 'timed', 5, [1, 1, 0, .05, .2], 'Reduces food production by 15%.', { races: ['Undead'] }),
  spell(14, 'DrainSpell', 'Drain', 'hostile', 'timed', 5, [3, 3, 2, .1, .75], 'Drains 1–7 mana from the target each tick.', { races: ['Undead'], req: { magic: 2 } }),
  spell(15, 'DoomSpell', 'Doom', 'hostile', 'timed', 30, [50, 20, 10, .5, 3], 'Kills 0.5–1.5% of population and military each tick.', { races: ['Undead'], immuneRaces: ['Undead'], req: { magic: 8 } }),
  spell(16, 'AlarmSpell', 'Alarm', 'friendly', 'timed', 10, [1.75, .75, 2, 0, 1], 'Raises thievery defense by 20%.', { races: ['Human', 'Elf', 'Dwarf', 'Orc'], req: { thievery: 1 }, kingdom: true }),
  spell(17, 'SilenceSpell', 'Silence', 'friendly', 'timed', 15, [1, .75, 1, 0, 1], 'Raises thievery offense by 20%.', { races: ['Human', 'Elf', 'Dwarf', 'Orc', 'Giant'], req: { thievery: 1 }, kingdom: true }),
  spell(18, 'HasteSpell', 'Haste', 'friendly', 'timed', 15, [4, 5, 7, 0, 2], 'Reduces attack time by 15%.', { req: { magic: 2 }, kingdom: true }),
  spell(19, 'SlowSpell', 'Slow', 'hostile', 'timed', 20, [5, 5, 5, 0, 2], 'Increases attack time by 10%.', { req: { magic: 2 } }),
  spell(20, 'ManaTransferSpell', 'Mana Transfer', 'friendly', 'direct', 2.5, [3, 3, 3, 0, 2], 'Transfers 70–99% of 50 mana to another kingdom province.', { races: ['Elf'], req: { magic: 2 }, kingdom: true }),
  spell(21, 'BattleFrenzySpell', 'Battle Frenzy', 'friendly', 'timed', 15, [2, 0, 5, 0, 2], 'Raises attack by 5%. May stack twice.', { races: ['Orc', 'Dwarf'], kingdom: true, maxStack: 2 }),
  spell(22, 'EnrageSpell', 'Enrage', 'friendly', 'timed', 20, [2, 0, 5, 0, 2], 'Raises attack by 7.5%.', { races: ['Human', 'Elf', 'Undead', 'Giant'], req: { magic: 2 }, kingdom: true }),
  spell(23, 'PhysicalShieldSpell', 'Physical Shield', 'friendly', 'timed', 10, [2, 0, 5, 0, 1.5], 'Raises defense by 10%.', { kingdom: true }),
  spell(24, 'ResurrectSpell', 'Resurrect', 'self', 'timed', 20, [30, 20, 20, .5, 1.25], 'Raises lost souls as new soldiers each tick.', { races: ['Undead'], req: { magic: 8 } }),
  spell(25, 'SoulHarvestSpell', 'Soul Harvest', 'hostile', 'direct', 40, [70, 25, 20, .5, 3], 'Kills 1.5–3% of an enemy and harvests souls.', { races: ['Undead'], immuneRaces: ['Undead'], req: { magic: 8 } }),
  spell(26, 'GrowthSpell', 'Growth', 'self', 'direct', 25, [5, 2.5, 1, 0, 1], 'Instantly grows the province by 5–10 acres.', { races: ['Human', 'Elf', 'Orc', 'Dwarf', 'Undead', 'Giant'] }),
  spell(27, 'ResourceTeleportationSpell', 'Resource Teleportation', 'friendly', 'timed', 20, [1.5, .5, 1, 0, .7], 'Reduces caravan losses by 70%.', { races: ['Elf'], req: { magic: 2 }, kingdom: true }),
  spell(28, 'CleanseSpell', 'Cleanse', 'friendly', 'direct', 13, [3, 2, 0, 0, 1], 'Removes hostile magic from a kingdom province.', { races: ['Elf'], req: { magic: 2 }, kingdom: true }),
  spell(29, 'ArcaneShieldSpell', 'Arcane Shield', 'friendly', 'timed', 15, [9, 4, 6, 0, 2.5], 'Raises defense 8%, magic protection 15%, and thievery defense 15%.', { races: ['Elf'], req: { magic: 2 }, kingdom: true }),
  spell(30, 'RufunkaSpell', 'Rufunka', 'self', 'timed', 40, [50, 10, 8, 0, 3.5], 'Raises attack by 25%.', { races: ['Elf'], req: { military: 4 } }),
  spell(31, 'BattleFurySpell', 'Battle Fury', 'self', 'timed', 25, [30, 8, 5, 0, 2], 'Raises attack by 12%.', { races: ['Human'], req: { military: 4 } }),
];

export const LEGACY_SPELL_BY_NAME = new Map(LEGACY_SPELLS.map(entry => [entry.name, entry]));

export function knowledgeAllows(requirements: Partial<KnowledgeLevels>, levels: KnowledgeLevels): boolean {
  return (Object.keys(requirements) as Array<keyof KnowledgeLevels>)
    .every(key => !requirements[key] || Boolean((requirements[key] ?? 0) & levels[key]));
}

export function legacySizeModifier(ownAcres: number, targetAcres: number): number {
  const high = Math.max(1, ownAcres, targetAcres);
  return Math.max(0.0001, Math.min(1, Math.min(ownAcres, targetAcres) / high));
}

export function legacySpellStrength(ownAcres: number, targetAcres: number, ownWizards: number, targetWizards: number, friendly: boolean): number {
  let strength = 1 + Math.log10(legacySizeModifier(ownAcres, targetAcres));
  if (targetWizards > 0 && ownWizards <= 0) strength = 0;
  else if (targetWizards > 0 && ownWizards > 0) {
    strength *= Math.max(0, Math.min(1, 1 + Math.log10((ownWizards / Math.max(1, ownAcres)) / (targetWizards / Math.max(1, targetAcres)))));
  }
  if (friendly) strength *= 2;
  return Math.max(0.0001, Math.min(1, strength));
}

export function manaTransferReceived(percent: number, manaPool = 50): number {
  return Math.floor(Math.max(0, manaPool) * Math.max(70, Math.min(99, percent)) / 100);
}

export function activeSpellPercent(
  effects: Array<{ type: string; magnitude: number }>,
  stat: 'attack' | 'defense' | 'gold' | 'metal' | 'food' | 'growth' | 'magicProtection' | 'thieveryOffense' | 'thieveryDefense' | 'attackTime' | 'aidLoss',
): number {
  const values: Record<string, Partial<Record<typeof stat, number>>> = {
    EnchantedLandSpell: { gold: 5, metal: 9, food: 7, growth: 6 },
    MagicShieldSpell: { magicProtection: 25 },
    RottenLandSpell: { gold: -7.5, metal: -7.5, food: -10, growth: -10 },
    ReduceMagicProtectionSpell: { magicProtection: -25 },
    VerminPlagueSpell: { food: -15 },
    AlarmSpell: { thieveryDefense: 20 },
    SilenceSpell: { thieveryOffense: 20 },
    HasteSpell: { attackTime: -15 },
    SlowSpell: { attackTime: 10 },
    BattleFrenzySpell: { attack: 5 },
    EnrageSpell: { attack: 7.5 },
    PhysicalShieldSpell: { defense: 10 },
    ArcaneShieldSpell: { defense: 8, magicProtection: 15, thieveryDefense: 15 },
    RufunkaSpell: { attack: 25 },
    BattleFurySpell: { attack: 12 },
    ResourceTeleportationSpell: { aidLoss: -70 },
  };
  return effects.reduce((total, effect) => {
    const base = values[effect.type]?.[stat] ?? 0;
    return total + base * Math.max(0, Math.min(100, effect.magnitude)) / 100;
  }, 0);
}
