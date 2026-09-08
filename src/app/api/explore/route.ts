import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  distributeExploredLand,
  EXPLORE_TICKS,
  getExploredLand,
  getExploreRates,
} from '@/lib/explore';
import { legacyRaceModifiers } from '@/lib/legacy-rules';
import { militaryName } from '@/lib/military';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

async function getProvince(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  if (!user?.pID) return null;
  return prisma.province.findUnique({ where: { id: user.pID } });
}

export async function GET(request: NextRequest) {
  try {
    if (!(await getUserIdFromRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const province = await getProvince(request);
    if (!province) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const race = province.raceId
      ? await prisma.race.findUnique({ where: { id: province.raceId } })
      : null;
    const [orders, soldierType, training] = await Promise.all([
      prisma.exploreOrder.findMany({ where: { pID: province.id } }),
      prisma.militaryType.findFirst({
        where: { raceName: race?.name, category: 'soldiers' },
      }),
      prisma.militaryOrder.findMany({ where: { pID: province.id } }),
    ]);
    const soldierUnit = soldierType
      ? await prisma.militaryUnit.findUnique({
          where: { pID_mID: { pID: province.id, mID: soldierType.id } },
        })
      : null;

    const incoming = orders.reduce((sum, order) => sum + order.acres, 0);
    const raceMods = legacyRaceModifiers(race?.name);
    const costModifierPercent = (1 - raceMods.exploreGoldCost) * 100;
    const rates = getExploreRates(province.acres ?? 0, incoming, costModifierPercent);
    const soldiersTraining = training
      .filter(order => order.mID === soldierType?.id)
      .reduce((sum, order) => sum + order.num, 0);
    const progress = new Array<number>(EXPLORE_TICKS).fill(0);
    for (const order of orders) {
      if (order.ticksLeft >= 1 && order.ticksLeft <= EXPLORE_TICKS) {
        progress[order.ticksLeft - 1] += order.acres;
      }
    }

    return NextResponse.json({
      acres: province.acres ?? 0,
      gold: province.gold ?? 0,
      soldierName: soldierType ? militaryName(soldierType) : 'Recruits',
      soldiers: Math.max(0, (soldierUnit?.num ?? 0) - soldiersTraining),
      ...rates,
      ticks: EXPLORE_TICKS,
      incoming,
      progress,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/explore GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const { soldiers } = await request.json();
    const want = Number(soldiers);
    if (!Number.isSafeInteger(want) || want <= 0 || want > 1_000_000) {
      return NextResponse.json({ error: 'Enter how many soldiers to send' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      // Serialize expeditions for this province. Without the row lock, several
      // concurrent requests could all read the same incoming-land total and
      // lock in the same cheaper rate before any of their orders were visible.
      await lockProvinceRows(tx, [user.pID!]);

      const province = await tx.province.findUnique({ where: { id: user.pID } });
      if (!province) throw new Error('No province found');
      if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) {
        throw new Error('Your province is not active');
      }
      if (province.vacation) {
        throw new Error('You are on vacation and cannot act. End it in Preferences.');
      }

      const race = province.raceId
        ? await tx.race.findUnique({ where: { id: province.raceId } })
        : null;
      const [orders, soldierType] = await Promise.all([
        tx.exploreOrder.findMany({ where: { pID: province.id } }),
        tx.militaryType.findFirst({
          where: { raceName: race?.name, category: 'soldiers' },
        }),
      ]);
      if (!soldierType) throw new Error('Exploration soldiers are not configured');

      const soldierUnit = await tx.militaryUnit.findUnique({
        where: { pID_mID: { pID: province.id, mID: soldierType.id } },
      });
      const soldiersTraining = await tx.militaryOrder.aggregate({
        where: { pID: province.id, mID: soldierType.id },
        _sum: { num: true },
      });
      const availableSoldiers = Math.max(0, soldierUnit?.num ?? 0)
        - (soldiersTraining._sum.num ?? 0);
      if (!soldierUnit || availableSoldiers < want) {
        throw new Error(`You do not have enough ${militaryName(soldierType)}`);
      }

      const incoming = orders.reduce((sum, order) => sum + order.acres, 0);
      const raceMods = legacyRaceModifiers(race?.name);
      const costModifierPercent = (1 - raceMods.exploreGoldCost) * 100;
      const rates = getExploreRates(province.acres ?? 0, incoming, costModifierPercent);
      const cost = want * rates.costPerSoldier;
      if ((province.gold ?? 0) < cost) throw new Error('You do not have enough gold');

      const [paid, removed] = await Promise.all([
        tx.province.updateMany({
          where: { id: province.id, gold: { gte: cost } },
          data: { gold: { decrement: cost } },
        }),
        tx.militaryUnit.updateMany({
          where: { id: soldierUnit.id, num: { gte: want } },
          data: { num: { decrement: want } },
        }),
      ]);
      if (paid.count !== 1) throw new Error('You do not have enough gold');
      if (removed.count !== 1) throw new Error(`You do not have enough ${militaryName(soldierType)}`);

      const exploredAcres = getExploredLand(want, province.acres ?? 0, rates.landPerSoldier);
      const distribution = distributeExploredLand(exploredAcres);
      for (const [ticksLeft, acres] of distribution) {
        await tx.exploreOrder.create({ data: { pID: province.id, acres, ticksLeft } });
      }

      return {
        cost,
        exploredAcres,
        soldierName: militaryName(soldierType),
        exceededAdvice: want > rates.recommendedSoldiers,
      };
    });

    return NextResponse.json({
      message: `${want.toLocaleString()} ${result.soldierName} sent to explore. About ${result.exploredAcres.toLocaleString()} acres will arrive over the next ${EXPLORE_TICKS} ticks.`,
      warning: result.exceededAdvice
        ? 'You sent more soldiers than the expedition could use, so some were lost without finding additional land.'
        : null,
      cost: result.cost,
      exploredAcres: result.exploredAcres,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const expectedErrors = [
      'No province found',
      'You are on vacation and cannot act. End it in Preferences.',
      'Exploration soldiers are not configured',
      'You do not have enough gold',
      'Your province is not active',
    ];
    if (expectedErrors.includes(message) || message.startsWith('You do not have enough ')) {
      const status = message === 'No province found'
        ? 404
        : message.startsWith('You are on vacation')
          ? 403
          : 400;
      return NextResponse.json({ error: message }, { status });
    }
    return internalErrorResponse(request, '/api/explore POST', error);
  }
}
