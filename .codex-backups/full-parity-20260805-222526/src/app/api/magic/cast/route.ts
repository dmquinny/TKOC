import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { scienceKnowledge } from '@/lib/science';
import {
  activeSpellPercent,
  knowledgeAllows,
  LEGACY_SPELL_BY_NAME,
  LEGACY_SPELLS,
  legacySpellStrength,
  manaTransferReceived,
} from '@/lib/legacy-magic';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { reconcileLandLoss } from '@/lib/province-lifecycle';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';
import { consumeRateLimit } from '@/lib/rate-limit';

const hostileSpellClasses = new Set(LEGACY_SPELLS.filter(spell => spell.target === 'hostile').map(spell => spell.className));
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

    const [targets, me, wizardUnit, trainingOrders, maintained] = await Promise.all([
      prisma.province.findMany({
        where: { status: 'Alive', acres: { gt: 0 } },
        select: { id: true, provinceName: true, rulerName: true, networth: true, acres: true, kiID: true, raceId: true },
        orderBy: { provinceName: 'asc' },
      }),
      prisma.province.findUnique({
        where: { id: pID },
        include: { science: { include: { type: true } } },
      }),
      prisma.militaryUnit.findFirst({ where: { pID, type: { category: 'wizards' } } }),
      prisma.militaryOrder.findMany({ where: { pID }, select: { mID: true, num: true } }),
      prisma.effect.aggregate({ where: { sourcePID: pID }, _sum: { wizards: true } }),
    ]);
    if (!me) return NextResponse.json({ error: 'Province not found' }, { status: 404 });

    const race = me.raceId ? await prisma.race.findUnique({ where: { id: me.raceId } }) : null;
    const knowledge = scienceKnowledge(me.science);
    const availableWizards = Math.max(
      0,
      (wizardUnit?.num ?? 0)
        - trainingOrders.filter(order => order.mID === wizardUnit?.mID).reduce((sum, order) => sum + order.num, 0)
        - (maintained._sum.wizards ?? 0),
    );

    return NextResponse.json({
      targets,
      availableWizards,
      mana: me.mana ?? 0,
      resources: { gold: me.gold ?? 0, metal: me.metal ?? 0, food: me.food ?? 0, peasants: me.peasants ?? 0 },
      myProvinceId: pID,
      myKingdomId: me.kiID,
      spells: LEGACY_SPELLS.map(spell => {
        const raceAllowed = !spell.races || spell.races.includes(race?.name ?? '');
        const scienceAllowed = knowledgeAllows(spell.req, knowledge);
        return { ...spell, available: raceAllowed && scienceAllowed };
      }),
    });
  } catch (error) {
    return internalErrorResponse(request, '/api/magic/cast GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const rate = await consumeRateLimit(`magic:${pID}`, 30, 60_000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/magic/cast', 'Magic action rate limit exceeded', { pID });
      return NextResponse.json(
        { error: 'You are casting spells too quickly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }
    const body = await request.json();
    const def = LEGACY_SPELL_BY_NAME.get(String(body.spell ?? ''));
    if (!def) return NextResponse.json({ error: 'Unknown spell' }, { status: 400 });
    const targetID = Number(body.targetID);
    const channel = Math.floor(Number(body.wizardsToChannel));
    const duration = def.mode === 'timed' ? Math.floor(Number(body.duration ?? 1)) : 1;
    if (!Number.isSafeInteger(targetID) || !Number.isSafeInteger(channel) || channel < 1 || channel > 100_000_000) {
      return NextResponse.json({ error: 'Select a target and channel at least one wizard' }, { status: 400 });
    }
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 24) {
      return NextResponse.json({ error: 'Spell duration must be between 1 and 24 ticks' }, { status: 400 });
    }

    const result = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [pID, targetID]);
      const [me, target] = await Promise.all([
        tx.province.findUnique({
          where: { id: pID },
          include: {
            science: { include: { type: true } },
            military: { include: { type: true } },
            effects: true,
          },
        }),
        tx.province.findUnique({
          where: { id: targetID },
          include: {
            military: { include: { type: true } },
            buildings: { include: { type: true } },
            effects: true,
          },
        }),
      ]);
      if (!me || !target) throw new Error('Target not found');
      if (me.status !== 'Alive' || (me.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (target.status !== 'Alive' || (target.acres ?? 0) <= 0) throw new Error('Target is no longer active');
      if (me.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');

      const [myRace, targetRace] = await Promise.all([
        me.raceId ? tx.race.findUnique({ where: { id: me.raceId } }) : null,
        target.raceId ? tx.race.findUnique({ where: { id: target.raceId } }) : null,
      ]);
      const isSelf = pID === targetID;
      const sameKingdom = Boolean(me.kiID && me.kiID === target.kiID);
      if (def.target === 'self' && !isSelf) throw new Error('This spell can only be cast on your own province');
      if (def.target === 'hostile' && isSelf) throw new Error('This spell cannot target your own province');
      if (def.target === 'friendly' && !isSelf && (!def.kingdom || !sameKingdom)) {
        throw new Error('This spell can only target your own kingdom');
      }
      if (def.className === 'ManaTransferSpell' && isSelf) {
        throw new Error('Mana Transfer must target another province in your kingdom');
      }
      if (def.target === 'hostile' && ((me.protection ?? 0) > 0 || (target.protection ?? 0) > 0 || target.vacation)) {
        throw new Error('Protection prevents hostile magic');
      }
      if (def.races && !def.races.includes(myRace?.name ?? '')) throw new Error('Your race cannot cast this spell');
      if (def.targetRaces && !def.targetRaces.includes(targetRace?.name ?? '')) throw new Error('That target is not affected by this spell');
      if (def.immuneRaces?.includes(targetRace?.name ?? '')) throw new Error('That race is immune to this spell');

      const knowledge = scienceKnowledge(me.science);
      if (!knowledgeAllows(def.req, knowledge)) throw new Error('You lack the science required for this spell');

      const wizardUnit = me.military.find(unit => unit.type.category === 'wizards');
      const targetWizardUnit = target.military.find(unit => unit.type.category === 'wizards');
      const [training, targetTraining, maintained] = await Promise.all([
        wizardUnit ? tx.militaryOrder.aggregate({ where: { pID, mID: wizardUnit.mID }, _sum: { num: true } }) : null,
        targetWizardUnit ? tx.militaryOrder.aggregate({ where: { pID: targetID, mID: targetWizardUnit.mID }, _sum: { num: true } }) : null,
        tx.effect.aggregate({ where: { sourcePID: pID }, _sum: { wizards: true } }),
      ]);
      const readyWizards = Math.max(0, (wizardUnit?.num ?? 0) - (training?._sum.num ?? 0) - (maintained._sum.wizards ?? 0));
      const targetWizards = Math.max(0, (targetWizardUnit?.num ?? 0) - (targetTraining?._sum.num ?? 0));
      if (readyWizards < channel) throw new Error('Not enough Wizards');

      const wizardUse = 1 + me.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'wizardUse' ? entry.level * entry.type.bonusPerLevel : 0),
        0,
      ) / 100;
      const targetAcres = Math.max(1, target.acres ?? 0);
      const neededWizards = Math.max(1, Math.ceil(def.wizards * targetAcres * wizardUse));
      const manaUsed = Math.ceil(Math.max(5, def.mana, def.mana * targetAcres * def.wizards * wizardUse / channel));
      const tradeModifier = Math.max(.1, 1 + me.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'tradeCosts'
          ? entry.level * entry.type.bonusPerLevel
          : 0),
        0,
      ) / 100);
      const resourceCost = {
        gold: Math.ceil(def.gold * targetAcres * tradeModifier),
        metal: Math.ceil(def.metal * targetAcres * tradeModifier),
        food: Math.ceil(def.food * targetAcres * tradeModifier),
        peasants: Math.ceil(def.peasants * targetAcres * tradeModifier),
      };
      const transferPool = def.className === 'ManaTransferSpell' ? 50 : 0;
      if ((me.mana ?? 0) < manaUsed + transferPool) {
        throw new Error(`Not enough mana (requires ${manaUsed + transferPool})`);
      }
      if ((me.gold ?? 0) < resourceCost.gold || (me.metal ?? 0) < resourceCost.metal
        || (me.food ?? 0) < resourceCost.food || (me.peasants ?? 0) < resourceCost.peasants) {
        throw new Error('Not enough resources for this spell');
      }

      const [advisor, targetAdvisor] = await Promise.all([
        me.councilId ? tx.advisor.findUnique({ where: { id: me.councilId } }) : null,
        target.councilId ? tx.advisor.findUnique({ where: { id: target.councilId } }) : null,
      ]);
      const advisorMagic = (advisor?.effect === 'magic' ? advisor.bonus : 0) + (advisor?.effect2 === 'magic' ? advisor.bonus2 : 0);
      const advisorProtection = (targetAdvisor?.effect === 'magicProtection' ? targetAdvisor.bonus : 0)
        + (targetAdvisor?.effect2 === 'magicProtection' ? targetAdvisor.bonus2 : 0);
      const scienceMagic = me.science.reduce(
        (sum, entry) => sum + (entry.type.effect === 'magic' ? entry.level * entry.type.bonusPerLevel : 0),
        0,
      );
      const castingPower = Math.max(.01, ((myRace?.magicBonus ?? 100) / 100) * (1 + (scienceMagic + advisorMagic) / 100));
      const protection = Math.max(
        .01,
        1 + (activeSpellPercent(target.effects, 'magicProtection') + advisorProtection) / 100,
      );
      const randomMana = Math.round(randomInt(1, 100) * protection / castingPower);
      const randomDuration = Math.round(randomInt(1, 72) * castingPower / protection);
      const ownWpaRoll = def.target === 'hostile' ? randomInt(1, Math.max(1, readyWizards * 1000)) / Math.max(1, me.acres ?? 0) * 3 : 0;
      const targetWpaRoll = def.target === 'hostile' ? randomInt(1, Math.max(1, targetWizards * 1000)) / targetAcres : 0;
      const randomNeeded = randomInt(1, Math.max(1, Math.ceil(neededWizards / castingPower)));
      const success = randomMana <= 95
        && randomMana <= (me.mana ?? 0)
        && randomDuration > duration
        && ownWpaRoll >= targetWpaRoll
        && randomNeeded <= channel;

      await tx.province.update({
        where: { id: pID },
        data: {
          mana: { decrement: manaUsed },
          gold: { decrement: resourceCost.gold },
          metal: { decrement: resourceCost.metal },
          food: { decrement: resourceCost.food },
          peasants: { decrement: resourceCost.peasants },
        },
      });

      if (!success) {
        let lost = 0;
        if (wizardUnit && randomInt(1, 3) === 1) {
          lost = randomInt(1, Math.max(1, Math.ceil(channel / 10)));
          await tx.militaryUnit.update({ where: { id: wizardUnit.id }, data: { num: { decrement: Math.min(lost, wizardUnit.num) } } });
        }
        return { success: false, message: `The spell failed.${lost ? ` ${lost.toLocaleString()} wizards were lost.` : ''}`, manaUsed };
      }

      const friendly = def.target !== 'hostile';
      const strength = legacySpellStrength(me.acres ?? 0, targetAcres, readyWizards, targetWizards, friendly);
      const scaled = (min: number, max: number) => (min + Math.random() * (max - min)) * strength;
      const targetName = target.provinceName ?? 'the target';
      let message = `${def.name} succeeded against ${targetName}.`;

      if (def.mode === 'timed') {
        const existing = target.effects.filter(effect => effect.type === def.className);
        const maxStack = def.maxStack ?? 1;
        if (existing.length >= maxStack) {
          const replace = existing.sort((a, b) => a.ticksLeft - b.ticksLeft)[0];
          await tx.effect.update({
            where: { id: replace.id },
            data: { ticksLeft: duration, magnitude: Math.round(strength * 100), sourcePID: pID, wizards: channel },
          });
        } else {
          await tx.effect.create({
            data: { pID: targetID, type: def.className, magnitude: Math.round(strength * 100), ticksLeft: duration, sourcePID: pID, wizards: channel },
          });
        }
        message = `${def.name} will affect ${targetName} for ${duration} ticks.`;
      } else if (def.mode === 'dispel') {
        const removable = target.effects.find(effect => LEGACY_SPELLS.some(spell => spell.className === effect.type));
        if (removable) await tx.effect.delete({ where: { id: removable.id } });
        message = removable ? `${removable.type} was dispelled from ${targetName}.` : `${targetName} had no active spell to dispel.`;
      } else if (def.className === 'FireworksSpell') {
        const amount = Math.max(1, Math.round(scaled(5, 15)));
        await tx.province.update({ where: { id: targetID }, data: { morale: { increment: Math.min(amount, 100 - (target.morale ?? 0)) } } });
        message = `Fireworks raised ${targetName}'s morale by ${amount}%.`;
      } else if (def.className === 'RainSpell' || def.className === 'FearSpell') {
        const amount = Math.max(1, Math.round(scaled(def.className === 'FearSpell' ? 8 : 5, 15)));
        await tx.province.update({ where: { id: targetID }, data: { morale: { decrement: Math.min(amount, target.morale ?? 0) } } });
        message = `${def.name} lowered ${targetName}'s morale by ${amount}%.`;
      } else if (def.className === 'GrowthSpell') {
        const acres = Math.max(1, Math.round(scaled(5, 10)));
        await tx.province.update({ where: { id: targetID }, data: { acres: { increment: acres } } });
        message = `${targetName} grew by ${acres} acres.`;
      } else if (def.className === 'ManaTransferSpell') {
        const received = manaTransferReceived(randomInt(70, 99), transferPool);
        const manaCap = targetRace?.name === 'Elf' ? 110 : 100;
        const accepted = Math.max(0, Math.min(received, manaCap - (target.mana ?? 0)));
        await tx.province.update({ where: { id: pID }, data: { mana: { decrement: transferPool } } });
        if (accepted) {
          await tx.province.update({ where: { id: targetID }, data: { mana: { increment: accepted } } });
        }
        message = `${targetName} received ${accepted} mana${accepted < received ? ' (limited by its mana capacity)' : ''}.`;
      } else if (def.className === 'CleanseSpell') {
        const removed = await tx.effect.deleteMany({ where: { pID: targetID, type: { in: [...hostileSpellClasses] } } });
        message = `Cleanse removed ${removed.count} hostile spell${removed.count === 1 ? '' : 's'} from ${targetName}.`;
      } else if (def.className === 'BugInfestationSpell') {
        let returned = 0;
        for (const building of target.buildings) {
          const count = Math.min(building.num, Math.floor(building.num * scaled(.05, .2)));
          if (!count) continue;
          await tx.building.update({ where: { id: building.id }, data: { num: { decrement: count } } });
          await tx.buildOrder.create({ data: { pID: targetID, bID: building.bID, num: count, ticksLeft: randomInt(10, 20) } });
          returned += count;
        }
        message = `Bug Infestation returned ${returned.toLocaleString()} buildings to construction.`;
      } else if (def.className === 'EarthQuakeSpell' || def.className === 'ApocalypseSpell') {
        const apocalypse = def.className === 'ApocalypseSpell';
        const acresLost = Math.floor((target.acres ?? 0) * scaled(apocalypse ? .075 : .05, apocalypse ? .15 : .08));
        const peasantsLost = Math.floor((target.peasants ?? 0) * scaled(apocalypse ? .075 : .03, apocalypse ? .15 : .10));
        let troopsLost = 0;
        for (const unit of target.military) {
          const loss = Math.floor(unit.num * scaled(apocalypse ? .075 : .01, apocalypse ? .15 : .03));
          if (loss) await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: loss } } });
          troopsLost += loss;
        }
        await tx.province.update({
          where: { id: targetID },
          data: apocalypse
            ? {
                acres: { decrement: Math.min(acresLost, target.acres ?? 0) },
                peasants: { decrement: Math.min(peasantsLost, target.peasants ?? 0) },
                morale: { decrement: Math.floor((target.morale ?? 0) * .75 * strength) },
                mana: { decrement: Math.floor((target.mana ?? 0) * strength) },
                influence: { decrement: Math.floor((target.influence ?? 0) * strength) },
                gold: { decrement: Math.floor((target.gold ?? 0) * .9 * strength) },
                metal: { decrement: Math.floor((target.metal ?? 0) * .9 * strength) },
                food: { decrement: Math.floor((target.food ?? 0) * .25 * strength) },
              }
            : {
                acres: { decrement: Math.min(acresLost, target.acres ?? 0) },
                peasants: { decrement: Math.min(peasantsLost, target.peasants ?? 0) },
              },
        });
        const landResult = acresLost
          ? await reconcileLandLoss(tx, targetID, target.acres ?? 0, Math.min(acresLost, target.acres ?? 0))
          : { buildingsLost: 0, killed: false };
        if (apocalypse && wizardUnit) {
          const backfire = Math.min(wizardUnit.num, Math.floor(channel * .9));
          if (backfire) await tx.militaryUnit.update({ where: { id: wizardUnit.id }, data: { num: { decrement: backfire } } });
        }
        message = `${def.name} destroyed ${acresLost.toLocaleString()} acres, ${landResult.buildingsLost.toLocaleString()} developed sites, ${peasantsLost.toLocaleString()} peasants, and ${troopsLost.toLocaleString()} troops.${landResult.killed ? ' The province was destroyed.' : ''}`;
      } else if (def.className === 'HolySpell' || def.className === 'SoulHarvestSpell') {
        const rate = def.className === 'HolySpell' ? scaled(.005, .01) : scaled(.015, .03);
        const peasantsLost = Math.floor((target.peasants ?? 0) * rate);
        let troopsLost = 0;
        for (const unit of target.military) {
          const loss = Math.floor(unit.num * rate);
          if (loss) await tx.militaryUnit.update({ where: { id: unit.id }, data: { num: { decrement: loss } } });
          troopsLost += loss;
        }
        await tx.province.update({ where: { id: targetID }, data: { peasants: { decrement: peasantsLost } } });
        if (def.className === 'HolySpell') {
          const crypt = target.buildings.find(building => building.type.className?.toLowerCase().includes('crypt'));
          if (crypt) {
            const destroyed = Math.min(crypt.num, randomInt(1, 5));
            await tx.building.update({ where: { id: crypt.id }, data: { num: { decrement: destroyed } } });
          }
        } else {
          const soldier = me.military.find(unit => unit.type.category === 'soldiers');
          const harvested = Math.floor((peasantsLost + troopsLost) * .9);
          if (soldier && harvested) await tx.militaryUnit.update({ where: { id: soldier.id }, data: { num: { increment: harvested } } });
        }
        message = `${def.name} killed ${peasantsLost.toLocaleString()} peasants and ${troopsLost.toLocaleString()} troops.`;
      }

      await tx.news.create({ data: { pID, message } });
      if (!isSelf) {
        await tx.news.create({ data: { pID: targetID, message: `${me.provinceName ?? 'Another province'} cast ${def.name} on your province.` } });
      }
      return { success: true, message, manaUsed, resourcesUsed: resourceCost };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const expected = /Target|spell|race|science|magic|Wizards|mana|resources|kingdom|Protection|duration/i.test(message);
    if (!expected) return internalErrorResponse(request, '/api/magic/cast POST', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
