import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const getPrisma = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  // Prisma's MySQL datasource URL uses mysql://, while the MariaDB driver
  // adapter expects mariadb:// for the same connection string.
  const databaseUrl = process.env.DATABASE_URL?.replace(/^mysql:/, 'mariadb:');
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable must be set');
  const adapter = new PrismaMariaDb(databaseUrl);
  const log: ('query' | 'error')[] = process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'];
  return new PrismaClient({ adapter, log });
}

export const prisma = getPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
