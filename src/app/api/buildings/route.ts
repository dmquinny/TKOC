import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  canonicalBuildingName,
  effectiveBuildTicks,
  getBuildingRule,
  unmetBuildingRequirements,
} from '@/lib/buildings';
import { scienceKnowledge } from '@/lib/science';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

function buildingScienceLevels(
  sciences: Array<{ level: number; type: {
    name: string;
    className: string | null;
    givesMilitary: number;
    givesInfrastructure: number;
    givesMagic: number;
    givesThievery: number;
  } }>,
): Map<string, number> {
  const levels = new Map(sciences.map(item => [item.type.name, item.level]));
  const knowledge = scienceKnowledge(sciences);
  for (const bit of [1, 2, 4, 8, 16, 32, 64, 128]) {
    levels.set(`Military:${bit}`, knowledge.military & bit ? 1 : 0);
    levels.set(`Infrastructure:${bit}`, knowledge.infrastructure & bit ? 1 : 0);
    levels.set(`Magic:${bit}`, knowledge.magic & bit ? 1 : 0);
    levels.set(`Thievery:${bit}`, knowledge.thievery & bit ? 1 : 0);
  }
  return levels;
}

async function getProvinceId(request: NextRequest): Promise<number | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  return user?.pID || null;
}

export async function GET(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [types, buildings, orders, province, sciences, state] = await Promise.all([
      prisma.buildingType.findMany({ orderBy: { id: 'asc' } }),
      prisma.building.findMany({ where: { pID } }),
      prisma.buildOrder.findMany({ where: { pID }, orderBy: [{ bID: 'asc' }, { ticksLeft: 'asc' }] }),
      prisma.province.findUnique({
        where: { id: pID },
        select: { acres: true, gold: true, metal: true, vacation: true, raceId: true },
      }),
      prisma.science.findMany({ where: { pID }, include: { type: true } }),
      prisma.gameState.findUnique({ where: { id: 1 }, select: { season: true } }),
    ]);
    if (!province) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const race = province.raceId
      ? await prisma.race.findUnique({ where: { id: province.raceId }, select: { name: true } })
      : null;
    const raceName = race?.name ?? '';
    const scienceLevels = buildingScienceLevels(sciences);
    const season = state?.season ?? 'Spring';
    const hasArchitecture = sciences.some(science => science.type.className === 'ConstructionScience');
    const ownedByType = new Map(buildings.map(building => [building.bID, building.num]));
    const progressByType = new Map<number, number[]>();
    for (const order of orders) {
      const progress = progressByType.get(order.bID) ?? new Array<number>(25).fill(0);
      if (order.ticksLeft >= 0 && order.ticksLeft <= 24) progress[order.ticksLeft] += order.num;
      progressByType.set(order.bID, progress);
    }

    const availableTypes = types.flatMap(type => {
      const rule = getBuildingRule(type.className);
      if (!rule) return [];
      const unmet = unmetBuildingRequirements(rule, raceName, scienceLevels);
      const progress = progressByType.get(type.id) ?? new Array<number>(25).fill(0);
      return [{
        id: type.id,
        className: canonicalBuildingName(type.className),
        costGold: rule.costGold,
        costMetal: rule.costMetal,
        buildTicks: effectiveBuildTicks(rule.buildTicks, raceName, season, hasArchitecture),
        baseBuildTicks: rule.buildTicks,
        description: rule.description,
        image: rule.image,
        owned: ownedByType.get(type.id) ?? 0,
        inProgress: progress.reduce((sum, amount) => sum + amount, 0),
        progress,
        canBuild: unmet.length === 0,
        unmet,
      }];
    });

    const landUsed = buildings.reduce((sum, building) => sum + building.num, 0)
      + orders.reduce((sum, order) => sum + order.num, 0);

    return NextResponse.json({
      types: availableTypes,
      acres: province.acres ?? 0,
      landUsed,
      gold: province.gold ?? 0,
      metal: province.metal ?? 0,
      race: raceName,
      season,
      vacation: province.vacation,
      maxProgressTicks: 24,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/buildings GET', error);
  }
}

interface RequestedOrder {
  bID: number;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const body = await request.json();
    const action = body.action === 'destroy' ? 'destroy' : 'build';

    if (action === 'destroy') {
      const bID = Number(body.bID);
      const quantity = Number(body.quantity);
      if (!Number.isSafeInteger(bID) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
        return NextResponse.json({ error: 'Enter a whole number of buildings to destroy' }, { status: 400 });
      }

      const result = await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [pID]);
        const province = await tx.province.findUnique({
          where: { id: pID },
          select: { vacation: true, status: true, acres: true },
        });
        if (!province) throw new Error('No province found');
        if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) throw new Error('Your province is not active');
        if (province.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
        const type = await tx.buildingType.findUnique({ where: { id: bID } });
        if (!type || !getBuildingRule(type.className)) throw new Error('Invalid building type');

        let remaining = quantity;
        let destroyed = 0;
        const pending = await tx.buildOrder.findMany({
          where: { pID, bID },
          orderBy: { ticksLeft: 'desc' },
        });
        for (const order of pending) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, order.num);
          if (take === order.num) {
            await tx.buildOrder.delete({ where: { id: order.id } });
          } else {
            await tx.buildOrder.update({ where: { id: order.id }, data: { num: { decrement: take } } });
          }
          remaining -= take;
          destroyed += take;
        }

        if (remaining > 0) {
          const built = await tx.building.findUnique({ where: { pID_bID: { pID, bID } } });
          const take = Math.min(remaining, built?.num ?? 0);
          if (built && take > 0) {
            await tx.building.update({ where: { id: built.id }, data: { num: { decrement: take } } });
            destroyed += take;
          }
        }
        if (destroyed === 0) throw new Error(`You do not have any ${canonicalBuildingName(type.className)} buildings to destroy`);
        return { destroyed, name: canonicalBuildingName(type.className) };
      });

      return NextResponse.json({
        message: `Destroyed ${result.destroyed.toLocaleString()} ${result.name}${result.destroyed === 1 ? '' : ' buildings'}. Buildings still in progress were removed first.`,
      }, { status: 200 });
    }

    const rawOrders: RequestedOrder[] = Array.isArray(body.orders)
      ? body.orders
      : [{ bID: body.bID, quantity: body.quantity }];
    const requested = rawOrders
      .map(order => ({ bID: Number(order.bID), quantity: Number(order.quantity) }))
      .filter(order => order.quantity !== 0);
    if (
      requested.length === 0
      || requested.length > 50
      || requested.some(order => !Number.isSafeInteger(order.bID)
        || !Number.isSafeInteger(order.quantity)
        || order.quantity < 0
        || order.quantity > 1_000_000)
    ) {
      return NextResponse.json({ error: 'Enter whole, positive building quantities' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [pID]);
      const [province, types, built, pending, sciences, state] = await Promise.all([
        tx.province.findUnique({
          where: { id: pID },
          select: { acres: true, gold: true, metal: true, vacation: true, raceId: true, status: true },
        }),
        tx.buildingType.findMany(),
        tx.building.findMany({ where: { pID } }),
        tx.buildOrder.findMany({ where: { pID } }),
        tx.science.findMany({ where: { pID }, include: { type: true } }),
        tx.gameState.findUnique({ where: { id: 1 }, select: { season: true } }),
      ]);
      if (!province) throw new Error('No province found');
      if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (province.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');

      const race = province.raceId
        ? await tx.race.findUnique({ where: { id: province.raceId }, select: { name: true } })
        : null;
      const raceName = race?.name ?? '';
      const scienceLevels = buildingScienceLevels(sciences);
      const hasArchitecture = sciences.some(science => science.type.className === 'ConstructionScience');
      const season = state?.season ?? 'Spring';
      const typeById = new Map(types.map(type => [type.id, type]));
      let freeLand = (province.acres ?? 0)
        - built.reduce((sum, building) => sum + building.num, 0)
        - pending.reduce((sum, order) => sum + order.num, 0);
      let gold = province.gold ?? 0;
      let metal = province.metal ?? 0;
      let totalGold = 0;
      let totalMetal = 0;
      const accepted: { bID: number; quantity: number; ticks: number; name: string }[] = [];
      const errors: string[] = [];

      const quantities = new Map<number, number>();
      for (const order of requested) quantities.set(order.bID, (quantities.get(order.bID) ?? 0) + order.quantity);

      for (const [bID, quantity] of quantities) {
        const type = typeById.get(bID);
        const rule = getBuildingRule(type?.className);
        const name = canonicalBuildingName(type?.className);
        if (!type || !rule) {
          errors.push('An invalid building type was ignored.');
          continue;
        }
        const unmet = unmetBuildingRequirements(rule, raceName, scienceLevels);
        if (unmet.length) {
          errors.push(`${name}: ${unmet.join('; ')}`);
          continue;
        }
        const goldCost = rule.costGold * quantity;
        const metalCost = rule.costMetal * quantity;
        if (quantity > freeLand) {
          errors.push(`${name}: not enough free acres`);
          continue;
        }
        if (goldCost > gold) {
          errors.push(`${name}: not enough gold`);
          continue;
        }
        if (metalCost > metal) {
          errors.push(`${name}: not enough metal`);
          continue;
        }

        const ticks = effectiveBuildTicks(rule.buildTicks, raceName, season, hasArchitecture);
        accepted.push({ bID, quantity, ticks, name });
        freeLand -= quantity;
        gold -= goldCost;
        metal -= metalCost;
        totalGold += goldCost;
        totalMetal += metalCost;
      }

      if (accepted.length === 0) return { accepted, errors, totalGold: 0, totalMetal: 0 };
      const paid = await tx.province.updateMany({
        where: { id: pID, gold: { gte: totalGold }, metal: { gte: totalMetal } },
        data: { gold: { decrement: totalGold }, metal: { decrement: totalMetal } },
      });
      if (paid.count !== 1) throw new Error('Your resources changed; review the order and try again');

      for (const order of accepted) {
        const existing = await tx.buildOrder.findFirst({
          where: { pID, bID: order.bID, ticksLeft: order.ticks },
        });
        if (existing) {
          await tx.buildOrder.update({
            where: { id: existing.id },
            data: { num: { increment: order.quantity } },
          });
        } else {
          await tx.buildOrder.create({
            data: { pID, bID: order.bID, num: order.quantity, ticksLeft: order.ticks },
          });
        }
      }
      return { accepted, errors, totalGold, totalMetal };
    });

    if (result.accepted.length === 0) {
      return NextResponse.json({ error: result.errors.join(' ') || 'No buildings were ordered' }, { status: 400 });
    }
    return NextResponse.json({
      message: result.accepted
        .map(order => `${order.quantity.toLocaleString()} ${order.name}${order.quantity === 1 ? '' : ' buildings'} (${order.ticks} ticks)`)
        .join(', '),
      warnings: result.errors,
      costGold: result.totalGold,
      costMetal: result.totalMetal,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const expected = [
      'No province found',
      'You are on vacation and cannot act. End it in Preferences.',
      'Invalid building type',
      'Your resources changed; review the order and try again',
      'Your province is not active',
    ];
    if (expected.includes(message) || message.startsWith('You do not have any ')) {
      const status = message === 'No province found'
        ? 404
        : message.startsWith('You are on vacation')
          ? 403
          : 400;
      return NextResponse.json({ error: message }, { status });
    }
    return internalErrorResponse(request, '/api/buildings POST', error);
  }
}
