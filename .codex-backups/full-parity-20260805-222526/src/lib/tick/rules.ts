// Economy and combat rules ported from the legacy Server.class.inc.php engine.
// Keeping these values in one module makes parity changes reviewable without
// mixing them into the scheduler and persistence workflow.
export const PEASANT_EARNS = 3;
export const MILITARY_PAY = 0.6;
export const FOOD_EATEN = 0.35;
export const PEASANT_BIRTH = 0.025;

export const FARM_FOOD = 65;
export const MINE_METAL_OUTPUT = 100;
export const MINE_GOLD_OUTPUT = 10;
export const HOME_CAPACITY = 40;
export const ACRE_CAPACITY = 15;

export const MANA_REGEN = 5;
export const INFLUENCE_REGEN = 5;

export function combatProfile(attackType: number) {
  switch (attackType) {
    case 2:
      return { land: 0.05, resource: 0, winAtk: 0.15, winDef: 0.30, loseAtk: 0.40, loseDef: 0.12 };
    case 5:
      return { land: 0.05, resource: 0.15, winAtk: 0.05, winDef: 0.10, loseAtk: 0.30, loseDef: 0.04 };
    default:
      return { land: 0.10, resource: 0.10, winAtk: 0.08, winDef: 0.18, loseAtk: 0.35, loseDef: 0.06 };
  }
}

export type ProvinceWithSci = {
  raceId: number | null;
  councilId?: number | null;
  science?: { level: number; type: { effect: string; bonusPerLevel: number } }[];
  effects?: { type: string; magnitude: number }[];
};
