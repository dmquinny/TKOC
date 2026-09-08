import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { distributeAcrossTicks } from '@/lib/trickle';
import { buildingEffect } from '@/lib/buildings';
import { legacySpecialistHousing } from '@/lib/legacy-housing';
import { LEGACY_SEASON_MODIFIERS, legacySeasonForTick } from '@/lib/legacy-rules';
import { militaryName } from '@/lib/military';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const province = await prisma.province.findUnique({ where: { id: user.pID } });
    const race = province?.raceId
      ? await prisma.race.findUnique({ where: { id: province.raceId } })
      : null;
    const [types, units, orders] = await Promise.all([
      prisma.militaryType.findMany({
        where: race ? { raceName: race.name } : { raceName: { not: null } },
        orderBy: { id: 'asc' },
      }),
      prisma.militaryUnit.findMany({ where: { pID: user.pID } }),
      prisma.militaryOrder.findMany({ where: { pID: user.pID } }),
    ]);

    const nameById = new Map(types.map(type => [type.id, militaryName(type)]));
    const aggregate = new Map<number, { num: number; ticksLeft: number }>();
    for (const order of orders) {
      const current = aggregate.get(order.mID) ?? { num: 0, ticksLeft: 0 };
      current.num += order.num;
      current.ticksLeft = Math.max(current.ticksLeft, order.ticksLeft);
      aggregate.set(order.mID, current);
    }
    const training = [...aggregate.entries()].map(([mID, value]) => ({
      mID,
      name: nameById.get(mID) ?? 'Unit',
      ...value,
    }));
    const readyUnits = units.map(unit => ({
      ...unit,
      num: Math.max(0, unit.num - (aggregate.get(unit.mID)?.num ?? 0)),
    }));

    return NextResponse.json({
      types,
      units: readyUnits,
      peasants: province?.peasants ?? 0,
      training,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/military GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const body = await request.json();
    const mID = Number(body.mID);
    const quantity = Number(body.quantity);
    if (!Number.isSafeInteger(mID) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
      return NextResponse.json({ error: 'Invalid military request' }, { status: 400 });
    }

    const militaryType = await prisma.militaryType.findUnique({ where: { id: mID } });
    if (!militaryType) return NextResponse.json({ error: 'Invalid military type' }, { status: 404 });
    if (militaryType.trainTicks <= 0) {
      return NextResponse.json({ error: 'That unit cannot be trained' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [user.pID!]);
      const province = await tx.province.findUnique({
        where: { id: user.pID! },
        include: {
          science: { include: { type: true } },
          buildings: { include: { type: true } },
          military: { include: { type: true } },
        },
      });
      if (!province) throw new Error('Insufficient resources or peasants');
      if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (province.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
      const race = province.raceId
        ? await tx.race.findUnique({ where: { id: province.raceId } })
        : null;
      if (!race || militaryType.raceName !== race.name) {
        throw new Error('That unit is not available to your race');
      }
      const specialistCapacity = legacySpecialistHousing(militaryType.category, province.buildings);
      if (specialistCapacity != null) {
        const current = province.military
          .filter(unit => unit.type.category === militaryType.category)
          .reduce((sum, unit) => sum + unit.num, 0);
        if (current + quantity > specialistCapacity) {
          throw new Error(`Not enough ${militaryType.category === 'thieves' ? 'Inn' : 'Wizard Tower'} housing`);
        }
      }

      const [barrack, state] = await Promise.all([
        tx.building.findFirst({
          where: { pID: user.pID!, type: { className: 'Barrack' } },
        }),
        tx.gameState.findUnique({ where: { id: 1 } }),
      ]);
      const goldReduction = Math.min(
        0.5,
        buildingEffect(barrack?.num ?? 0, province.acres ?? 0, 2, 25),
      );
      const season = legacySeasonForTick(state?.tick ?? 1);
      const seasonMods = LEGACY_SEASON_MODIFIERS[season];
      const perUnitGold = Math.floor(militaryType.costGold * (1 - goldReduction) * seasonMods.militaryGoldCost);
      const tradeModifier = 1 + province.science.reduce(
        (sum, science) => sum + (science.type.effect === 'tradeCosts'
          ? science.level * science.type.bonusPerLevel / 100
          : 0),
        0,
      );
      const perUnitMetal = Math.floor(militaryType.costMetal * seasonMods.militaryMetalCost * tradeModifier);
      const perUnitFood = Math.floor(militaryType.costFood * seasonMods.militaryFoodCost);
      const totalGoldCost = perUnitGold * quantity;
      const totalMetalCost = perUnitMetal * quantity;
      const totalFoodCost = perUnitFood * quantity;

      const baseSoldier = await tx.militaryType.findFirst({
        where: { raceName: race.name, category: 'soldiers' },
      });
      const sourceUnit = militaryType.category === 'soldiers'
        ? null
        : baseSoldier
          ? await tx.militaryUnit.findUnique({
              where: { pID_mID: { pID: user.pID!, mID: baseSoldier.id } },
            })
          : null;
      const sourceName = militaryType.category === 'soldiers'
        ? 'peasants'
        : militaryName(baseSoldier ?? {});
      if (
        (province.gold ?? 0) < totalGoldCost
        || (province.metal ?? 0) < totalMetalCost
        || (province.food ?? 0) < totalFoodCost
        || (militaryType.category === 'soldiers'
          ? (province.peasants ?? 0) < quantity
          : (sourceUnit?.num ?? 0) < quantity)
      ) {
        throw new Error(`Insufficient resources or ${sourceName}`);
      }

      await tx.province.update({
        where: { id: user.pID! },
        data: {
          gold: { decrement: totalGoldCost },
          metal: { decrement: totalMetalCost },
          food: { decrement: totalFoodCost },
          ...(militaryType.category === 'soldiers'
            ? { peasants: { decrement: quantity } }
            : {}),
        },
      });
      if (sourceUnit) {
        await tx.militaryUnit.update({
          where: { id: sourceUnit.id },
          data: { num: { decrement: quantity } },
        });
      }

      // Legacy Military.num includes trainees immediately. ProgressMil makes
      // them unavailable at home until each training bucket reaches zero.
      await tx.militaryUnit.upsert({
        where: { pID_mID: { pID: user.pID!, mID } },
        update: { num: { increment: quantity } },
        create: { pID: user.pID!, mID, num: quantity },
      });
      for (const [ticksLeft, num] of distributeAcrossTicks(quantity, militaryType.trainTicks)) {
        const existing = await tx.militaryOrder.findFirst({
          where: { pID: user.pID!, mID, ticksLeft },
        });
        if (existing) {
          await tx.militaryOrder.update({
            where: { id: existing.id },
            data: { num: { increment: num } },
          });
        } else {
          await tx.militaryOrder.create({ data: { pID: user.pID!, mID, num, ticksLeft } });
        }
      }

      return { totalGoldCost, totalMetalCost, totalFoodCost };
    });

    return NextResponse.json({
      message: `${quantity} ${militaryName(militaryType)} sent to training.`,
      goldCost: result.totalGoldCost,
      metalCost: result.totalMetalCost,
      foodCost: result.totalFoodCost,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.startsWith('Insufficient resources or ')
      || message === 'That unit cannot be trained'
      || message === 'That unit is not available to your race'
      || message.startsWith('Not enough Inn housing')
      || message.startsWith('Not enough Wizard Tower housing')
      || message === 'Your province is not active'
      || message === 'You are on vacation and cannot act. End it in Preferences.'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(request, '/api/military POST', error);
  }
}
