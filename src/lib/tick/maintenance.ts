import type { Prisma } from '@prisma/client';
import { cleanupKilledProvinces } from '@/lib/province-lifecycle';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function finishTickMaintenance(tx: Prisma.TransactionClient, now: Date) {
  await tx.province.updateMany({
    where: { status: 'Alive', attackPressure: { gt: 0 } },
    data: { attackPressure: { decrement: 1 } },
  });
  await cleanupKilledProvinces(tx);
  await Promise.all([
    tx.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: new Date(now.getTime() - 7 * DAY_MS) } },
    }),
    tx.operationalEvent.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
    }),
  ]);
}
