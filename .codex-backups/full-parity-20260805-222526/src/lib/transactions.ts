import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

export type TransactionClient = Prisma.TransactionClient;

function isRetryableTransactionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  // The MariaDB adapter surfaces server deadlock 1213 as P2010 with
  // TransactionWriteConflict metadata rather than Prisma's usual P2034.
  return /deadlock|serialization|lock wait timeout|transactionwriteconflict|(?:code:\s*)?1213/i.test(message);
}

export async function withSerializableTransaction<T>(
  work: (tx: TransactionClient) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 120_000,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableTransactionError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 20 + Math.floor(Math.random() * 25)));
    }
  }
  throw lastError;
}

async function lockIds(
  tx: TransactionClient,
  table: 'User' | 'Province' | 'Kingdom',
  column: 'userID' | 'pID' | 'kiID',
  ids: number[],
): Promise<void> {
  const ordered = [...new Set(ids.filter(Number.isSafeInteger))].sort((a, b) => a - b);
  if (!ordered.length) return;
  const tableSql = Prisma.raw(`\`${table}\``);
  const columnSql = Prisma.raw(`\`${column}\``);
  await tx.$queryRaw(
    Prisma.sql`SELECT ${columnSql} FROM ${tableSql} WHERE ${columnSql} IN (${Prisma.join(ordered)}) ORDER BY ${columnSql} FOR UPDATE`,
  );
}

export function lockProvinceRows(tx: TransactionClient, ids: number[]): Promise<void> {
  return lockIds(tx, 'Province', 'pID', ids);
}

export function lockUserRows(tx: TransactionClient, ids: number[]): Promise<void> {
  return lockIds(tx, 'User', 'userID', ids);
}

export function lockKingdomRows(tx: TransactionClient, ids: number[]): Promise<void> {
  return lockIds(tx, 'Kingdom', 'kiID', ids);
}

export async function lockRateLimitBucket(tx: TransactionClient, key: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT \`key\` FROM \`RateLimitBucket\` WHERE \`key\` = ${key} FOR UPDATE`,
  );
}

export async function lockGameState(tx: TransactionClient): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT \`id\` FROM \`GameState\` WHERE \`id\` = 1 FOR UPDATE`);
}

export type PrismaClientLike = PrismaClient | TransactionClient;
