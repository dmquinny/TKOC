import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

/**
 * Resolve a required secret. In production the env var MUST be set — we fail
 * closed rather than fall back to a guessable default (which would let anyone
 * forge auth tokens or trigger the cron tick). In dev we allow a fallback.
 */
function requireSecret(name: 'JWT_SECRET' | 'CRON_SECRET', devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} environment variable must be set in production`);
  }
  return devFallback;
}

export function getJwtSecret(): string {
  return requireSecret('JWT_SECRET', 'fallback_secret_for_development_only');
}

export function getCronSecret(): string {
  return requireSecret('CRON_SECRET', 'dev_cron_secret');
}

export interface AuthTokenPayload {
  userId: number;
  username: string | null;
  sessionVersion: number;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
}

export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId?: number;
      sessionVersion?: number;
    };
    if (!Number.isSafeInteger(decoded.userId) || !Number.isSafeInteger(decoded.sessionVersion)) return null;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { status: true, sessionVersion: true },
    });
    if (!user || user.status === 'Banned' || user.sessionVersion !== decoded.sessionVersion) return null;
    return decoded.userId!;
  } catch {
    return null;
  }
}
