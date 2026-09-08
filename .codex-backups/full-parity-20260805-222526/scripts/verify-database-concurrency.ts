import 'dotenv/config';
import assert from 'node:assert/strict';
import { consumeRateLimit } from '../src/lib/rate-limit';
import { prisma } from '../src/lib/prisma';

async function main() {
  const key = `self-test:${Date.now()}`;
  let failure: unknown;
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit(key, 4, 60_000)),
    );
    assert.equal(results.filter(result => result.allowed).length, 4);
    const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key } });
    assert.equal(bucket.count, 4);
    console.log('Database concurrency invariant passed.');
  } catch (error) {
    failure = error;
  }
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  } catch (error) {
    failure ??= error;
  } finally {
    await prisma.$disconnect();
  }
  if (failure) throw failure;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
