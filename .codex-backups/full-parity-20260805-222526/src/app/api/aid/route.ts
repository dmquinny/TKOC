import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { activeSpellPercent } from '@/lib/legacy-magic';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

const RESOURCES = ['gold', 'food', 'metal', 'peasants'] as const;
type Resource = typeof RESOURCES[number];
const AID_CAP_PER_TICK = 100000; // total resource units you can send out per tick

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
    const { toPID, resource, amount } = await request.json();
    const rid = Number(toPID);
    const amt = Math.floor(Number(amount));
    if (!RESOURCES.includes(resource as Resource)) return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    const resourceName = resource as Resource;
    if (!rid || rid === me.id) return NextResponse.json({ error: 'Choose a kingdom-mate' }, { status: 400 });
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Enter an amount' }, { status: 400 });
    const result = await withSerializableTransaction(async (tx) => {
      await lockProvinceRows(tx, [me.id, rid]);
      const [sender, recipient] = await Promise.all([
        tx.province.findUnique({ where: { id: me.id }, include: { effects: true } }),
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
      if (sender.aidSentTick + amt > AID_CAP_PER_TICK) {
        throw new Error(`You can only send ${AID_CAP_PER_TICK.toLocaleString()} in aid per tick (${sender.aidSentTick.toLocaleString()} already sent).`);
      }
      const have = sender[resourceName] ?? 0;
      if (have < amt) throw new Error('Insufficient resources');

      const baseLossPercent = Math.floor(Math.random() * 11) + 10;
      const lossModifier = Math.max(0, 1 + activeSpellPercent(sender.effects, 'aidLoss') / 100);
      const lost = Math.min(amt, Math.floor(amt * baseLossPercent / 100 * lossModifier));
      const received = amt - lost;
      await tx.province.update({
        where: { id: sender.id },
        data: { [resourceName]: { decrement: amt }, aidSentTick: { increment: amt } },
      });
      if (received) {
        await tx.province.update({ where: { id: rid }, data: { [resourceName]: { increment: received } } });
      }
      await tx.news.create({
        data: {
          pID: rid,
          message: `${sender.provinceName} sent ${amt.toLocaleString()} ${resourceName}; ${received.toLocaleString()} arrived after caravan losses.`,
        },
      });
      return { provinceName: recipient.provinceName, received, lost };
    });

    return NextResponse.json({
      message: `Sent ${amt.toLocaleString()} ${resourceName} to ${result.provinceName}; ${result.received.toLocaleString()} arrived${result.lost ? ` and ${result.lost.toLocaleString()} was lost en route` : ''}.`,
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
      || message.startsWith('You can only send ')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(request, '/api/aid POST', error);
  }
}
