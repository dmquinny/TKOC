import { canonicalBuildingName } from './buildings';

export interface HousingBuilding {
  num: number;
  type: { className: string | null };
}

export function legacyPeasantHousing(
  acres: number,
  buildings: HousingBuilding[],
  raceMultiplier = 1,
  sciencePercent = 0,
): number {
  const baseAcreCapacity = 15;
  const raw = Math.max(0, acres) * baseAcreCapacity + buildings.reduce((sum, building) => {
    const name = canonicalBuildingName(building.type.className);
    const capacity = name === 'Home' ? 40 : name === 'Dock' ? 25 : name === 'Wall' ? 10 : 20;
    return sum + building.num * (capacity - baseAcreCapacity);
  }, 0);
  return Math.floor(raw * raceMultiplier * (1 + sciencePercent / 100));
}

export function legacySpecialistHousing(
  category: string | null | undefined,
  buildings: HousingBuilding[],
): number | null {
  if (category !== 'thieves' && category !== 'wizards') return null;
  return buildings.reduce((sum, building) => {
    const name = canonicalBuildingName(building.type.className);
    if (name === 'Dock') return sum + building.num * 10;
    if (category === 'thieves' && name === 'Inn') return sum + building.num * 30;
    if (category === 'wizards' && name === 'Wizard Tower') return sum + building.num * 30;
    return sum;
  }, 0);
}

export function legacyActionBlockedByOverpopulation(
  peasants: number,
  totalMilitary: number,
  housing: number,
): boolean {
  return peasants < 1 || peasants + totalMilitary > housing * 1.1;
}
