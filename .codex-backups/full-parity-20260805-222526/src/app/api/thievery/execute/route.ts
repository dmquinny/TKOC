import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { scienceKnowledge } from '@/lib/science';
import { activeSpellPercent, legacySizeModifier } from '@/lib/legacy-magic';
import {
  hasThieveryKnowledge,
  legacyThieveryChancePerThousand,
  legacyThieveryMultiplier,
  LEGACY_THIEVERY_BY_NAME,
  LEGACY_THIEVERY_OPERATIONS,
  randomEstimate,
  readyThieveryUnits,
  thieveryImageForClass,
} from '@/lib/legacy-thievery';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';
import { consumeRateLimit } from '@/lib/rate-limit';

const MIN_INFLUENCE = 40;
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

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
    const [targets, me] = await Promise.all([
      prisma.province.findMany({
        where: { id: { not: pID }, status: 'Alive', acres: { gt: 0 } },
        select: { id: true, provinceName: true, rulerName: true, networth: true, acres: true, kiID: true },
        orderBy: { provinceName: 'asc' },
      }),
      prisma.province.findUnique({
        where: { id: pID },
        include: {
          science: { include: { type: true } },
          military: { include: { type: true } },
          militaryOrders: true,
          outgoingAttacks: { include: { armies: true } },
        },
      }),
    ]);
    if (!me) return NextResponse.json({ error: 'Province not found' }, { status: 404 });
    const knowledge = scienceKnowledge(me.science);
    const thiefUnit = me.military.find(unit => unit.type.category === 'thieves');
    const thievesTraining = me.militaryOrders
      .filter(order => order.mID === thiefUnit?.mID)
      .reduce((sum, order) => sum + order.num, 0);
    const thievesAway = me.outgoingAttacks
      .flatMap(attack => attack.armies)
      .filter(army => army.mID === thiefUnit?.mID)
      .reduce((sum, army) => sum + army.num, 0);
    const availableThieves = readyThieveryUnits(thiefUnit?.num ?? 0, thievesTraining, thievesAway);
    return NextResponse.json({
      targets,
      availableThieves,
      influence: me.influence ?? 0,
      operations: LEGACY_THIEVERY_OPERATIONS.map(operation => ({
        ...operation,
        image: thieveryImageForClass(operation.className),
        available: hasThieveryKnowledge(knowledge, operation.thieveryRequired),
      })),
    });
  } catch (error) {
    return internalErrorResponse(request, '/api/thievery/execute GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const rate = await consumeRateLimit(`thievery:${pID}`, 20, 60_000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/thievery/execute', 'Thievery action rate limit exceeded', { pID });
      return NextResponse.json(
        { error: 'You are issuing covert orders too quickly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }
    const body = await request.json();
    const operation = LEGACY_THIEVERY_BY_NAME.get(String(body.operation ?? ''));
    const targetID = Number(body.targetID);
    if (!operation) return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    if (!Number.isSafeInteger(targetID) || targetID === pID) {
      return NextResponse.json({ error: 'Select another province as the target' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [pID, targetID]);
      const [me, target] = await Promise.all([
        tx.province.findUnique({
          where: { id: pID },
          include: {
            science: { include: { type: true } },
            buildings: { include: { type: true } },
            military: { include: { type: true } },
            militaryOrders: true,
            effects: true,
            outgoingAttacks: { include: { armies: true } },
          },
        }),
        tx.province.findUnique({
          where: { id: targetID },
          include: {
            science: { include: { type: true } },
            buildings: { include: { type: true } },
            military: { include: { type: true } },
            militaryOrders: true,
            effects: true,
            outgoingAttacks: { include: { armies: { include: { type: true } } } },
          },
        }),
      ]);
      if (!me || !target) throw new Error('Target not found');
      if (me.status !== 'Alive' || (me.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (target.status !== 'Alive' || (target.acres ?? 0) <= 0) throw new Error('Target is no longer active');
      if (me.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
      if ((me.protection ?? 0) > 0 || (target.protection ?? 0) > 0 || target.vacation) {
        throw new Error('Protection prevents thievery operations');
      }
      if ((me.influence ?? 0) < MIN_INFLUENCE) throw new Error(`At least ${MIN_INFLUENCE} influence is required`);
      const knowledge = scienceKnowledge(me.science);
      if (!hasThieveryKnowledge(knowledge, operation.thieveryRequired)) {
        throw new Error('You lack the thievery science required for this operation');
      }

      const thiefUnit = me.military.find(unit => unit.type.category === 'thieves');
      const targetThiefUnit = target.military.find(unit => unit.type.category === 'thieves');
      const totalsByType = (entries: Array<{ mID: number; num: number }>) => entries.reduce((totals, entry) => {
        totals.set(entry.mID, (totals.get(entry.mID) ?? 0) + entry.num);
        return totals;
      }, new Map<number, number>());
      const myTraining = totalsByType(me.militaryOrders);
      const targetTraining = totalsByType(target.militaryOrders);
      const myAway = totalsByType(me.outgoingAttacks.flatMap(attack => attack.armies));
      const targetAway = totalsByType(target.outgoingAttacks.flatMap(attack => attack.armies));
      const homeUnits = (
        total: number,
        mID: number,
        training: Map<number, number>,
        away: Map<number, number>,
      ) => readyThieveryUnits(total, training.get(mID) ?? 0, away.get(mID) ?? 0);
      const thieves = thiefUnit ? homeUnits(thiefUnit.num, thiefUnit.mID, myTraining, myAway) : 0;
      const targetThieves = targetThiefUnit
        ? homeUnits(targetThiefUnit.num, targetThiefUnit.mID, targetTraining, targetAway)
        : 0;
      if (!thiefUnit || thieves < 1) throw new Error('Not enough Thieves');

      const offenseScience = me.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'thieveryOffense' ? entry.level * entry.type.bonusPerLevel : 0),
        0,
      );
      const defenseScience = target.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'thieveryDefense' ? entry.level * entry.type.bonusPerLevel : 0),
        0,
      );
      const [advisor, targetAdvisor] = await Promise.all([
        me.councilId ? tx.advisor.findUnique({ where: { id: me.councilId } }) : null,
        target.councilId ? tx.advisor.findUnique({ where: { id: target.councilId } }) : null,
      ]);
      const [race, targetRace] = await Promise.all([
        me.raceId ? tx.race.findUnique({ where: { id: me.raceId }, select: { name: true } }) : null,
        target.raceId ? tx.race.findUnique({ where: { id: target.raceId }, select: { name: true } }) : null,
      ]);
      const advisorBonus = (candidate: typeof advisor, effect: string) =>
        (candidate?.effect === effect ? candidate.bonus : 0)
        + (candidate?.effect2 === effect ? candidate.bonus2 : 0);
      const innCount = (province: typeof me) => province.buildings.reduce(
        (sum, building) => sum + (building.type.className === 'Inn' ? building.num : 0),
        0,
      );
      const myTpa = thieves / Math.max(1, me.acres ?? 0)
        * legacyThieveryMultiplier({
          effect: 'offense',
          sciencePercent: offenseScience,
          advisorPercent: advisorBonus(advisor, 'thieveryOffense'),
          spellPercent: activeSpellPercent(me.effects, 'thieveryOffense'),
          innCount: innCount(me),
          acres: me.acres ?? 0,
          raceName: race?.name,
        });
      const targetTpa = targetThieves / Math.max(1, target.acres ?? 0)
        * legacyThieveryMultiplier({
          effect: 'defense',
          sciencePercent: defenseScience,
          advisorPercent: advisorBonus(targetAdvisor, 'thieveryDefense'),
          spellPercent: activeSpellPercent(target.effects, 'thieveryDefense'),
          innCount: innCount(target),
          acres: target.acres ?? 0,
          raceName: targetRace?.name,
        });
      const chancePerThousand = legacyThieveryChancePerThousand(myTpa, targetTpa, operation.difficulty);
      const success = randomInt(1, 1000) < chancePerThousand;
      const lossScience = me.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'thieveryLoss' ? entry.level * entry.type.bonusPerLevel : 0),
        0,
      );
      const thiefLossMultiplier = legacyThieveryMultiplier({
        effect: 'loss',
        sciencePercent: lossScience,
        advisorPercent: advisorBonus(advisor, 'thieveryLoss'),
        raceName: race?.name,
      });

      // The original checks for 40 influence before every operation, then
      // charges the operation cost whether it succeeds or fails.
      await tx.province.update({ where: { id: pID }, data: { influence: { decrement: operation.influence } } });
      const myName = me.provinceName ?? 'An unknown province';
      const targetName = target.provinceName ?? 'the target';

      if (!success) {
        const smartThieves = Boolean(4 & knowledge.thievery);
        const basis = smartThieves && operation.optimalThieves > 0 && operation.optimalThieves < thieves
          ? operation.optimalThieves
          : thieves;
        const ratio = Math.min(1, targetThieves / Math.max(1, thieves)) * .05;
        const lost = Math.min(thiefUnit.num, Math.floor(thiefLossMultiplier * ratio * basis) + 1);
        await tx.militaryUnit.update({ where: { id: thiefUnit.id }, data: { num: { decrement: lost } } });
        const identified = randomInt(1, 3) === 1;
        await tx.news.create({
          data: { pID: targetID, message: identified ? `${myName} attempted ${operation.name} against us.` : `Unknown thieves attempted ${operation.name} against us.` },
        });
        return { success: false, message: `${operation.name} failed. ${lost.toLocaleString()} thieves were lost.`, thievesUsed: thieves };
      }

      const size = legacySizeModifier(me.acres ?? 0, target.acres ?? 0);
      const revealed: Record<string, unknown> = {};
      let message = `${operation.name} against ${targetName} succeeded.`;
      let thievesLost = 0;

      if (operation.className === 'SpyOnProvince') {
        Object.assign(revealed, {
          ruler: target.rulerName,
          race: targetRace?.name ?? 'Unknown',
          gender: target.gender === 'M' ? 'Male' : target.gender === 'F' ? 'Female' : 'Unknown',
          knowledge: target.science.reduce((sum, entry) => sum + Math.max(0, entry.level), 0),
          gold: target.gold,
          food: target.food,
          metal: target.metal,
          peasants: target.peasants,
          acres: target.acres,
          morale: target.morale,
          military: target.military.map(unit => ({
            name: unit.type.displayName ?? unit.type.className,
            num: ['thieves', 'wizards'].includes(unit.type.category ?? '')
              ? 'Unknown'
              : randomEstimate(
                  Math.max(0, unit.num - (targetTraining.get(unit.mID) ?? 0)),
                  operation.randomness,
                ),
          })),
        });
      } else if (operation.className === 'SpyOnSciences') {
        revealed.sciences = target.science.filter(entry => entry.level > 0).map(entry => entry.type.name);
      } else if (operation.className === 'RobSupplies') {
        const capacity = thieves * 17 * size;
        const gold = Math.floor(Math.min(capacity, (target.gold ?? 0) * .015));
        const food = Math.floor(Math.min(capacity, (target.food ?? 0) * .02));
        const metal = Math.floor(Math.min(capacity, (target.metal ?? 0) * .02));
        await tx.province.update({ where: { id: targetID }, data: { gold: { decrement: gold }, food: { decrement: food }, metal: { decrement: metal } } });
        await tx.province.update({ where: { id: pID }, data: { gold: { increment: gold }, food: { increment: food }, metal: { increment: metal } } });
        message = `Your thieves stole ${gold.toLocaleString()} gold, ${food.toLocaleString()} food, and ${metal.toLocaleString()} metal.`;
      } else if (operation.className === 'SpyOnMilitary') {
        revealed.militaryAway = target.outgoingAttacks.flatMap(attack => attack.armies.map(army => ({
          name: army.type.displayName ?? army.type.className,
          num: randomEstimate(army.num, operation.randomness),
        })));
      } else if (operation.className === 'PoisonWater') {
        const killed = Math.floor((target.peasants ?? 0) * .04);
        await tx.province.update({ where: { id: targetID }, data: { peasants: { decrement: killed } } });
        if (randomInt(1, 5) === 1) {
          thievesLost = Math.min(thiefUnit.num, Math.floor(thiefLossMultiplier * thieves * .05));
          if (thievesLost) await tx.militaryUnit.update({ where: { id: thiefUnit.id }, data: { num: { decrement: thievesLost } } });
        }
        message = `Poisoned water killed ${killed.toLocaleString()} peasants.`;
      } else if (operation.className === 'Infiltrate') {
        const mana = Math.floor((target.mana ?? 0) * .22 * size);
        const influence = Math.floor((target.influence ?? 0) * .22 * size);
        await tx.province.update({ where: { id: targetID }, data: { mana: { decrement: mana }, influence: { decrement: influence } } });
        message = `Infiltration drained ${mana} mana and ${influence} influence.`;
      } else if (operation.className === 'SpyOnKingdom') {
        const kingdom = target.kiID ? await tx.kingdom.findUnique({ where: { id: target.kiID } }) : null;
        const provinces = target.kiID
          ? await tx.province.findMany({
              where: { kiID: target.kiID, status: 'Alive' },
              select: { provinceName: true, rulerName: true, acres: true, networth: true },
            })
          : [];
        revealed.kingdom = { name: kingdom?.name ?? 'Unassigned', provinces };
      } else if (operation.className === 'AssasinateCouncil') {
        await tx.province.update({ where: { id: targetID }, data: { councilId: 0 } });
        message = target.councilId ? `The council advisor of ${targetName} was assassinated.` : `${targetName} had no council advisor.`;
      } else if (operation.className === 'SpyOnBuildings') {
        revealed.buildings = target.buildings.map(building => ({
          name: building.type.className,
          num: building.num,
        }));
      } else if (operation.className === 'Screen') {
        const nonTrainingUnits = (unit: (typeof target.military)[number]) =>
          Math.max(0, unit.num - (targetTraining.get(unit.mID) ?? 0));
        const covert = target.military
          .filter(unit => ['wizards', 'thieves'].includes(unit.type.category ?? ''))
          .reduce((sum, unit) => sum + nonTrainingUnits(unit), 0);
        const others = target.military
          .filter(unit => !['wizards', 'thieves'].includes(unit.type.category ?? ''))
          .reduce((sum, unit) => sum + nonTrainingUnits(unit), 0);
        revealed.covertUnits = randomEstimate(covert, operation.randomness);
        revealed.otherUnits = randomEstimate(others, operation.randomness);
      } else if (operation.className === 'Investigate') {
        revealed.mana = randomEstimate(target.mana ?? 0, operation.randomness);
        revealed.influence = randomEstimate(target.influence ?? 0, operation.randomness);
        revealed.morale = randomEstimate(target.morale ?? 0, operation.randomness);
      } else if (operation.className === 'AssasinateMilitary') {
        let killed = 0;
        const sizeSquared = size * size;
        for (const unit of target.military) {
          const category = unit.type.category ?? '';
          const categoryMultiplier = ['thieves', 'wizards'].includes(category) ? 2 : category === 'elite' ? .5 : 1;
          const unitsAtHome = homeUnits(unit.num, unit.mID, targetTraining, targetAway);
          const loss = Math.floor(unitsAtHome * .008 * sizeSquared * categoryMultiplier * (1 + (Math.random() * .2 - .1)));
          if (loss) await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: loss } } });
          killed += loss;
        }
        if (randomInt(1, 4) === 1) {
          thievesLost = Math.min(thiefUnit.num, Math.floor(thiefLossMultiplier * thieves * .03));
          if (thievesLost) await tx.militaryUnit.update({ where: { id: thiefUnit.id }, data: { num: { decrement: thievesLost } } });
        }
        message = `Your assassins killed about ${killed.toLocaleString()} enemy troops.`;
      } else if (operation.className === 'SabotageArmy' || operation.className === 'Riots') {
        const existing = target.effects.find(effect => effect.type === operation.className);
        const ticks = randomInt(1, 7);
        if (existing) {
          message = operation.className === 'Riots' ? 'The target is already suffering riots.' : 'The target army is already sabotaged.';
        } else {
          await tx.effect.create({ data: { pID: targetID, type: operation.className, magnitude: operation.className === 'Riots' ? 50 : 200, ticksLeft: ticks, sourcePID: pID } });
          message = operation.className === 'Riots'
            ? `Riots will halve ${targetName}'s income for ${ticks} ticks.`
            : `${targetName}'s military upkeep is tripled for ${ticks} ticks.`;
        }
      }

      const destructive = !['SpyOnProvince', 'SpyOnSciences', 'SpyOnMilitary', 'SpyOnKingdom', 'SpyOnBuildings', 'Screen', 'Investigate'].includes(operation.className);
      if (destructive) {
        await tx.news.create({ data: { pID: targetID, message: `${myName} carried out ${operation.name} against your province.` } });
      }
      if (thievesLost > 0) {
        message += ` ${thievesLost.toLocaleString()} thieves were lost during the operation.`;
      }
      return {
        success: true,
        message,
        thievesUsed: thieves,
        thievesLost,
        influenceUsed: operation.influence,
        ...(Object.keys(revealed).length ? { revealed } : {}),
      };
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const expected = /Target|Protection|influence|science|Thieves|province|operation/i.test(message);
    if (!expected) return internalErrorResponse(request, '/api/thievery/execute POST', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
