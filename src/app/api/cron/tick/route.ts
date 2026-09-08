import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCronSecret } from '@/lib/auth';
import { AGE_LENGTH, APOCALYPSE_LENGTH, endAgeInTransaction } from '@/lib/age';
import { getTickIntervalMs, nextTickBoundary } from '@/lib/tick-config';
import { buildingEffect, canonicalBuildingName } from '@/lib/buildings';
import {
  LEGACY_SEASON_MODIFIERS,
  legacyKingProductionMultiplier,
  legacyRaceModifiers,
  legacySeasonForTick,
} from '@/lib/legacy-rules';
import { activeSpellPercent } from '@/lib/legacy-magic';
import { legacyPeasantHousing } from '@/lib/legacy-housing';
import { legacyProvinceNetworth } from '@/lib/legacy-networth';
import { refreshNetworthRanks } from '@/lib/server/ranking';
import { recordDeadMilitary } from '@/lib/dead-military';
import { lockGameState, withSerializableTransaction } from '@/lib/transactions';
import { reconcileLandLoss } from '@/lib/province-lifecycle';
import {
  combatProfile,
  FARM_FOOD,
  FOOD_EATEN,
  INFLUENCE_REGEN,
  MANA_REGEN,
  MILITARY_PAY,
  MINE_GOLD_OUTPUT,
  MINE_METAL_OUTPUT,
  PEASANT_BIRTH,
  PEASANT_EARNS,
  type ProvinceWithSci,
} from '@/lib/tick/rules';
import { followingScheduledTick } from '@/lib/tick/schedule';
import { finishTickMaintenance } from '@/lib/tick/maintenance';
import { internalErrorResponse } from '@/lib/operational-events';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${getCronSecret()}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await withSerializableTransaction(async tx => {
    const startedAt = Date.now();
    const now = new Date();
    const intervalMs = getTickIntervalMs();

    // The persisted schedule, not container uptime, is the source of truth.
    // On the first production run we align to the next UTC interval boundary.
    await tx.gameState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    await lockGameState(tx);
    const state = await tx.gameState.findUniqueOrThrow({ where: { id: 1 } });
    if (!state.nextTickAt) {
      const nextTickAt = nextTickBoundary(now, intervalMs);
      await tx.gameState.update({ where: { id: 1 }, data: { nextTickAt } });
      return { processed: false, initialized: true, nextTickAt: nextTickAt.toISOString() };
    }
    if (state.nextTickAt.getTime() > now.getTime()) {
      return { processed: false, initialized: false, nextTickAt: state.nextTickAt.toISOString() };
    }

    const scheduledFor = state.nextTickAt;
    const followingTickAt = followingScheduledTick(scheduledFor, now, intervalMs);
    const newTick = (state.tick ?? 0) + 1;

    // This unique insert is the idempotency claim. It is part of the same
    // transaction as every game mutation, so a crash rolls the claim and all
    // partial world changes back together.
    const tickRun = await tx.tickRun.create({
      data: {
        age: state.age ?? 1,
        tick: newTick,
        scheduledFor,
        durationMs: 0,
      },
    });

    if (newTick >= AGE_LENGTH + APOCALYPSE_LENGTH) {
      await endAgeInTransaction(tx, state.age ?? 1);
      const durationMs = Date.now() - startedAt;
      await tx.gameState.update({
        where: { id: 1 },
        data: { lastTickAt: scheduledFor, nextTickAt: followingTickAt, lastTickDurationMs: durationMs },
      });
      await tx.tickRun.update({ where: { id: tickRun.id }, data: { durationMs } });
      return {
        message: `Age ${state.age ?? 1} has ended; a new age begins.`,
        processed: true,
        ageEnded: true,
        scheduledFor: scheduledFor.toISOString(),
        nextTickAt: followingTickAt.toISOString(),
      };
    }

    const [races, kingdoms, advisors, warRelations] = await Promise.all([
      tx.race.findMany(),
      tx.kingdom.findMany({ select: { king: true, numProvinces: true } }),
      tx.advisor.findMany(),
      tx.kingdomRelation.findMany({ where: { type: 'war', status: 'active' }, select: { fromKiId: true, toKiId: true } }),
    ]);
    const raceById = new Map(races.map(r => [r.id, r]));
    const advisorById = new Map(advisors.map(a => [a.id, a]));
    const kingMultiplier = new Map(
      kingdoms
        .filter(k => k.king && k.king > 0)
        .map(k => [k.king, legacyKingProductionMultiplier(k.numProvinces)]),
    );
    const atWar = (a: number | null | undefined, b: number | null | undefined) =>
      !!a && !!b && warRelations.some(r => (r.fromKiId === a && r.toKiId === b) || (r.fromKiId === b && r.toKiId === a));

    const phase = newTick >= AGE_LENGTH ? 'Apocalypse' : 'Running';
    const season = legacySeasonForTick(newTick);
    const seasonMod = LEGACY_SEASON_MODIFIERS[season];

    // Sum of (level * bonusPerLevel) for a given science effect, in percent.
    const sciPct = (p: ProvinceWithSci, effect: string) =>
      (p.science ?? []).reduce((sum, s) => sum + (s.type.effect === effect ? s.level * s.type.bonusPerLevel : 0), 0);
    // Advisor bonus (percent) for a given effect, if the province has that advisor.
    const advisorPct = (p: ProvinceWithSci, effect: string) => {
      const a = p.councilId ? advisorById.get(p.councilId) : null;
      if (!a) return 0;
      return (a.effect === effect ? a.bonus : 0) + (a.effect2 === effect ? a.bonus2 : 0);
    };
    // Sum of active timed-effect magnitudes of a given type (percent).
    const effectPct = (p: ProvinceWithSci, type: string) =>
      (p.effects ?? []).reduce((s, e) => s + (e.type === type ? e.magnitude : 0), 0);
    const offMult = (p: ProvinceWithSci) =>
      ((raceById.get(p.raceId ?? 0)?.offenseBonus ?? 100) / 100) *
      (1 + (
        sciPct(p, 'offense')
        + sciPct(p, 'combatBoth')
        + sciPct(p, 'theology')
        + advisorPct(p, 'offense')
        + effectPct(p, 'battleFrenzy')
        - effectPct(p, 'curse')
        + activeSpellPercent(p.effects ?? [], 'attack')
      ) / 100);
    const defMult = (p: ProvinceWithSci) =>
      ((raceById.get(p.raceId ?? 0)?.defenseBonus ?? 100) / 100) *
      seasonMod.defense *
      (1 + (
        sciPct(p, 'defense')
        + sciPct(p, 'combatBoth')
        + advisorPct(p, 'defense')
        + effectPct(p, 'stoneSkin')
        - effectPct(p, 'curse')
        + activeSpellPercent(p.effects ?? [], 'defense')
      ) / 100);

    // ---------------- ATTACK RETURNS ----------------
    // Combat itself resolves immediately in the action handler in the legacy
    // game. Its tick stage only pays campaign income, counts down the return,
    // unloads loot, and restores three morale.
    const returningAttacks = await tx.attack.findMany({ where: { totick: { lte: 0 } } });
    const campaignIncomeByProvince = new Map<number, number>();
    for (const attack of returningAttacks) {
      campaignIncomeByProvince.set(
        attack.pID,
        (campaignIncomeByProvince.get(attack.pID) ?? 0) + attack.extraIncome,
      );
    }
    for (const attack of returningAttacks) {
      const backtick = attack.backtick - 1;
      if (backtick > 0) {
        await tx.attack.update({ where: { id: attack.id }, data: { backtick } });
        continue;
      }
      await tx.province.update({
        where: { id: attack.pID },
        data: {
          acres: { increment: attack.acres },
          gold: { increment: attack.gold },
          food: { increment: attack.food },
          metal: { increment: attack.metal },
        },
      });
      await tx.army.deleteMany({ where: { AttackID: attack.id } });
      await tx.attack.delete({ where: { id: attack.id } });
      await tx.news.create({ data: { pID: attack.pID, message: 'Your army has returned home from campaign.' } });
    }
    const moraleProvinces = await tx.province.findMany({
      where: { status: 'Alive', morale: { lt: 100 } },
      select: { id: true, morale: true },
    });
    for (const province of moraleProvinces) {
      await tx.province.update({
        where: { id: province.id },
        data: { morale: Math.min(100, (province.morale ?? 0) + 3) },
      });
    }

    // ---------------- MILITARY TRAINING ----------------
    // The old server deliberately runs this after Attack and before Explore.
    const militaryOrders = await tx.militaryOrder.findMany({
      where: { province: { vacation: false } },
    });
    if (militaryOrders.length) {
      const mTypes = await tx.militaryType.findMany();
      const mName = new Map(mTypes.map(m => [m.id, m.displayName ?? m.className]));
      for (const order of militaryOrders) {
        const left = order.ticksLeft - 1;
        if (left <= 0) {
          await tx.militaryOrder.delete({ where: { id: order.id } });
          await tx.news.create({
            data: {
              pID: order.pID,
              message: `Training complete: ${order.num} ${mName.get(order.mID) ?? 'troops'} ready for battle.`,
            },
          });
        } else {
          await tx.militaryOrder.update({ where: { id: order.id }, data: { ticksLeft: left } });
        }
      }
    }

    // ---------------- EXPLORATION ----------------
    const exploreOrders = await tx.exploreOrder.findMany({
      where: { province: { vacation: false } },
    });
    for (const order of exploreOrders) {
      const left = order.ticksLeft - 1;
      if (left <= 0) {
        await tx.province.update({ where: { id: order.pID }, data: { acres: { increment: order.acres } } });
        await tx.exploreOrder.delete({ where: { id: order.id } });
        await tx.news.create({
          data: { pID: order.pID, message: `Your expedition claimed ${order.acres} new acres of land.` },
        });
      } else {
        await tx.exploreOrder.update({ where: { id: order.id }, data: { ticksLeft: left } });
      }
    }

    // ---------------- CONSTRUCTION ----------------
    // The original completes buildings before applying this tick's economy, so
    // a structure produces resources on the tick it finishes. Vacation pauses it.
    const buildOrders = await tx.buildOrder.findMany({
      where: { province: { vacation: false } },
    });
    if (buildOrders.length) {
      const buildingTypes = await tx.buildingType.findMany();
      const buildingName = new Map(buildingTypes.map(type => [type.id, type.className]));
      for (const order of buildOrders) {
        const left = order.ticksLeft - 1;
        if (left <= 0) {
          const existing = await tx.building.findUnique({
            where: { pID_bID: { pID: order.pID, bID: order.bID } },
          });
          if (existing) {
            await tx.building.update({
              where: { id: existing.id },
              data: { num: { increment: order.num } },
            });
          } else {
            await tx.building.create({
              data: { pID: order.pID, bID: order.bID, num: order.num },
            });
          }
          await tx.buildOrder.delete({ where: { id: order.id } });
          await tx.news.create({
            data: {
              pID: order.pID,
              message: `Construction complete: ${order.num} ${canonicalBuildingName(buildingName.get(order.bID))}.`,
            },
          });
        } else {
          await tx.buildOrder.update({ where: { id: order.id }, data: { ticksLeft: left } });
        }
      }
    }

    // ---------------- RESEARCH ----------------
    // Research does not pause in vacation mode. A science completed here is
    // available to the economy and later legacy subsystems in this same tick.
    const researchOrders = await tx.researchOrder.findMany();
    if (researchOrders.length) {
      const scTypes = await tx.scienceType.findMany();
      const scName = new Map(scTypes.map(s => [s.id, s.name]));
      for (const order of researchOrders) {
        const left = order.ticksLeft - 1;
        if (left <= 0) {
          const existing = await tx.science.findUnique({
            where: { pID_scID: { pID: order.pID, scID: order.scID } },
          });
          if (existing) {
            await tx.science.update({ where: { id: existing.id }, data: { level: 1 } });
          } else {
            await tx.science.create({ data: { pID: order.pID, scID: order.scID, level: 1 } });
          }
          await tx.researchOrder.delete({ where: { id: order.id } });
          await tx.news.create({
            data: { pID: order.pID, message: `Research complete: ${scName.get(order.scID) ?? 'a science'}.` },
          });
        } else {
          await tx.researchOrder.update({ where: { id: order.id }, data: { ticksLeft: left } });
        }
      }
    }

    // ---------------- ACTIVE LEGACY SPELLS ----------------
    // The original Magic stage runs before province economy. Most spell
    // effects are multipliers consumed below; these three perform direct work
    // every tick.
    const activeLegacySpells = await tx.effect.findMany({
      where: { type: { in: ['DoomSpell', 'DrainSpell', 'ResurrectSpell'] } },
    });
    for (const effect of activeLegacySpells) {
      const strength = Math.max(.0001, Math.min(1, effect.magnitude / 100));
      const target = await tx.province.findUnique({
        where: { id: effect.pID },
        include: { military: { include: { type: true } } },
      });
      if (!target) continue;
      if (effect.type === 'DoomSpell') {
        const rate = (.005 + Math.random() * .01) * strength;
        const peasants = Math.floor((target.peasants ?? 0) * rate);
        if (peasants) await tx.province.update({ where: { id: target.id }, data: { peasants: { decrement: peasants } } });
        for (const unit of target.military) {
          const loss = Math.floor(unit.num * rate);
          if (loss) {
            await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: loss } } });
            await recordDeadMilitary(tx, target.id, unit.mID, loss);
          }
        }
      } else if (effect.type === 'DrainSpell') {
        const drained = Math.min(target.mana ?? 0, Math.max(1, Math.floor((1 + Math.random() * 6) * strength)));
        if (drained) {
          await tx.province.update({ where: { id: target.id }, data: { mana: { decrement: drained } } });
          if (effect.sourcePID) await tx.province.update({ where: { id: effect.sourcePID }, data: { mana: { increment: drained } } });
        }
      } else {
        const dead = await tx.deadMilitary.findMany({ where: { pID: target.id } });
        for (const fallen of dead) {
          const minimum = Math.round(fallen.num * strength * .025);
          const maximum = Math.round(fallen.num * strength * .2);
          const raised = Math.min(fallen.num, minimum + Math.floor(Math.random() * (Math.max(minimum, maximum) - minimum + 1)));
          if (!raised) continue;
          await tx.militaryUnit.update({
            where: { pID_mID: { pID: target.id, mID: fallen.mID } },
            data: { num: { increment: raised } },
          });
          if (raised >= fallen.num) await tx.deadMilitary.delete({ where: { id: fallen.id } });
          else await tx.deadMilitary.update({ where: { id: fallen.id }, data: { num: { decrement: raised } } });
        }
      }
    }

    // ---------------- ECONOMY ----------------
    const provinces = await tx.province.findMany({
      where: { status: 'Alive', acres: { gt: 0 } },
      include: {
        buildings: { include: { type: true } },
        military: { include: { type: true } },
        militaryOrders: true,
        researchOrders: true,
        science: { include: { type: true } },
        effects: true,
      },
    });
    const apocalypseRemaining = AGE_LENGTH + APOCALYPSE_LENGTH - newTick;
    const apocalypseMessage = apocalypseRemaining === 500
      ? 'Our council has fled in fear of the Apocalypse!'
      : apocalypseRemaining === 440
        ? 'An Apocalyptic shockwave has decimated our population.'
        : apocalypseRemaining === 240
          ? 'The Apocalypse has drained mana from the world.'
          : apocalypseRemaining === 150
            ? 'Our troops have lost their morale as the Apocalypse closes in.'
            : apocalypseRemaining === 100
              ? 'Our thieves have fled the lands as the Apocalypse approaches.'
              : null;
    if (apocalypseMessage && provinces.length) {
      await tx.news.createMany({
        data: provinces.map(province => ({ pID: province.id, message: apocalypseMessage })),
      });
    }
    if (apocalypseRemaining === 500) {
      await tx.province.updateMany({ data: { councilId: 0 } });
    } else if (apocalypseRemaining === 150) {
      await tx.province.updateMany({ data: { morale: 50 } });
    }

    const countBuilding = (p: (typeof provinces)[number], className: string) =>
      p.buildings.reduce(
        (sum, building) => sum + (canonicalBuildingName(building.type.className) === className ? building.num : 0),
        0,
      );

    let updatedCount = 0;
    for (const p of provinces) {
      if (p.peasants == null || p.gold == null || p.food == null || p.metal == null) continue;
      const race = raceById.get(p.raceId ?? 0);
      const raceMods = legacyRaceModifiers(race?.name);
      const manaBeforeRegen = apocalypseRemaining === 240 ? 50 : (p.mana ?? 0);
      const influenceBeforeRegen = apocalypseRemaining === 100 ? 50 : (p.influence ?? 0);
      const theologyRegen = sciPct(p, 'theology') > 0 ? 1 : 0;
      const newMana = Math.min(raceMods.manaCap, manaBeforeRegen + MANA_REGEN + theologyRegen);
      const newInfluence = Math.min(raceMods.influenceCap, influenceBeforeRegen + INFLUENCE_REGEN + theologyRegen);

      // The old prepareTick increments age for every province. Magic and
      // thievery also regenerate during vacation even though its economy and
      // action queues are frozen.
      if (p.vacation) {
        await tx.province.update({
          where: { id: p.id },
          data: {
            aliveTicks: { increment: 1 },
            vacationTicks: { increment: 1 },
            mana: newMana,
            influence: newInfluence,
            aidSentTick: 0,
          },
        });
        continue;
      }

      const farms = countBuilding(p, 'Farm');
      const mines = countBuilding(p, 'Mine');
      const homes = countBuilding(p, 'Home');
      const temples = countBuilding(p, 'Temple');
      const crypts = countBuilding(p, 'Crypt');
      const barracks = countBuilding(p, 'Barrack');
      const docks = countBuilding(p, 'Dock');
      const marketplaces = countBuilding(p, 'Marketplace');
      const totalMilitary = p.military.reduce((sum, u) => sum + u.num, 0);
      const acres = p.acres || 0;

      const productionKingBonus = kingMultiplier.get(p.id) ?? 1;
      const incomeMult =
        raceMods.goldIncome *
        (1 + (sciPct(p, 'income') + advisorPct(p, 'income')) / 100) *
        productionKingBonus *
        (1 + effectPct(p, 'haste') / 100) *
        (1 + activeSpellPercent(p.effects, 'gold') / 100) *
        (1 - effectPct(p, 'Riots') / 100);

      const marketMultiplier = 1 + buildingEffect(marketplaces, acres, 3, 40);
      const newProvinceIncomeBoost = (p.aliveTicks + 1) < 24 && (p.aliveTicks + 1) > 0 ? 1.1 : 1;
      const goldIncome = Math.floor(
        (p.peasants * PEASANT_EARNS * newProvinceIncomeBoost
          + mines * MINE_GOLD_OUTPUT
          + (temples + crypts) * 100
          + docks * 50
          + (campaignIncomeByProvince.get(p.id) ?? 0))
        * incomeMult
        * marketMultiplier,
      );
      // Original Barracks reduce military gold cost by 2% per 1% land, capped at 25%.
      const upkeepReduction = Math.min(0.5, buildingEffect(barracks, acres, 2, 25));
      const goldUpkeep = Math.floor(
        totalMilitary * MILITARY_PAY * (1 - upkeepReduction) * (1 + effectPct(p, 'SabotageArmy') / 100),
      );
      const netGold = goldIncome - goldUpkeep;

      const foodProduced = Math.floor(
        (farms * FARM_FOOD + docks * 15)
        * (1 + (sciPct(p, 'foodProduction') + advisorPct(p, 'foodProduction')) / 100)
        * raceMods.foodIncome
        * productionKingBonus
        * marketMultiplier
        * (1 + activeSpellPercent(p.effects, 'food') / 100),
      );
      const foodEaten = Math.floor((p.peasants + totalMilitary) * FOOD_EATEN);
      const netFood = foodProduced - foodEaten;

      const metalProduced = Math.floor(
        (mines * MINE_METAL_OUTPUT + docks * 15)
        * (1 + sciPct(p, 'metalProduction') / 100)
        * raceMods.metalIncome
        * seasonMod.metalIncome
        * productionKingBonus
        * marketMultiplier
        * (1 + activeSpellPercent(p.effects, 'metal') / 100),
      ) + ((p.aliveTicks + 1) < 24 && (p.aliveTicks + 1) > 0 ? acres * 5 : 0);

      // BuildingBase houses 20 people by default. Homes house 40, Docks 25,
      // and Walls 10; each replaces the base 15-person acre.
      const housing = legacyPeasantHousing(
        acres,
        p.buildings,
        raceMods.peasantHousing,
        sciPct(p, 'housing'),
      );
      const growthMultiplier = Math.max(
        0,
        1
          + buildingEffect(homes, acres, 1)
          + buildingEffect(temples, acres, 5, 20)
          + buildingEffect(crypts, acres, 5, 20)
          + buildingEffect(docks, acres, -1, 20),
      );
      const peasantBirth = p.peasants < housing
        ? Math.min(
            Math.floor(
              p.peasants
              * PEASANT_BIRTH
              * (newTick < 50 ? 1.3 : 1)
              * raceMods.peasantGrowth
              * seasonMod.peasantGrowth
              * growthMultiplier
              * (1 + activeSpellPercent(p.effects, 'growth') / 100),
            ),
            housing - p.peasants,
          )
        : 0;

      let newFood = p.food + netFood;
      const verminPct = effectPct(p, 'verminPlague');
      if (verminPct > 0) newFood -= Math.floor(p.food * verminPct / 100);
      const peasantsBeforeGrowth = apocalypseRemaining === 440
        ? Math.floor(p.peasants / 2)
        : p.peasants;
      let newPeasants = peasantsBeforeGrowth + peasantBirth;
      let peasantChange = peasantBirth;

      let newGold = p.gold + netGold;
      let newMetal = p.metal + metalProduced;
      const badResources = newFood < 0 || newGold < 0 || newMetal < 0;
      if (newFood < 0) {
        // The original first reverses this tick's growth, then removes twice
        // that change again in handleBadResources.
        peasantChange = -Math.abs(peasantBirth);
        newPeasants = Math.max(0, p.peasants + peasantChange - Math.abs(peasantChange * 2));
        newGold -= Math.abs(goldIncome) * 0.5;
      }

      const overpopulated =
        (housing - totalMilitary - newPeasants) < -acres
        || (totalMilitary > housing * 0.9
          && (housing - totalMilitary - newPeasants) < housing * 0.05);
      if ((badResources || overpopulated) && (p.protection ?? 0) <= 0) {
        const lossRate = badResources
          ? 0.004
          : (AGE_LENGTH - newTick < 50 ? 0.012 : 0.006);
        let lost = 0;
        for (const unit of p.military) {
          const dead = Math.floor(unit.num * lossRate);
          if (dead > 0) {
            await tx.militaryUnit.update({
              where: { id: unit.id },
              data: { num: { decrement: dead } },
            });
            lost += dead;
          }
        }
        if (lost > 0) {
          const reason = badResources ? 'shortages' : 'a lack of housing';
          await tx.news.create({
            data: { pID: p.id, message: `${lost.toLocaleString()} military units were lost because of ${reason}.` },
          });
        }
      }

      newGold = Math.max(0, Math.floor(newGold));
      newFood = Math.max(0, Math.floor(newFood));
      newMetal = Math.max(0, Math.floor(newMetal));

      const totalBuildings = p.buildings.reduce((sum, b) => sum + b.num, 0);
      const scienceCount = p.science.length + p.researchOrders.length;
      const newNetworth = legacyProvinceNetworth({
        gold: newGold,
        food: newFood,
        metal: newMetal,
        peasants: newPeasants,
        acres,
        buildings: totalBuildings,
        sciences: scienceCount,
        military: p.military,
        training: p.militaryOrders,
      });

      await tx.province.update({
        where: { id: p.id },
        data: {
          gold: newGold,
          food: newFood,
          metal: newMetal,
          peasants: newPeasants,
          incomeChange: netGold,
          incomeTotal: { increment: netGold },
          foodChange: netFood,
          foodTotal: { increment: netFood },
          metalChange: metalProduced,
          metalTotal: { increment: metalProduced },
          peasantChange,
          peasantTotal: { increment: peasantChange },
          networth: newNetworth,
          protection: Math.max(0, (p.protection ?? 0) - 1),
          aliveTicks: { increment: 1 },
          mana: newMana,
          influence: newInfluence,
          aidSentTick: 0,
        },
      });
      updatedCount++;
    }

    // ---------------- RANKINGS ----------------
    // Rank movement is presentation only; never let it fail the world tick.
    try {
      await refreshNetworthRanks(tx, newTick);
    } catch (rankError) {
      console.error('Networth rank refresh failed:', rankError);
    }

    // ---------------- COMBAT ----------------
    const attacks = await tx.attack.findMany({
      where: { totick: { gt: 0 } },
      include: {
        armies: { include: { type: true } },
        attacker: {
          include: {
            science: { include: { type: true } },
            buildings: { include: { type: true } },
            effects: true,
          },
        },
        defender: {
          include: {
            military: { include: { type: true } },
            militaryOrders: true,
            outgoingAttacks: { include: { armies: true } },
            science: { include: { type: true } },
            buildings: { include: { type: true } },
            effects: true,
          },
        },
      },
    });

    for (const attack of attacks) {
      if (attack.totick > 0) {
        const newTotick = attack.totick - 1;
        if (newTotick > 0) {
          await tx.attack.update({ where: { id: attack.id }, data: { totick: newTotick } });
          continue;
        }

        // --- resolve combat ---
        const def = attack.defender;
        const atkName = attack.attacker.provinceName ?? 'A rival';
        const defName = def.provinceName ?? 'a rival';

        // Newbie protection or vacation: army withdraws, no combat.
        if ((def.protection ?? 0) > 0 || def.vacation) {
          await tx.attack.update({ where: { id: attack.id }, data: { totick: 0, backtick: 3 } });
          await tx.news.create({ data: { pID: attack.pID, message: `${defName} was under protection; your army withdrew without fighting.` } });
          continue;
        }

        const offenseRaw = attack.armies.reduce((s, a) => s + a.num * a.type.attack, 0);
        const trainingByType = new Map<number, number>();
        for (const order of def.militaryOrders) {
          trainingByType.set(order.mID, (trainingByType.get(order.mID) ?? 0) + order.num);
        }
        const awayByType = new Map<number, number>();
        for (const outbound of def.outgoingAttacks) {
          for (const army of outbound.armies) {
            awayByType.set(army.mID, (awayByType.get(army.mID) ?? 0) + army.num);
          }
        }
        const defenseRaw = def.military.reduce(
          (sum, unit) =>
            sum + Math.max(
              0,
              unit.num
                - (trainingByType.get(unit.mID) ?? 0)
                - (awayByType.get(unit.mID) ?? 0),
            ) * unit.type.defense,
          0,
        );
        const blacksmiths = attack.attacker.buildings.reduce(
          (sum, building) => sum + (canonicalBuildingName(building.type.className) === 'Blacksmith' ? building.num : 0),
          0,
        );
        const walls = def.buildings.reduce(
          (sum, building) => sum + (canonicalBuildingName(building.type.className) === 'Wall' ? building.num : 0),
          0,
        );

        const warBonus = atWar(attack.attacker.kiID, def.kiID) ? 1.1 : 1;
        const offense = offenseRaw
          * offMult(attack.attacker)
          * (1 + buildingEffect(blacksmiths, attack.attacker.acres ?? 0, 2, 20))
          * warBonus;
        const defense = defenseRaw
          * defMult(def)
          * (1 + buildingEffect(walls, def.acres ?? 0, 2, 10));
        const win = offense > defense;

        const prof = combatProfile(attack.attackType);
        const attackerLoss = win ? prof.winAtk : prof.loseAtk;
        const defenderLoss = win ? prof.winDef : prof.loseDef;

        // Attacker casualties: shrink the deployed Army rows to survivors.
        for (const a of attack.armies) {
          const survivors = Math.floor(a.num * (1 - attackerLoss));
          await tx.army.update({ where: { id: a.id }, data: { num: survivors } });
          const killed = a.num - survivors;
          if (killed > 0) {
            await tx.militaryUnit.updateMany({
              where: { pID: attack.pID, mID: a.mID, num: { gte: killed } },
              data: { num: { decrement: killed } },
            });
          }
        }
        // Defender casualties.
        for (const d of def.military) {
          const ready = Math.max(
            0,
            d.num - (trainingByType.get(d.mID) ?? 0) - (awayByType.get(d.mID) ?? 0),
          );
          const killed = Math.floor(ready * defenderLoss);
          if (killed > 0) await tx.militaryUnit.update({ where: { id: d.id }, data: { num: { decrement: killed } } });
        }

        if (win) {
          const acres = Math.floor((def.acres || 0) * prof.land);
          const gold = Math.floor((def.gold || 0) * prof.resource);
          const food = Math.floor((def.food || 0) * prof.resource);
          const metal = Math.floor((def.metal || 0) * prof.resource);

          await tx.province.update({
            where: { id: attack.targetID },
            data: {
              acres: { decrement: acres },
              gold: { decrement: gold },
              food: { decrement: food },
              metal: { decrement: metal },
            },
          });
          await reconcileLandLoss(tx, attack.targetID, def.acres ?? 0, acres);
          await tx.attack.update({ where: { id: attack.id }, data: { totick: 0, backtick: 3, acres, gold, food, metal } });
          await tx.news.create({ data: { pID: attack.pID, message: `Victory! Your army overran ${defName}, seizing ${acres} acres and plunder.` } });
          await tx.news.create({ data: { pID: attack.targetID, message: `${atkName} invaded and captured ${acres} of your acres!` } });
        } else {
          await tx.attack.update({ where: { id: attack.id }, data: { totick: 0, backtick: 3 } });
          await tx.news.create({ data: { pID: attack.pID, message: `Defeat. ${defName} repelled your assault and your army fled home.` } });
          await tx.news.create({ data: { pID: attack.targetID, message: `You repelled an invasion from ${atkName}!` } });
        }
      } else if (attack.backtick > 0) {
        const newBacktick = attack.backtick - 1;
        if (newBacktick > 0) {
          await tx.attack.update({ where: { id: attack.id }, data: { backtick: newBacktick } });
          continue;
        }

        // --- army returns home with survivors + any loot ---
        await tx.province.update({
          where: { id: attack.pID },
          data: {
            acres: { increment: attack.acres },
            gold: { increment: attack.gold },
            food: { increment: attack.food },
            metal: { increment: attack.metal },
          },
        });

        await tx.army.deleteMany({ where: { AttackID: attack.id } });
        await tx.attack.delete({ where: { id: attack.id } });
        await tx.news.create({ data: { pID: attack.pID, message: `Your army has returned home from campaign.` } });
      }
    }

    // ---------------- TIMED EFFECTS ----------------
    // Effects were active for both economy and combat above; now age them out.
    const effects = await tx.effect.findMany();
    for (const e of effects) {
      const left = e.ticksLeft - 1;
      if (left <= 0) await tx.effect.delete({ where: { id: e.id } });
      else await tx.effect.update({ where: { id: e.id }, data: { ticksLeft: left } });
    }
    await tx.deadMilitary.deleteMany({ where: { ticks: { lte: 1 } } });
    await tx.deadMilitary.updateMany({ where: { ticks: { gt: 1 } }, data: { ticks: { decrement: 1 } } });
    await finishTickMaintenance(tx, now);

    const durationMs = Date.now() - startedAt;
    await tx.gameState.update({
      where: { id: 1 },
      data: {
        tick: newTick,
        season,
        phase,
        lastTickAt: scheduledFor,
        nextTickAt: followingTickAt,
        lastTickDurationMs: durationMs,
      },
    });
    await tx.tickRun.update({
      where: { id: tickRun.id },
      data: { durationMs, provincesUpdated: updatedCount },
    });

    return {
      message: 'Tick processed successfully',
      processed: true,
      age: state.age ?? 1,
      tick: newTick,
      provincesUpdated: updatedCount,
      durationMs,
      scheduledFor: scheduledFor.toISOString(),
      nextTickAt: followingTickAt.toISOString(),
    };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // A competing scheduler may win the unique tick claim or a serializable
    // transaction may be retried. The worker calls again shortly, so neither is
    // a fatal tick failure and no partial mutations have committed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      return NextResponse.json({ processed: false, retry: true, message: 'Tick already claimed; retry shortly.' }, { status: 202 });
    }
    return internalErrorResponse(request, '/api/cron/tick', error);
  }
}

// Vercel Cron invokes endpoints with GET (and sends Authorization: Bearer
// $CRON_SECRET automatically when CRON_SECRET is set), so delegate GET to POST.
export async function GET(request: NextRequest) {
  return POST(request);
}
