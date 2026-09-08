import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { buildingEffect, canonicalBuildingName } from '@/lib/buildings';
import {
  LEGACY_SEASON_MODIFIERS,
  legacyRaceModifiers,
  legacySeasonForTick,
} from '@/lib/legacy-rules';
import { scienceKnowledge } from '@/lib/science';
import { activeSpellPercent } from '@/lib/legacy-magic';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { reconcileLandLoss } from '@/lib/province-lifecycle';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';
import { consumeRateLimit } from '@/lib/rate-limit';

const COMBAT_CATEGORIES = ['soldiers', 'offense', 'defense', 'elite'];
const LOSS_RESISTANCE: Record<string, number> = {
  soldiers: 5,
  offense: 15,
  defense: 20,
  elite: 25,
  thieves: 5,
  wizards: 5,
};

const ATTACKS = {
  1: {
    name: 'Ordinary Attack',
    backTicks: 10,
    requirement: { military: 0, thievery: 0 },
    attackerWin: [4, 9],
    attackerLose: [5, 10],
    defenderWin: [2, 8],
    defenderLose: [3, 9],
  },
  2: {
    name: 'Massacre',
    backTicks: 10,
    requirement: { military: 16, thievery: 0 },
    attackerWin: [4, 10],
    attackerLose: [8, 20],
    defenderWin: [1, 5],
    defenderLose: [4, 8],
  },
  5: {
    name: 'Pillage',
    backTicks: 6,
    requirement: { military: 1, thievery: 1 },
    attackerWin: [0, 3],
    attackerLose: [1, 5],
    defenderWin: [0, 2],
    defenderLose: [1, 2],
  },
} as const;

type AttackId = keyof typeof ATTACKS;

