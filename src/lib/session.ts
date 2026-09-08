import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

export type SessionUser = {
  userId: number;
  username: string | null;
  pID: number;
  isAdmin: boolean;
};

/**
 * Resolve the signed-in user from the raw auth cookie. Used by server layouts,
 * which cannot construct a NextRequest. Mirrors getUserIdFromRequest exactly:
 * banned accounts and stale session versions are treated as signed out.
 */
export async function getSessionFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  let decoded: { userId?: number; sessionVersion?: number };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as { userId?: number; sessionVersion?: number };
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(decoded.userId) || !Number.isSafeInteger(decoded.sessionVersion)) return null;
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, pID: true, access: true, status: true, sessionVersion: true },
    });
  } catch (error) {
    // A database outage must show the sign-in screen, not a crash page.
    console.error('Session lookup failed:', error);
    return null;
  }
  if (!user || user.status === 'Banned' || user.sessionVersion !== decoded.sessionVersion) return null;
  return {
    userId: user.id,
    username: user.username,
    pID: user.pID,
    isAdmin: user.access === 1,
  };
}
