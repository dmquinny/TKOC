import { Prisma } from '@prisma/client';
import {
  LEGACY_APOCALYPSE_TICKS,
  LEGACY_NORMAL_AGE_TICKS,
  LEGACY_TOTAL_AGE_TICKS,
} from '@/lib/legacy-rules';
import { lockGameState, withSerializableTransaction } from '@/lib/transactions';

// Age lifecycle: AGE_LENGTH ticks of normal play, then APOCALYPSE_LENGTH ticks
// of escalating ruin, then the age ends — standings recorded and world reset.
// Legacy Config defaults: a 1,500-tick age with its final 500 ticks reserved
// for the apocalypse. AGE_LENGTH is the normal-play portion because the tick
// engine uses it as the apocalypse threshold.
export const TOTAL_AGE_LENGTH = LEGACY_TOTAL_AGE_TICKS;
export const APOCALYPSE_LENGTH = LEGACY_APOCALYPSE_TICKS;
export const AGE_LENGTH = LEGACY_NORMAL_AGE_TICKS;

// Record the final standings for the age, then wipe the world for a fresh age.
// This variant accepts the caller's transaction so the final tick and reset are
// committed atomically.
export async function endAgeInTransaction(tx: Prisma.TransactionClient, currentAge: number) {
  const top = await tx.province.findMany({
    orderBy: { networth: 'desc' },
    take: 20,
    select: { provinceName: true, rulerName: true, networth: true, kiID: true },
  });
  const kingdoms = await tx.kingdom.findMany({ select: { id: true, name: true } });
  const kName = new Map(kingdoms.map(k => [k.id, k.name]));
  if (top.length) {
    await tx.ageResult.createMany({
      data: top.map((p, i) => ({
        age: currentAge,
        rank: i + 1,
        provinceName: p.provinceName ?? 'Unknown',
        rulerName: p.rulerName ?? 'Unknown',
        networth: p.networth ?? 0,
        kingdomName: kName.get(p.kiID ?? 0) ?? null,
      })),
    });
  }

  // Children first (foreign keys), then provinces/kingdoms, then reset users + clock.
  await tx.army.deleteMany({});
  await tx.attack.deleteMany({});
  await tx.exploreOrder.deleteMany({});
  await tx.buildOrder.deleteMany({});
  await tx.researchOrder.deleteMany({});
  await tx.militaryOrder.deleteMany({});
  await tx.science.deleteMany({});
  await tx.building.deleteMany({});
  await tx.militaryUnit.deleteMany({});
  await tx.effect.deleteMany({});
  await tx.news.deleteMany({});
  await tx.chatMessage.deleteMany({});
  await tx.message.deleteMany({});
  await tx.kingdomRelation.deleteMany({});
  await tx.province.deleteMany({});
  await tx.kingdom.deleteMany({});
  await tx.user.updateMany({ data: { pID: 0 } });
  await tx.gameState.update({ where: { id: 1 }, data: { tick: 0, season: 'Spring', phase: 'Running', age: currentAge + 1 } });
}

export async function endAge(currentAge: number) {
  return withSerializableTransaction(async tx => {
    await lockGameState(tx);
    const state = await tx.gameState.findUnique({ where: { id: 1 }, select: { age: true } });
    return endAgeInTransaction(tx, state?.age ?? currentAge);
  });
}

// Launch-only reset: keep accounts and seeded reference data, but remove every
// trace of the playable world and restart the durable clock from Age 1/Tick 0.
export async function startFreshWorld() {
  return withSerializableTransaction(async tx => {
    // Update first so this transaction contends with the scheduler on the
    // GameState row. Serializable isolation prevents a tick/reset interleave.
    await tx.gameState.upsert({
      where: { id: 1 },
      update: {
        age: 1,
        tick: 0,
        season: 'Spring',
        phase: 'Running',
        lastTickAt: null,
        nextTickAt: null,
        lastTickDurationMs: null,
      },
      create: { id: 1 },
    });
    await lockGameState(tx);

    await tx.army.deleteMany({});
    await tx.attack.deleteMany({});
    await tx.exploreOrder.deleteMany({});
    await tx.buildOrder.deleteMany({});
    await tx.researchOrder.deleteMany({});
    await tx.militaryOrder.deleteMany({});
    await tx.science.deleteMany({});
    await tx.building.deleteMany({});
    await tx.militaryUnit.deleteMany({});
    await tx.effect.deleteMany({});
    await tx.news.deleteMany({});
    await tx.chatMessage.deleteMany({});
    await tx.message.deleteMany({});
    await tx.kingdomRelation.deleteMany({});
    await tx.province.deleteMany({});
    await tx.kingdom.deleteMany({});
    await tx.ageResult.deleteMany({});
    await tx.tickRun.deleteMany({});
    await tx.user.updateMany({ data: { pID: 0 } });
  });
}
