import bcrypt from 'bcrypt';

export const KINGDOM_CAP = 3;
export const KINGDOM_MEMBERSHIP_FIXED_FOR_AGE = true;

export function canonicalKingdomPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

export function requiredKingVotes(memberCount: number): number {
  return Math.max(1, Math.round(memberCount * 0.5));
}

export async function hashKingdomPassword(password: unknown): Promise<string> {
  const value = String(password ?? '').slice(0, 64);
  return value ? bcrypt.hash(value, 10) : '';
}

export async function kingdomPasswordMatches(stored: string | null, supplied: unknown): Promise<boolean> {
  if (!stored) return true;
  const value = String(supplied ?? '').slice(0, 64);
  if (stored.startsWith('$2')) return bcrypt.compare(value, stored);
  return value === stored;
}
