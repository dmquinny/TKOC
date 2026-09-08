/**
 * Rank movement helpers. The tick engine records each province's networth
 * rank every tick and a daily reference rank every 24 ticks; the difference
 * is the movement shown in the rankings.
 */
export function rankMovement(current: number, reference: number): number | null {
  if (!current || !reference) return null;
  return reference - current;
}

export function describeMovement(movement: number | null): string {
  if (movement === null) return 'New';
  if (movement === 0) return 'Steady';
  return movement > 0 ? `Up ${movement}` : `Down ${Math.abs(movement)}`;
}

export interface KingdomStanding {
  id: number;
  name: string;
  provinces: number;
  networth: number;
  acres: number;
}

export function rankKingdoms(
  provinces: Array<{ kiID: number; networth: number | null; acres: number | null }>,
  names: Map<number, string>,
): KingdomStanding[] {
  const totals = new Map<number, KingdomStanding>();
  for (const province of provinces) {
    if (!province.kiID) continue;
    const current = totals.get(province.kiID) ?? {
      id: province.kiID,
      name: names.get(province.kiID) ?? `Kingdom ${province.kiID}`,
      provinces: 0,
      networth: 0,
      acres: 0,
    };
    current.provinces += 1;
    current.networth += province.networth ?? 0;
    current.acres += province.acres ?? 0;
    totals.set(province.kiID, current);
  }
  return [...totals.values()].sort((a, b) => b.networth - a.networth || b.acres - a.acres);
}