function randomInteger(low: number, high: number) {
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function gaussianLandPercent(ownAcres: number, targetAcres: number) {
  const inOptimalBand = ownAcres >= 0.75 * targetAcres && ownAcres <= 1.45 * targetAcres;
  const peak = inOptimalBand ? 0.10225 : 0.15;
  const distribution = inOptimalBand ? -2 : -5.2;
  const exponent = distribution * Math.pow(((1.1 * ownAcres) - targetAcres) / Math.max(1, ownAcres), 2);
  return peak * Math.exp(exponent);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [targets, ownedUnits, training, armiesAway, activeAttacks] = await Promise.all([
      prisma.province.findMany({
        where: {
          id: { not: user.pID },
          status: 'Alive',
          acres: { gt: 0 },
          vacation: false,
          protection: { lte: 0 },
        },
        select: { id: true, provinceName: true, rulerName: true, networth: true, acres: true },
      }),
      prisma.militaryUnit.findMany({
        where: { pID: user.pID, type: { category: { in: COMBAT_CATEGORIES } } },
        include: { type: true },
      }),
      prisma.militaryOrder.findMany({ where: { pID: user.pID } }),
      prisma.army.findMany({ where: { pID: user.pID } }),
      prisma.attack.findMany({
        where: { pID: user.pID },
        include: { defender: { select: { provinceName: true } } },
      }),
    ]);
    const unavailable = new Map<number, number>();
    for (const order of training) unavailable.set(order.mID, (unavailable.get(order.mID) ?? 0) + order.num);
    for (const army of armiesAway) unavailable.set(army.mID, (unavailable.get(army.mID) ?? 0) + army.num);
    const units = ownedUnits.map(unit => ({
      ...unit,
      num: Math.max(0, unit.num - (unavailable.get(unit.mID) ?? 0)),
    }));

    return NextResponse.json({ targets, units, activeAttacks }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/combat/attack GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const rate = await consumeRateLimit(`combat:${user.pID}`, 12, 60_000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/combat/attack', 'Combat action rate limit exceeded', {
        userId,
        pID: user.pID,
      });
      return NextResponse.json(
        { error: 'You are issuing military orders too quickly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const targetID = Number(body.targetID);
    const troops = body.troops as Record<string, unknown> | undefined;
    const attackType = ([1, 2, 5].includes(Number(body.attackType)) ? Number(body.attackType) : 1) as AttackId;
    const definition = ATTACKS[attackType];
    if (!Number.isSafeInteger(targetID) || !troops) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (targetID === user.pID) return NextResponse.json({ error: 'Cannot attack yourself!' }, { status: 400 });

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [user.pID!, targetID]);
      const [attacker, defender, state, races, advisors] = await Promise.all([
        tx.province.findUnique({
          where: { id: user.pID! },
          include: {
            buildings: { include: { type: true } },
            military: { include: { type: true } },
            militaryOrders: true,
            outgoingAttacks: { include: { armies: true } },
            science: { include: { type: true } },
            effects: true,
          },
        }),
        tx.province.findUnique({
          where: { id: targetID },
          include: {
            buildings: { include: { type: true } },
            military: { include: { type: true } },
            militaryOrders: true,
            outgoingAttacks: { include: { armies: true } },
            science: { include: { type: true } },
            effects: true,
          },
        }),
        tx.gameState.findUnique({ where: { id: 1 } }),
        tx.race.findMany({ select: { id: true, name: true } }),
        tx.advisor.findMany(),
      ]);
      if (!attacker || !defender) throw new Error('Target not found');
      if (attacker.status !== 'Alive' || (attacker.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (defender.status !== 'Alive' || (defender.acres ?? 0) <= 0) throw new Error('Target is no longer active');
      if (attacker.vacation) throw new Error('You are on vacation');
      if ((attacker.protection ?? 0) > 0) throw new Error('You cannot attack while protected');
      if ((attacker.morale ?? 0) < 50) throw new Error('You need at least 50 morale to attack');
      if ((defender.protection ?? 0) > 0 || defender.vacation) throw new Error('Target is under protection');
      const hostileKingdom = attacker.kiID !== defender.kiID;
      if (hostileKingdom && defender.attackPressure >= 5) {
        throw new Error('Target has already suffered too many recent attacks');
      }

      if (attacker.kiID && defender.kiID && attacker.kiID !== defender.kiID) {
        const allied = await tx.kingdomRelation.findFirst({
          where: {
            type: 'ally',
            status: 'active',
            OR: [
              { fromKiId: attacker.kiID, toKiId: defender.kiID },
              { fromKiId: defender.kiID, toKiId: attacker.kiID },
            ],
          },
        });
        if (allied) throw new Error('Cannot attack an allied kingdom');
      }

      const knowledge = scienceKnowledge(attacker.science);
      if (
        (definition.requirement.military && !(knowledge.military & definition.requirement.military))
        || (definition.requirement.thievery && !(knowledge.thievery & definition.requirement.thievery))
      ) throw new Error(`You have not researched ${definition.name}`);

      const unavailable = new Map<number, number>();
      for (const order of attacker.militaryOrders) {
        unavailable.set(order.mID, (unavailable.get(order.mID) ?? 0) + order.num);
      }
      for (const outbound of attacker.outgoingAttacks) {
        for (const army of outbound.armies) {
          unavailable.set(army.mID, (unavailable.get(army.mID) ?? 0) + army.num);
        }
      }
      const selected: Array<{ pID: number; mID: number; num: number; type: (typeof attacker.military)[number]['type'] }> = [];
      for (const [id, rawQuantity] of Object.entries(troops)) {
        const mID = Number(id);
        const num = Number(rawQuantity);
        if (!Number.isSafeInteger(num) || num <= 0) continue;
        const unit = attacker.military.find(candidate => candidate.mID === mID);
        const ready = unit ? Math.max(0, unit.num - (unavailable.get(mID) ?? 0)) : 0;
        if (!unit || !COMBAT_CATEGORIES.includes(unit.type.category ?? '') || ready < num) {
          throw new Error('Not enough troops');
        }
        selected.push({ pID: attacker.id, mID, num, type: unit.type });
      }
      if (!selected.length) throw new Error('No troops selected');

      const scienceBonus = (province: typeof attacker, effects: string[]) =>
        province.science.reduce(
          (sum, entry) => sum + (effects.includes(entry.type.effect) ? entry.level * entry.type.bonusPerLevel : 0),
          0,
        );
      const timedBonus = (province: typeof attacker, effect: string) =>
        province.effects.reduce((sum, entry) => sum + (entry.type === effect ? entry.magnitude : 0), 0);
      const advisorBonus = (province: typeof attacker, effect: string) => {
        const advisor = advisors.find(candidate => candidate.id === province.councilId);
        if (!advisor) return 0;
        return (advisor.effect === effect ? advisor.bonus : 0)
          + (advisor.effect2 === effect ? advisor.bonus2 : 0);
      };
      const buildingCount = (province: typeof attacker, className: string) =>
        province.buildings.reduce(
          (sum, building) => sum + (canonicalBuildingName(building.type.className) === className ? building.num : 0),
          0,
        );

      const defenderTraining = new Map<number, number>();
      for (const order of defender.militaryOrders) {
        defenderTraining.set(order.mID, (defenderTraining.get(order.mID) ?? 0) + order.num);
      }
      const defenderAway = new Map<number, number>();
      for (const outbound of defender.outgoingAttacks) {
        for (const army of outbound.armies) {
          defenderAway.set(army.mID, (defenderAway.get(army.mID) ?? 0) + army.num);
        }
      }
      const defenders = defender.military.map(unit => ({
        ...unit,
        ready: Math.max(
          0,
          unit.num - (defenderTraining.get(unit.mID) ?? 0) - (defenderAway.get(unit.mID) ?? 0),
        ),
      }));

      const attackerAttackRaw = selected.reduce((sum, unit) => sum + unit.num * unit.type.attack, 0);
      const attackerDefenseRaw = selected.reduce((sum, unit) => sum + unit.num * unit.type.defense, 0);
      const defenderAttackRaw = defenders.reduce((sum, unit) => sum + unit.ready * unit.type.attack, 0);
      const defenderDefenseRaw = defenders.reduce((sum, unit) => sum + unit.ready * unit.type.defense, 0);
      const raceName = new Map(races.map(race => [race.id, race.name]));
      const attackerRace = legacyRaceModifiers(raceName.get(attacker.raceId ?? 0));
      const defenderRace = legacyRaceModifiers(raceName.get(defender.raceId ?? 0));
      const season = LEGACY_SEASON_MODIFIERS[legacySeasonForTick(state?.tick ?? 1)];
      const blacksmith = buildingEffect(buildingCount(attacker, 'Blacksmith'), attacker.acres ?? 0, 2, 20);
      const wall = buildingEffect(buildingCount(defender, 'Wall'), defender.acres ?? 0, 2, 10);
      const attackScience = scienceBonus(attacker, ['offense', 'combatBoth', 'theology']);
      const defenseScience = scienceBonus(defender, ['defense', 'combatBoth']);
      const attackerEffect = advisorBonus(attacker, 'offense')
        + timedBonus(attacker, 'battleFrenzy')
        - timedBonus(attacker, 'curse')
        + activeSpellPercent(attacker.effects, 'attack');
      const defenderEffect = advisorBonus(defender, 'defense')
        + timedBonus(defender, 'stoneSkin')
        - timedBonus(defender, 'curse')
        + activeSpellPercent(defender.effects, 'defense');
      const baseAttack = attackType === 2 ? attackerAttackRaw + attackerDefenseRaw : attackerAttackRaw;
      const attackPoints = baseAttack
        * ((attacker.morale ?? 0) / 100)
        * attackerRace.attack
        * (1 + blacksmith)
        * (1 + (attackScience + attackerEffect) / 100);
      const defensePoints = defenderDefenseRaw
        * defenderRace.defense
        * season.defense
        * (1 + wall)
        * (1 + (defenseScience + defenderEffect) / 100);
      const won = attackPoints > defensePoints;

      const attackerRatioRaw = (attackPoints + 1) / (defensePoints + 1);
      const attackerLossRatio = attackerRatioRaw >= 1 ? 1 : 2 - attackerRatioRaw;
      const defenderLossRatio = Math.min(1, Math.pow(10, (attackPoints + 1) / ((defensePoints + 1) / 2)) / 100);
      const attackerDefenseRatio = Math.max((attackerDefenseRaw + 1) / (defenderAttackRaw + 1), 1);
      const attackerRange = won ? definition.attackerWin : definition.attackerLose;
      const defenderRange = won ? definition.defenderLose : definition.defenderWin;

      const survivors: Array<{ pID: number; mID: number; num: number }> = [];
      let attackerDead = 0;
      for (const unit of selected) {
        const minimum = Math.ceil((unit.num / 100) * attackerRange[0] * attackerLossRatio);
        const maximum = Math.ceil((unit.num / 100) * attackerRange[1] * attackerLossRatio);
        let dead = randomInteger(minimum, Math.max(minimum, maximum));
        dead -= Math.ceil((dead / 100) * attackerDefenseRatio * (LOSS_RESISTANCE[unit.type.category ?? ''] ?? 0));
        dead = Math.max(0, Math.min(unit.num, dead));
        attackerDead += dead;
        if (dead) {
          await tx.militaryUnit.update({
            where: { pID_mID: { pID: attacker.id, mID: unit.mID } },
            data: { num: { decrement: dead } },
          });
        }
        if (unit.num - dead > 0) survivors.push({ pID: attacker.id, mID: unit.mID, num: unit.num - dead });
      }

      let defenderDead = 0;
      for (const unit of defenders) {
        if (attackType !== 2 && !COMBAT_CATEGORIES.includes(unit.type.category ?? '')) continue;
        const minimum = Math.ceil((unit.ready / 100) * defenderRange[0] * defenderLossRatio);
        const maximum = Math.ceil((unit.ready / 100) * defenderRange[1] * defenderLossRatio);
        let dead = randomInteger(minimum, Math.max(minimum, maximum));
        dead = Math.ceil(dead * (100 - (LOSS_RESISTANCE[unit.type.category ?? ''] ?? 0)) / 100);
        dead = Math.max(0, Math.min(unit.ready, dead));
        defenderDead += dead;
        if (dead) await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: dead } } });
      }

      const ownAcres = Math.max(1, attacker.acres ?? 0);
      const targetAcres = Math.max(0, defender.acres ?? 0);
      const landRatio = Math.min(ownAcres, targetAcres) / (Math.max(ownAcres, targetAcres) + 1);
      let acres = 0;
      let seizedAcres = 0;
      let gold = 0;
      let food = 0;
      let metal = 0;
      if (attackType === 1 && won) {
        const stolenPercent = gaussianLandPercent(ownAcres, targetAcres);
        seizedAcres = targetAcres > 0
          ? Math.max(1, Math.min(targetAcres, Math.round(targetAcres * stolenPercent * randomInteger(95, 105) / 100)))
          : 0;
        acres = Math.round(seizedAcres * randomInteger(120, 130) / 100);
      } else if (attackType === 5) {
        const resourceRatio = Math.min(attackPoints + 1, defensePoints + 1) / Math.max(attackPoints + 1, defensePoints + 1);
        const percent = 0.13 * landRatio * resourceRatio * 1.3;
        gold = Math.min(defender.gold ?? 0, Math.trunc((defender.gold ?? 0) * percent));
        food = Math.min(defender.food ?? 0, Math.trunc((defender.food ?? 0) * percent));
        metal = Math.min(defender.metal ?? 0, Math.trunc((defender.metal ?? 0) * percent));
      } else if (attackType === 2) {
        seizedAcres = Math.min(
          targetAcres,
          Math.floor(targetAcres * 0.04 * landRatio * attackerRatioRaw),
          Math.floor(ownAcres / 3),
        );
        acres = 0;
      }

      let moraleLoss: number;
      if (attackType === 1) {
        const pct = Math.max(0.03675, gaussianLandPercent(ownAcres, targetAcres));
        moraleLoss = won ? Math.round(1.47 / pct) : 25;
      } else {
        const limits = attackType === 5
          ? (won ? [5, 25] : [7, 30])
          : (won ? [20, 40] : [25, 60]);
        const percent = Math.max(limits[0], (1 - landRatio * landRatio) * limits[1]);
        moraleLoss = Math.floor(((attacker.morale ?? 0) / 100) * percent);
      }

      if (attackType === 2) {
        const peasantMinimum = Math.ceil(((defender.peasants ?? 0) / 100) * defenderRange[0] * defenderLossRatio);
        const peasantMaximum = Math.ceil(((defender.peasants ?? 0) / 100) * defenderRange[1] * defenderLossRatio);
        const peasantsDead = Math.min(
          defender.peasants ?? 0,
          randomInteger(peasantMinimum, Math.max(peasantMinimum, peasantMaximum)),
        );
        if (peasantsDead) {
          defenderDead += peasantsDead;
          await tx.province.update({ where: { id: defender.id }, data: { peasants: { decrement: peasantsDead } } });
        }
      }

      await tx.province.update({
        where: { id: attacker.id },
        data: {
          morale: Math.max(0, (attacker.morale ?? 0) - moraleLoss),
        },
      });
      await tx.province.update({
        where: { id: defender.id },
        data: {
          acres: { decrement: seizedAcres },
          gold: { decrement: gold },
          food: { decrement: food },
          metal: { decrement: metal },
          attackPressure: hostileKingdom ? { increment: 1 } : undefined,
        },
      });
      const landResult = seizedAcres
        ? await reconcileLandLoss(tx, defender.id, targetAcres, seizedAcres)
        : { buildingsLost: 0, killed: false };

      const speedBuildings = buildingCount(attacker, 'Stable') + buildingCount(attacker, 'Beast den');
      const backTicks = Math.max(
        1,
        Math.round(
          definition.backTicks
          * attackerRace.attackTime
          * season.attackTime
          * (1 - buildingEffect(speedBuildings, ownAcres, 2, 15))
          * (1 + activeSpellPercent(attacker.effects, 'attackTime') / 100),
        ),
      );
      const attack = await tx.attack.create({
        data: {
          pID: attacker.id,
          targetID: defender.id,
          attackType,
          totick: 0,
          staytick: 0,
          backtick: backTicks,
          acres,
          gold,
          food,
          metal,
          armies: { create: survivors },
        },
      });

      const outcome = won ? 'Victory' : 'Defeat';
      const loot = attackType === 1 && won
        ? ` You seized ${seizedAcres.toLocaleString()} acres and will return with ${acres.toLocaleString()}.`
        : attackType === 5
          ? ` Your army took ${gold.toLocaleString()} gold, ${food.toLocaleString()} food, and ${metal.toLocaleString()} metal.`
          : attackType === 2
            ? ` The massacre drove the population from ${seizedAcres.toLocaleString()} acres.`
            : '';
      await tx.news.createMany({
        data: [
          {
            pID: attacker.id,
            message: `${outcome} against ${defender.provinceName ?? 'the enemy'}. ${attackerDead.toLocaleString()} troops were lost.${loot}`,
          },
          {
            pID: defender.id,
            message: `${attacker.provinceName ?? 'A rival'} attacked immediately. ${defenderDead.toLocaleString()} defenders and civilians were lost.`,
          },
        ],
      });
      return {
        attack,
        won,
        attackerDead,
        defenderDead,
        moraleLoss,
        backTicks,
        buildingsDestroyed: landResult.buildingsLost,
        targetKilled: landResult.killed,
      };
    });

    return NextResponse.json({
      message: `${definition.name} resolved immediately. Your surviving army returns in ${result.backTicks} ticks.`,
      ...result,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const known = [
      'Not enough troops',
      'No troops selected',
      'Target not found',
      'Target is under protection',
      'Cannot attack an allied kingdom',
      'You are on vacation',
      'You cannot attack while protected',
      'You need at least 50 morale to attack',
      'Your province is not active',
      'Target is no longer active',
      'Target has already suffered too many recent attacks',
    ];
    if (known.includes(message) || message.startsWith('You have not researched ')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(request, '/api/combat/attack POST', error);
  }
}
