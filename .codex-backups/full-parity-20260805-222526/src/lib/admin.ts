import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export type AdminIdentity = {
  id: number;
  username: string;
};

export async function getAdminRequest(request: NextRequest): Promise<AdminIdentity | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, access: true },
  });
  if (user?.access !== 1) return null;
  return { id: user.id, username: user.username ?? `User ${user.id}` };
}

// Administrators are users with access level 1.
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return Boolean(await getAdminRequest(request));
}
