import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { buildingEffect, canonicalBuildingName } from '@/lib/buildings';
import { legacyRaceModifiers } from '@/lib/legacy-rules';
import {
  ORIGINAL_SCIENCES,
  requirementsMet,
  scienceImageForClass,
  scienceKnowledge,
  scienceRequirementDetails,
  scienceUnlockNames,
} from '@/lib/science';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

async function getProvinceId(request: NextRequest): Promise<number | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  return user?.pID && user.pID !== 0 ? user.pID : null;
}

export async function GET(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const province = await prisma.province.findUnique({
      where: { id: pID },
      include: { science: { include: { type: true } } },
    });
    if (!province) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const race = province.raceId
      ? await prisma.race.findUnique({ where: { id: province.raceId } })
      : null;
    const [types, orders] = await Promise.all([
      prisma.scienceType.findMany({
        orderBy: [{ category: 'asc' }, { id: 'asc' }],
      }),
      prisma.researchOrder.findMany({ where: { pID }, orderBy: { id: 'asc' } }),
    ]);

    const visibleRules = ORIGINAL_SCIENCES.filter(rule => (
      !rule.hidden
      && (!rule.races || rule.races.includes(race?.name ?? ''))
    ));
    const rules = new Map(visibleRules.map(item => [item.className, item]));
    const completedIds = new Set(province.science.map(item => item.scID));
    const progressByType = new Map(orders.map(order => [order.scID, order.ticksLeft]));
    const typeById = new Map(types.map(type => [type.id, type]));
    const knowledge = scienceKnowledge(province.science);
    const sciences = types
      .filter(type => {
        return rules.has(type.className ?? '');
      })
      .map(type => {
        const rule = rules.get(type.className ?? '')!;
        return {
          scID: type.id,
          name: type.name,
          image: scienceImageForClass(type.className ?? ''),
          category: type.category,
          effect: type.effect,
          description: type.description,
          level: completedIds.has(type.id) ? 1 : 0,
          maxLevel: 1,
          costGold: type.costGold,
          costMetal: type.costMetal,
          researchTicks: type.researchTicks,
          researching: progressByType.get(type.id) ?? null,
          available:
            !completedIds.has(type.id)
            && !progressByType.has(type.id)
            && requirementsMet(type, knowledge),
          prerequisites: scienceRequirementDetails(rule, visibleRules, knowledge),
          unlocks: scienceUnlockNames(rule, visibleRules),
        };
      });

    // Keep active orders independent of the playable-catalog filter. Older
    // orders or race/catalog changes must never make ongoing research invisible
    // while the POST endpoint still correctly blocks a second order.
    const activeResearch = orders.map(order => {
      const type = typeById.get(order.scID);
      return {
        orderId: order.id,
        scID: order.scID,
        name: type?.name ?? `Unknown science #${order.scID}`,
        image: scienceImageForClass(type?.className ?? ''),
        ticksLeft: order.ticksLeft,
        visibleInCatalog: Boolean(type?.className && rules.has(type.className)),
      };
    });

    return NextResponse.json({
      sciences,
      activeResearch,
      knowledge,
      gold: province.gold ?? 0,
      metal: province.metal ?? 0,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/science GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const scID = Number((await request.json()).scID);
    if (!Number.isSafeInteger(scID)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [pID]);
      const type = await tx.scienceType.findUnique({ where: { id: scID } });
      if (!type?.className) throw new Error('Unknown science');
      const rule = ORIGINAL_SCIENCES.find(item => item.className === type.className);
      if (!rule || rule.hidden) throw new Error('Unknown science');

      const province = await tx.province.findUnique({
        where: { id: pID },
        include: {
          science: { include: { type: true } },
          buildings: { include: { type: true } },
        },
      });
      if (!province) throw new Error('No province found');
      if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (province.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
      const race = province.raceId
        ? await tx.race.findUnique({ where: { id: province.raceId } })
        : null;
      if (rule.races && !rule.races.includes(race?.name ?? '')) {
        throw new Error('That knowledge is not available to your race');
      }
      if (province.science.some(item => item.scID === scID)) {
        throw new Error('That knowledge is already complete');
      }
      if (await tx.researchOrder.findFirst({ where: { pID } })) {
        throw new Error('You are already researching a knowledge');
      }

      const knowledge = scienceKnowledge(province.science);
      if (!requirementsMet(type, knowledge)) {
        throw new Error('You do not meet the knowledge requirements');
      }
      if ((province.gold ?? 0) < type.costGold || (province.metal ?? 0) < type.costMetal) {
        throw new Error('Insufficient resources');
      }

      const docks = province.buildings.reduce(
        (sum, building) =>
          sum + (canonicalBuildingName(building.type.className) === 'Dock' ? building.num : 0),
        0,
      );
      const raceMods = legacyRaceModifiers(race?.name);
      const dockMultiplier = Math.max(
        0.0001,
        1 + buildingEffect(docks, province.acres ?? 0, -15, 20),
      );
      const ticks = Math.max(0, Math.round(type.researchTicks * raceMods.researchTime * dockMultiplier));

      await tx.province.update({
        where: { id: pID },
        data: {
          gold: { decrement: type.costGold },
          metal: { decrement: type.costMetal },
        },
      });
      if (ticks === 0) {
        await tx.science.create({ data: { pID, scID, level: 1 } });
      } else {
        await tx.researchOrder.create({ data: { pID, scID, ticksLeft: ticks } });
      }
      return { type, ticks };
    });

    return NextResponse.json({
      message: result.ticks === 0
        ? `${result.type.name} was completed immediately.`
        : `Research of ${result.type.name} begun — ready in ${result.ticks} ticks.`,
      costGold: result.type.costGold,
      costMetal: result.type.costMetal,
      researchTicks: result.ticks,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const known = [
      'Unknown science',
      'No province found',
      'That knowledge is not available to your race',
      'That knowledge is already complete',
      'You are already researching a knowledge',
      'You do not meet the knowledge requirements',
      'Insufficient resources',
      'Your province is not active',
      'You are on vacation and cannot act. End it in Preferences.',
    ];
    if (known.includes(message)) {
      return NextResponse.json({ error: message }, { status: message === 'No province found' ? 404 : 400 });
    }
    return internalErrorResponse(request, '/api/science POST', error);
  }
}
