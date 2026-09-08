export type LegacyMilitaryCategory =
  | 'soldiers'
  | 'offense'
  | 'defense'
  | 'elite'
  | 'thieves'
  | 'wizards';

export interface OriginalMilitaryType {
  className: string;
  displayName: string;
  raceName: string;
  category: LegacyMilitaryCategory;
  trainTicks: number;
  costGold: number;
  costMetal: number;
  costFood: number;
  attack: number;
  defense: number;
}

// MilitaryT IDs 1..36 and the constructor values in scripts/military.
export const ORIGINAL_MILITARY_TYPES: OriginalMilitaryType[] = [
  { className: 'HumanRecruitsMilitary', displayName: 'Recruits', raceName: 'Human', category: 'soldiers', trainTicks: 12, costGold: 200, costMetal: 0, costFood: 0, attack: 1, defense: 1 },
  { className: 'HumanAttackersMilitary', displayName: 'Legions', raceName: 'Human', category: 'offense', trainTicks: 18, costGold: 450, costMetal: 0, costFood: 0, attack: 3, defense: 1 },
  { className: 'HumanDefendersMilitary', displayName: 'Pikemen', raceName: 'Human', category: 'defense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 50, attack: 1, defense: 3 },
  { className: 'HumanElitesMilitary', displayName: 'Paladins', raceName: 'Human', category: 'elite', trainTicks: 24, costGold: 1500, costMetal: 500, costFood: 300, attack: 5, defense: 5 },
  { className: 'HumanThievesMilitary', displayName: 'Thieves', raceName: 'Human', category: 'thieves', trainTicks: 24, costGold: 800, costMetal: 0, costFood: 80, attack: 1, defense: 2 },
  { className: 'HumanMagiciansMilitary', displayName: 'Wizards', raceName: 'Human', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },

  { className: 'OrcRecruitsMilitary', displayName: 'Goblins', raceName: 'Orc', category: 'soldiers', trainTicks: 12, costGold: 300, costMetal: 0, costFood: 0, attack: 1, defense: 2 },
  { className: 'OrcAttackersMilitary', displayName: 'Wolf Riders', raceName: 'Orc', category: 'offense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 0, attack: 3, defense: 1 },
  { className: 'OrcDefendersMilitary', displayName: 'Black Orcs', raceName: 'Orc', category: 'defense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 50, attack: 1, defense: 3 },
  { className: 'OrcElitesMilitary', displayName: 'Trolls', raceName: 'Orc', category: 'elite', trainTicks: 24, costGold: 1500, costMetal: 500, costFood: 300, attack: 6, defense: 4 },
  { className: 'OrcThievesMilitary', displayName: 'Bandits', raceName: 'Orc', category: 'thieves', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
  { className: 'OrcMagiciansMilitary', displayName: 'Shamans', raceName: 'Orc', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },

  { className: 'ElfRecruitsMilitary', displayName: 'Recruits', raceName: 'Elf', category: 'soldiers', trainTicks: 12, costGold: 250, costMetal: 0, costFood: 0, attack: 1, defense: 1 },
  { className: 'ElfAttackersMilitary', displayName: 'Rangers', raceName: 'Elf', category: 'offense', trainTicks: 18, costGold: 650, costMetal: 0, costFood: 0, attack: 4, defense: 1 },
  { className: 'ElfDefendersMilitary', displayName: 'Archers', raceName: 'Elf', category: 'defense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 50, attack: 1, defense: 3 },
  { className: 'ElfElitesMilitary', displayName: 'Pegasus Riders', raceName: 'Elf', category: 'elite', trainTicks: 24, costGold: 1300, costMetal: 450, costFood: 250, attack: 2, defense: 6 },
  { className: 'ElfThievesMilitary', displayName: 'Thieves', raceName: 'Elf', category: 'thieves', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
  { className: 'ElfMagiciansMilitary', displayName: 'Magicians', raceName: 'Elf', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },

  { className: 'DwarfRecruitsMilitary', displayName: 'Warriors', raceName: 'Dwarf', category: 'soldiers', trainTicks: 12, costGold: 300, costMetal: 0, costFood: 0, attack: 1, defense: 2 },
  { className: 'DwarfAttackersMilitary', displayName: 'Axe Men', raceName: 'Dwarf', category: 'offense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 0, attack: 3, defense: 2 },
  { className: 'DwarfDefendersMilitary', displayName: 'Dwarven Defender', raceName: 'Dwarf', category: 'defense', trainTicks: 18, costGold: 700, costMetal: 0, costFood: 50, attack: 1, defense: 4 },
  { className: 'DwarfElitesMilitary', displayName: 'Iron Breakers', raceName: 'Dwarf', category: 'elite', trainTicks: 24, costGold: 1200, costMetal: 400, costFood: 200, attack: 5, defense: 3 },
  { className: 'DwarfThievesMilitary', displayName: 'Bandits', raceName: 'Dwarf', category: 'thieves', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
  { className: 'DwarfMagiciansMilitary', displayName: 'Magicians', raceName: 'Dwarf', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },

  { className: 'UndeadRecruitsMilitary', displayName: 'Slaves', raceName: 'Undead', category: 'soldiers', trainTicks: 12, costGold: 250, costMetal: 0, costFood: 0, attack: 1, defense: 1 },
  { className: 'UndeadAttackersMilitary', displayName: 'Skeletons', raceName: 'Undead', category: 'offense', trainTicks: 18, costGold: 650, costMetal: 0, costFood: 0, attack: 4, defense: 1 },
  { className: 'UndeadDefendersMilitary', displayName: 'Zombies', raceName: 'Undead', category: 'defense', trainTicks: 18, costGold: 500, costMetal: 0, costFood: 50, attack: 1, defense: 3 },
  { className: 'UndeadElitesMilitary', displayName: 'Vampires', raceName: 'Undead', category: 'elite', trainTicks: 24, costGold: 1400, costMetal: 500, costFood: 300, attack: 4, defense: 5 },
  { className: 'UndeadThievesMilitary', displayName: 'Ghosts', raceName: 'Undead', category: 'thieves', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
  { className: 'UndeadMagiciansMilitary', displayName: 'Liches', raceName: 'Undead', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },

  { className: 'GiantRecruitsMilitary', displayName: 'Recruits', raceName: 'Giant', category: 'soldiers', trainTicks: 15, costGold: 500, costMetal: 0, costFood: 0, attack: 2, defense: 2 },
  { className: 'GiantAttackersMilitary', displayName: 'Fire Giants', raceName: 'Giant', category: 'offense', trainTicks: 20, costGold: 700, costMetal: 0, costFood: 0, attack: 4, defense: 2 },
  { className: 'GiantDefendersMilitary', displayName: 'Frost Giants', raceName: 'Giant', category: 'defense', trainTicks: 18, costGold: 650, costMetal: 0, costFood: 100, attack: 2, defense: 4 },
  { className: 'GiantElitesMilitary', displayName: 'Earth Giants', raceName: 'Giant', category: 'elite', trainTicks: 24, costGold: 1800, costMetal: 600, costFood: 350, attack: 6, defense: 6 },
  { className: 'GiantThievesMilitary', displayName: 'Thieves', raceName: 'Giant', category: 'thieves', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
  { className: 'GiantMagiciansMilitary', displayName: 'Wizards', raceName: 'Giant', category: 'wizards', trainTicks: 24, costGold: 1000, costMetal: 0, costFood: 100, attack: 1, defense: 1 },
];

export function militaryName(type: {
  displayName?: string | null;
  className?: string | null;
}): string {
  return type.displayName || type.className || 'Unit';
}

