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
import { legacyEffectMultiplier } from '@/lib/legacy-effects';
import { legacyActionBlockedByOverpopulation, legacyPeasantHousing } from '@/lib/legacy-housing';
import { recordDeadMilitary } from '@/lib/dead-military';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { reconcileLandLoss } from '@/lib/province-lifecycle';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';
import { consumeRateLimit } from '@/lib/rate-limit';
import {
  ATTACK_DEFINITIONS,
  ATTACK_LIST,
  attackAvailable,
  gaussianLandPercent,
  isAttackId,
  type BattleUnitLine,
} from '@/lib/combat';
import { militaryName } from '@/lib/military';
import { listTargets } from '@/lib/server/target-intel';
import { createBattleReport, listBattleReports, toBattleReportView } from '@/lib/server/battle-reports';

const COMBAT_CATEGORIES = ['soldiers', 'offense', 'defense', 'elite'];
const LOSS_RESISTANCE: Record<string, number> = {
  soldiers: 5,
  offense: 15,
  defense: 20,
  elite: 25,
  thieves: 5,
  wizards: 5,
};

function randomInteger(low: number, high: number) {
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

// War Room data: enriched targets, ready units, armies away, attack classes
// the province may use, its own readiness, and recent battle reports.
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const pID = user.pID;

    const me = await prisma.province.findUnique({
      where: { id: pID },
      include: { science: { include: { type: true } } },
    });
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [targets, ownedUnits, training, armiesAway, activeAttacks, reports, races, state] = await Promise.all([
      listTargets(prisma, me, 'attack'),
      prisma.militaryUnit.findMany({
        where: { pID, type: { category: { in: COMBAT_CATEGORIES } } },
        include: { type: true },
      }),
      prisma.militaryOrder.findMany({ where: { pID } }),
      prisma.army.findMany({ where: { pID } }),
      prisma.attack.findMany({
        where: { pID },
        include: { defender: { select: { provinceName: true } } },
      }),
      listBattleReports(prisma, pID, 20),
      prisma.race.findMany({ select: { id: true, name: true } }),
      prisma.gameState.findUnique({ where: { id: 1 }, select: { tick: true } }),
    ]);
    const unavailable = new Map<number, number>();
    for (const order of training) unavailable.set(order.mID, (unavailable.get(order.mID) ?? 0) + order.num);
    for (const army of armiesAway) unavailable.set(army.mID, (unavailable.get(army.mID) ?? 0) + army.num);
    const units = ownedUnits.map(unit => ({
      mID: unit.mID,
      num: Math.max(0, unit.num - (unavailable.get(unit.mID) ?? 0)),
      type: {
        className: unit.type.className,
        displayName: unit.type.displayName,
        category: unit.type.category,
        attack: unit.type.attack,
        defense: unit.type.defense,
      },
    }));
    const knowledge = scienceKnowledge(me.science);
    const raceMods = legacyRaceModifiers(races.find(race => race.id === me.raceId)?.name);
    const season = LEGACY_SEASON_MODIFIERS[legacySeasonForTick(state?.tick ?? 1)];
    const effectiveMorale = Math.round((me.morale ?? 0) * raceMods.morale * season.morale);

    return NextResponse.json({
      targets,
      units,
      activeAttacks: activeAttacks.map(attack => ({
        id: attack.id,
        defender: attack.defender,
        attackType: attack.attackType,
        backtick: attack.backtick,
        acres: attack.acres,
        gold: attack.gold,
        food: attack.food,
        metal: attack.metal,
      })),
      attackTypes: ATTACK_LIST.map(definition => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        backTicks: definition.backTicks,
        requirementLabel: definition.requirementLabel,
        available: attackAvailable(definition, knowledge),
      })),
      me: {
        id: me.id,
        provinceName: me.provinceName ?? 'Your province',
        morale: me.morale ?? 0,
        effectiveMorale,
        canAttack: effectiveMorale >= 50 && (me.protection ?? 0) <= 0 && !me.vacation,
        protection: me.protection ?? 0,
        vacation: me.vacation,
        acres: me.acres ?? 0,
        networth: me.networth ?? 0,
      },
      reports,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
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
    const requestedType = Number(body.attackType);
    const attackType = isAttackId(requestedType) ? requestedType : 1;
    const definition = ATTACK_DEFINITIONS[attackType];
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
      ) throw new Error(`You have not researched ${definition.legacyName}`);

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
      const attackerEffectiveMorale = (attacker.morale ?? 0)
        * attackerRace.morale
        * legacyEffectMultiplier(advisorBonus(attacker, 'morale'))
        * season.morale;
      const defenderEffectiveMorale = (defender.morale ?? 0)
        * defenderRace.morale
        * legacyEffectMultiplier(advisorBonus(defender, 'morale'))
        * season.morale;
      if (attackerEffectiveMorale < 50) throw new Error('You need at least 50 morale to attack');
      const attackerHousing = legacyPeasantHousing(
        attacker.acres ?? 0,
        attacker.buildings,
        attackerRace.peasantHousing,
        scienceBonus(attacker, ['housing']),
      );
      const attackerPopulation = attacker.military.reduce((sum, unit) => sum + unit.num, 0);
      if (legacyActionBlockedByOverpopulation(attacker.peasants ?? 0, attackerPopulation, attackerHousing)) {
        throw new Error('Your population is rioting and your army refuses to attack');
      }
      const blacksmith = buildingEffect(buildingCount(attacker, 'Blacksmith'), attacker.acres ?? 0, 2, 20);
      const dockAttack = buildingEffect(buildingCount(attacker, 'Dock'), attacker.acres ?? 0, .5, 20);
      const attackerWall = buildingEffect(buildingCount(attacker, 'Wall'), attacker.acres ?? 0, 2, 10);
      const wall = buildingEffect(buildingCount(defender, 'Wall'), defender.acres ?? 0, 2, 10);
      const defenderBlacksmith = buildingEffect(buildingCount(defender, 'Blacksmith'), defender.acres ?? 0, 2, 20);
      const defenderDockAttack = buildingEffect(buildingCount(defender, 'Dock'), defender.acres ?? 0, .5, 20);
      const attackScience = scienceBonus(attacker, ['offense', 'combatBoth', 'theology']);
      const defenseScience = scienceBonus(defender, ['defense', 'combatBoth']);
      const attackerDefenseScience = scienceBonus(attacker, ['defense', 'combatBoth']);
      const defenderAttackScience = scienceBonus(defender, ['offense', 'combatBoth', 'theology']);
      const attackerSpell = timedBonus(attacker, 'battleFrenzy')
        - timedBonus(attacker, 'curse')
        + activeSpellPercent(attacker.effects, 'attack');
      const defenderSpell = timedBonus(defender, 'stoneSkin')
        - timedBonus(defender, 'curse')
        + activeSpellPercent(defender.effects, 'defense');
      const attackerDefenseSpell = timedBonus(attacker, 'stoneSkin')
        - timedBonus(attacker, 'curse')
        + activeSpellPercent(attacker.effects, 'defense');
      const defenderAttackSpell = timedBonus(defender, 'battleFrenzy')
        - timedBonus(defender, 'curse')
        + activeSpellPercent(defender.effects, 'attack');
      const baseAttack = attackType === 2 ? attackerAttackRaw + attackerDefenseRaw : attackerAttackRaw;
      const attackPoints = baseAttack
        * (attackerEffectiveMorale / 100)
        * attackerRace.attack
        * legacyEffectMultiplier((blacksmith + dockAttack) * 100)
        * legacyEffectMultiplier(attackScience)
        * legacyEffectMultiplier(attackerSpell)
        * legacyEffectMultiplier(advisorBonus(attacker, 'offense'));
      const defensePoints = defenderDefenseRaw
        * Math.max(1, defenderEffectiveMorale / 100)
        * defenderRace.defense
        * season.defense
        * legacyEffectMultiplier(wall * 100)
        * legacyEffectMultiplier(defenseScience)
        * legacyEffectMultiplier(defenderSpell)
        * legacyEffectMultiplier(advisorBonus(defender, 'defense'));
      const attackerDefensePoints = attackerDefenseRaw
        * (attackerEffectiveMorale / 100)
        * attackerRace.defense
        * season.defense
        * legacyEffectMultiplier(attackerWall * 100)
        * legacyEffectMultiplier(attackerDefenseScience)
        * legacyEffectMultiplier(attackerDefenseSpell)
        * legacyEffectMultiplier(advisorBonus(attacker, 'defense'));
      const defenderAttackPoints = defenderAttackRaw
        * Math.max(1, defenderEffectiveMorale / 100)
        * defenderRace.attack
        * legacyEffectMultiplier((defenderBlacksmith + defenderDockAttack) * 100)
        * legacyEffectMultiplier(defenderAttackScience)
        * legacyEffectMultiplier(defenderAttackSpell)
        * legacyEffectMultiplier(advisorBonus(defender, 'offense'));
      const won = attackPoints > defensePoints;

      const attackerRatioRaw = (attackPoints + 1) / (defensePoints + 1);
      const attackerLossRatio = attackerRatioRaw >= 1 ? 1 : 2 - attackerRatioRaw;
      const defenderLossRatio = Math.min(1, Math.pow(10, (attackPoints + 1) / ((defensePoints + 1) / 2)) / 100);
      const attackerDefenseRatio = Math.max((attackerDefensePoints + 1) / (defenderAttackPoints + 1), 1);
      const attackerRange = won ? definition.attackerWin : definition.attackerLose;
      const defenderRange = won ? definition.defenderLose : definition.defenderWin;

      const survivors: Array<{ pID: number; mID: number; num: number }> = [];
      const unitLines: BattleUnitLine[] = [];
      let attackerDead = 0;
      for (const unit of selected) {
        const minimum = Math.ceil((unit.num / 100) * attackerRange[0] * attackerLossRatio);
        const maximum = Math.ceil((unit.num / 100) * attackerRange[1] * attackerLossRatio);
        let dead = randomInteger(minimum, Math.max(minimum, maximum));
        dead -= Math.ceil((dead / 100) * attackerDefenseRatio * (LOSS_RESISTANCE[unit.type.category ?? ''] ?? 0));
        dead = Math.max(0, Math.min(unit.num, dead));
        attackerDead += dead;
        unitLines.push({ name: militaryName(unit.type), sent: unit.num, lost: dead });
        if (dead) {
          await tx.militaryUnit.update({
            where: { pID_mID: { pID: attacker.id, mID: unit.mID } },
            data: { num: { decrement: dead } },
          });
          await recordDeadMilitary(tx, attacker.id, unit.mID, dead);
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
        if (dead) {
          await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: dead } } });
          await recordDeadMilitary(tx, defender.id, unit.mID, dead);
        }
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
      const peakAcres = ownAcres * 1.1;
      const sizeIncomeModifier = targetAcres > 0
        ? (peakAcres >= targetAcres ? targetAcres / peakAcres : peakAcres / targetAcres)
        : 0;
      const extraIncome = (won ? attackPoints / 8 : attackPoints / 14)
        * sizeIncomeModifier
        * randomInteger(95, 105) / 100;
      const experienceRatio = (attackType === 1 ? targetAcres / ownAcres : landRatio) * 100;
      const experienceBase = experienceRatio < 50 ? 1
        : experienceRatio < 70 ? 4
          : experienceRatio < 80 ? 16
            : experienceRatio < 90 ? 64
              : experienceRatio < 110 ? 256 : 300;
      const militaryExperience = Math.floor(
        (targetAcres / 1000) * experienceBase * randomInteger(70, 110) / 100 * .8,
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
          extraIncome,
          armies: { create: survivors },
        },
      });
      await tx.province.update({
        where: { id: attacker.id },
        data: {
          attacksMade: { increment: 1 },
          attackWins: { increment: won ? 1 : 0 },
          militaryRep: { increment: militaryExperience },
        },
      });
      await tx.province.update({
        where: { id: defender.id },
        data: {
          attacksSuffered: { increment: 1 },
          attacksSufferedLost: { increment: won ? 1 : 0 },
          militaryRep: { increment: militaryExperience },
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
      const kingdomReports = [...new Set([attacker.kiID, defender.kiID].filter(id => id > 0))];
      if (kingdomReports.length) {
        await tx.kingdomNews.createMany({
          data: kingdomReports.map(kiID => ({
            kiID,
            message: `${attacker.provinceName ?? 'A province'} attacked ${defender.provinceName ?? 'another province'} and ${won ? 'won' : 'was repelled'}.`,
          })),
        });
      }
      const reportRow = await createBattleReport(tx, {
        age: state?.age ?? 1,
        tick: state?.tick ?? 0,
        attackerPID: attacker.id,
        defenderPID: defender.id,
        attackerName: attacker.provinceName ?? 'Unknown province',
        defenderName: defender.provinceName ?? 'Unknown province',
        attackerKiID: attacker.kiID,
        defenderKiID: defender.kiID,
        attackType,
        won,
        attackPoints,
        defensePoints,
        attackerLost: attackerDead,
        defenderLost: defenderDead,
        acresSeized: seizedAcres,
        acresGained: acres,
        gold,
        food,
        metal,
        buildingsLost: landResult.buildingsLost,
        moraleLoss,
        returnTicks: backTicks,
        targetKilled: landResult.killed,
        units: unitLines,
      });
      return {
        attackId: attack.id,
        won,
        attackerDead,
        defenderDead,
        moraleLoss,
        backTicks,
        buildingsDestroyed: landResult.buildingsLost,
        targetKilled: landResult.killed,
        report: toBattleReportView(reportRow, attacker.id),
      };
    });

    return NextResponse.json({
      message: `${definition.legacyName} resolved immediately. Your surviving army returns in ${result.backTicks} ticks.`,
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
      'Your population is rioting and your army refuses to attack',
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
