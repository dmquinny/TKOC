import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { withSerializableTransaction, lockRateLimitBucket } from './transactions';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const safeKey = key.slice(0, 191);
  const seededAt = new Date();
  // Seed outside the serializable transaction. Concurrent UPSERTs followed by
  // SELECT ... FOR UPDATE on the same new row can deadlock in MariaDB. INSERT
  // IGNORE commits the single shared row first; the transactions below then
  // queue on one existing row in a consistent order.
  await prisma.$executeRaw(
    Prisma.sql`INSERT IGNORE INTO \`RateLimitBucket\`
      (\`key\`, \`windowStart\`, \`count\`, \`updatedAt\`)
      VALUES (${safeKey}, ${seededAt}, 0, ${seededAt})`,
  );

  return withSerializableTransaction(async tx => {
    await lockRateLimitBucket(tx, safeKey);
    const now = new Date();
    const bucket = await tx.rateLimitBucket.findUniqueOrThrow({ where: { key: safeKey } });
    const elapsed = now.getTime() - bucket.windowStart.getTime();
    if (elapsed >= windowMs) {
      await tx.rateLimitBucket.update({
        where: { key: safeKey },
        data: { windowStart: now, count: 1 },
      });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    if (bucket.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds };
    const updated = await tx.rateLimitBucket.update({
      where: { key: safeKey },
      data: { count: { increment: 1 } },
    });
    return { allowed: true, remaining: Math.max(0, limit - updated.count), retryAfterSeconds: 0 };
  });
}

export function requestIdentity(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  const value = forwarded || real || 'unknown';
  return value.replace(/[^a-fA-F0-9:.\-_]/g, '').slice(0, 64) || 'unknown';
}
