import type { Prisma } from '@prisma/client';

export const LEGACY_DEAD_MILITARY_TICKS = 24;

/**
 * The legacy military manager kept 50-90% of killed troops available to
 * Undead resurrection for one day. All casualty-producing systems use this
 * helper so Resurrect sees the same shared pool.
 */
export async function recordDeadMilitary(
  tx: Prisma.TransactionClient,
  pID: number,
  mID: number,
  casualties: number,
): Promise<number> {
  const killed = Math.max(0, Math.floor(casualties));
  if (!killed) return 0;
  const lostSouls = Math.ceil(killed * (Math.floor(Math.random() * 41) + 10) / 100);
  const recoverable = Math.max(0, killed - lostSouls);
  if (!recoverable) return 0;
  await tx.deadMilitary.upsert({
    where: { pID_mID_ticks: { pID, mID, ticks: LEGACY_DEAD_MILITARY_TICKS } },
    create: { pID, mID, ticks: LEGACY_DEAD_MILITARY_TICKS, num: recoverable },
    update: { num: { increment: recoverable } },
  });
  return recoverable;
}

