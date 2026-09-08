import type { PrismaClientLike } from '@/lib/transactions';
import { militaryName } from '@/lib/military';

export type ActivityData = {
  protectionTicks: number;
  vacation: boolean;
  vacationTicks: number;
  research: Array<{ id: number; name: string; ticksLeft: number }>;
  construction: Array<{ name: string; quantity: number; ticksLeft: number }>;
  training: Array<{ name: string; quantity: number; ticksLeft: number }>;
  exploration: Array<{ id: number; acres: number; ticksLeft: number }>;
  armies: Array<{ id: number; target: string; ticksLeft: number; phase: string }>;
  effects: Array<{ id: number; name: string; ticksLeft: number }>;
};

/** Everything currently queued or in flight for a province. */
export async function loadActivity(db: PrismaClientLike, pID: number): Promise<ActivityData | null> {
  const [province, buildingTypes, militaryTypes, scienceTypes] = await Promise.all([
    db.province.findUnique({
      where: { id: pID },
      select: {
        protection: true,
        vacation: true,
        vacationTicks: true,
        researchOrders: { orderBy: { ticksLeft: 'asc' } },
        buildOrders: { orderBy: { ticksLeft: 'asc' } },
        militaryOrders: { orderBy: { ticksLeft: 'asc' } },
        exploreOrders: { orderBy: { ticksLeft: 'asc' } },
        outgoingAttacks: {
          include: { defender: { select: { provinceName: true } } },
          orderBy: { id: 'asc' },
        },
        effects: { orderBy: { ticksLeft: 'asc' } },
      },
    }),
    db.buildingType.findMany({ select: { id: true, className: true } }),
    db.militaryType.findMany({ select: { id: true, displayName: true, className: true } }),
    db.scienceType.findMany({ select: { id: true, name: true } }),
  ]);
  if (!province) return null;

  const buildingTypeById = new Map(buildingTypes.map(type => [type.id, type]));
  const militaryTypeById = new Map(militaryTypes.map(type => [type.id, type]));
  const scienceTypeById = new Map(scienceTypes.map(type => [type.id, type]));

  const construction = new Map<string, { name: string; quantity: number; ticksLeft: number }>();
  for (const order of province.buildOrders) {
    const name = buildingTypeById.get(order.bID)?.className?.replace(/Building$/, '') ?? 'Building';
    const current = construction.get(name) ?? { name, quantity: 0, ticksLeft: 0 };
    current.quantity += order.num;
    current.ticksLeft = Math.max(current.ticksLeft, order.ticksLeft);
    construction.set(name, current);
  }
  const training = new Map<string, { name: string; quantity: number; ticksLeft: number }>();
  for (const order of province.militaryOrders) {
    const name = militaryName(militaryTypeById.get(order.mID) ?? {});
    const current = training.get(name) ?? { name, quantity: 0, ticksLeft: 0 };
    current.quantity += order.num;
    current.ticksLeft = Math.max(current.ticksLeft, order.ticksLeft);
    training.set(name, current);
  }

  return {
    protectionTicks: Math.max(0, province.protection ?? 0),
    vacation: province.vacation,
    vacationTicks: province.vacationTicks,
    research: province.researchOrders.map(order => ({
      id: order.id,
      name: scienceTypeById.get(order.scID)?.name ?? `Unknown science #${order.scID}`,
      ticksLeft: order.ticksLeft,
    })),
    construction: [...construction.values()],
    training: [...training.values()],
    exploration: province.exploreOrders.map(order => ({
      id: order.id,
      acres: order.acres,
      ticksLeft: order.ticksLeft,
    })),
    armies: province.outgoingAttacks.map(attack => ({
      id: attack.id,
      target: attack.defender.provinceName ?? 'Unknown province',
      ticksLeft: Math.max(attack.totick, attack.backtick),
      phase: attack.totick > 0 ? 'marching' : 'returning',
    })),
    effects: province.effects.map(effect => ({
      id: effect.id,
      name: effect.type.replace(/Spell$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
      ticksLeft: effect.ticksLeft,
    })),
  };
}
