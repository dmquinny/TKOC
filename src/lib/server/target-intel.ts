import type { PrismaClientLike } from '@/lib/transactions';
import { expectedLandGain } from '@/lib/combat';
import type { TargetIntel, TargetRelation } from '@/lib/targets';

export type TargetMode = 'attack' | 'magic' | 'thievery';

export interface TargetViewer {
  id: number;
  kiID: number;
  networth: number | null;
  acres: number | null;
}

/**
 * Enriched province list for the target pickers. Attack mode hides provinces
 * that can never be attacked; magic includes the caster's own province so
 * self-targeted spells work; thievery lists every other living province.
 */
export async function listTargets(
  db: PrismaClientLike,
  viewer: TargetViewer,
  mode: TargetMode,
): Promise<TargetIntel[]> {
  const base = { status: 'Alive', acres: { gt: 0 } } as const;
  const where = mode === 'attack'
    ? { ...base, id: { not: viewer.id }, vacation: false, protection: { lte: 0 } }
    : mode === 'thievery'
      ? { ...base, id: { not: viewer.id } }
      : base;

  const [provinces, races, kingdoms, relations] = await Promise.all([
    db.province.findMany({
      where,
      select: {
        id: true,
        provinceName: true,
        rulerName: true,
        networth: true,
        acres: true,
        kiID: true,
        raceId: true,
        protection: true,
        vacation: true,
        attackPressure: true,
      },
      orderBy: { networth: 'desc' },
    }),
    db.race.findMany({ select: { id: true, name: true } }),
    db.kingdom.findMany({ select: { id: true, name: true } }),
    viewer.kiID
      ? db.kingdomRelation.findMany({
          where: { status: 'active', OR: [{ fromKiId: viewer.kiID }, { toKiId: viewer.kiID }] },
          select: { fromKiId: true, toKiId: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  const raceName = new Map(races.map(race => [race.id, race.name]));
  const kingdomName = new Map(kingdoms.map(kingdom => [kingdom.id, kingdom.name ?? `Kingdom ${kingdom.id}`]));
  const allies = new Set<number>();
  const wars = new Set<number>();
  for (const relation of relations) {
    const other = relation.fromKiId === viewer.kiID ? relation.toKiId : relation.fromKiId;
    if (relation.type === 'ally') allies.add(other);
    if (relation.type === 'war') wars.add(other);
  }
  const myNetworth = Math.max(1, viewer.networth ?? 0);
  const myAcres = Math.max(1, viewer.acres ?? 0);

  return provinces.map(province => {
    const relation: TargetRelation = province.id === viewer.id
      ? 'self'
      : viewer.kiID && province.kiID === viewer.kiID
        ? 'kingdom'
        : allies.has(province.kiID)
          ? 'ally'
          : wars.has(province.kiID)
            ? 'war'
            : 'neutral';
    const acres = province.acres ?? 0;
    const land = expectedLandGain(myAcres, acres);
    return {
      id: province.id,
      provinceName: province.provinceName ?? 'Unnamed province',
      rulerName: province.rulerName ?? 'Unknown ruler',
      race: raceName.get(province.raceId ?? 0) ?? 'Unknown',
      kiID: province.kiID,
      kingdomName: province.kiID ? kingdomName.get(province.kiID) ?? `Kingdom ${province.kiID}` : 'Independent',
      networth: province.networth ?? 0,
      acres,
      relation,
      networthRatio: Math.round(((province.networth ?? 0) / myNetworth) * 100) / 100,
      landRatio: Math.round((acres / myAcres) * 100) / 100,
      expectedLandPercent: land.percent,
      expectedAcresGained: land.gained,
      protection: (province.protection ?? 0) > 0,
      vacation: province.vacation,
      attackPressure: province.attackPressure,
    };
  });
}
