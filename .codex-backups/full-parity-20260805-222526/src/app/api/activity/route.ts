import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { militaryName } from '@/lib/military';
import { internalErrorResponse } from '@/lib/operational-events';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [province, buildingTypes, militaryTypes, scienceTypes] = await Promise.all([
      prisma.province.findUnique({
        where: { id: user.pID },
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
      prisma.buildingType.findMany({ select: { id: true, className: true } }),
      prisma.militaryType.findMany({
        select: { id: true, displayName: true, className: true },
      }),
      prisma.scienceType.findMany({ select: { id: true, name: true } }),
    ]);
    if (!province) return NextResponse.json({ error: 'No province found' }, { status: 404 });
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

    return NextResponse.json({
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
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Activity GET error:', error);
    return internalErrorResponse(request, '/api/activity', error);
  }
}
