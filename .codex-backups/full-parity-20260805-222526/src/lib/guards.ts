import { prisma } from '@/lib/prisma';

// True if the province is currently in vacation mode (frozen; cannot act).
export async function isOnVacation(pID: number): Promise<boolean> {
  const p = await prisma.province.findUnique({ where: { id: pID }, select: { vacation: true } });
  return !!p?.vacation;
}

// True if two kingdoms have an active alliance (either direction).
export async function areAllied(kiA?: number | null, kiB?: number | null): Promise<boolean> {
  if (!kiA || !kiB || kiA === kiB) return false;
  const rel = await prisma.kingdomRelation.findFirst({
    where: {
      type: 'ally',
      status: 'active',
      OR: [
        { fromKiId: kiA, toKiId: kiB },
        { fromKiId: kiB, toKiId: kiA },
      ],
    },
  });
  return !!rel;
}
