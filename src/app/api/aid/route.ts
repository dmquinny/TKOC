import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { activeSpellPercent } from '@/lib/legacy-magic';
import { buildingEffect, canonicalBuildingName } from '@/lib/buildings';
import { legacyEffectMultiplier } from '@/lib/legacy-effects';
import { legacyRaceModifiers } from '@/lib/legacy-rules';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

const RESOURCES = ['gold', 'food', 'metal', 'peasants'] as const;
type Resource = typeof RESOURCES[number];

async function getMe(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  if (!user?.pID || user.pID === 0) return null;
  return prisma.province.findUnique({ where: { id: user.pID } });
}

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    if (!me.kiID) {
      return NextResponse.json({
        mates: [],
        inKingdom: false,
        gold: me.gold,
        food: me.food,
        metal: me.metal,
        peasants: me.peasants,
      }, { status: 200 });
    }

    const mates = await prisma.province.findMany({
      where: { kiID: me.kiID, id: { not: me.id }, status: 'Alive', acres: { gt: 0 }, vacation: false },
      select: { id: true, provinceName: true, rulerName: true },
      orderBy: { provinceName: 'asc' },
    });
    return NextResponse.json({
      mates,
      inKingdom: true,
      gold: me.gold,
      food: me.food,
      metal: me.metal,
      peasants: me.peasants,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/aid GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const body = await request.json();
    const { toPID } = body;
    const rid = Number(toPID);
    const requested = Object.fromEntries(RESOURCES.map(name => [
      name,
      Math.floor(Number(body.resources?.[name] ?? (body.resource === name ? body.amount : 0))),
    ])) as Record<Resource, number>;
    if (RESOURCES.some(name => !Number.isSafeInteger(requested[name]) || requested[name] < 0)) {
      return NextResponse.json({ error: 'Resource amounts must be whole positive numbers' }, { status: 400 });
    }
    if (!rid || rid === me.id) return NextResponse.json({ error: 'Choose a kingdom-mate' }, { status: 400 });
    if (!RESOURCES.some(name => requested[name] > 0)) return NextResponse.json({ error: 'Enter an amount' }, { status: 400 });
    const result = await withSerializableTransaction(async (tx) => {
      await lockProvinceRows(tx, [me.id, rid]);
      const [sender, recipient] = await Promise.all([
        tx.province.findUnique({
          where: { id: me.id },
          include: { effects: true, buildings: { include: { type: true } } },
        }),
        tx.province.findUnique({ where: { id: rid } }),
      ]);
      if (!sender || sender.status !== 'Alive' || (sender.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (sender.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
      if (!sender.kiID) throw new Error('You must be in a kingdom to send aid');
      if (!recipient || recipient.kiID !== sender.kiID || recipient.status !== 'Alive') {
        throw new Error('Recipient is not in your kingdom');
      }
      if (recipient.vacation || (recipient.protection ?? 0) > 0) {
        throw new Error('Aid cannot be sent to a protected or vacationing province');
      }
      if (RESOURCES.some(name => (sender[name] ?? 0) < requested[name])) throw new Error('Insufficient resources');

      const baseLossPercent = Math.floor(Math.random() * 11) + 10;
      const race = sender.raceId ? await tx.race.findUnique({ where: { id: sender.raceId }, select: { name: true } }) : null;
      const marketplaces = sender.buildings.reduce(
        (sum, entry) => sum + (canonicalBuildingName(entry.type.className) === 'Marketplace' ? entry.num : 0),
        0,
      );
      const buildingLossPercent = buildingEffect(marketplaces, sender.acres ?? 0, -2, 40) * 100;
      const lossModifier = legacyRaceModifiers(race?.name).caravanLoss
        * legacyEffectMultiplier(buildingLossPercent)
        * legacyEffectMultiplier(activeSpellPercent(sender.effects, 'aidLoss'));
      const received = Object.fromEntries(RESOURCES.map(name => {
        const lost = Math.min(requested[name], Math.floor(requested[name] * baseLossPercent / 100 * lossModifier));
        return [name, requested[name] - lost];
      })) as Record<Resource, number>;
      await tx.province.update({
        where: { id: sender.id },
        data: Object.fromEntries(RESOURCES.map(name => [name, { decrement: requested[name] }])),
      });
      await tx.province.update({
        where: { id: rid },
        data: Object.fromEntries(RESOURCES.map(name => [name, { increment: received[name] }])),
      });
      const manifest = RESOURCES.map(name => `${received[name].toLocaleString()} ${name}`).join(', ');
      await tx.news.create({
        data: {
          pID: rid,
          message: `A trade caravan from ${sender.provinceName} arrived with ${manifest}.`,
        },
      });
      return { provinceName: recipient.provinceName, received, requested };
    });

    return NextResponse.json({
      message: `A caravan was sent to ${result.provinceName}; ${RESOURCES.map(name => `${result.received[name].toLocaleString()} ${name}`).join(', ')} arrived.`,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (
      [
        'Recipient is not in your kingdom',
        'Insufficient resources',
        'Your province is not active',
        'You are on vacation and cannot act. End it in Preferences.',
        'You must be in a kingdom to send aid',
        'Aid cannot be sent to a protected or vacationing province',
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(request, '/api/aid POST', error);
  }
}
