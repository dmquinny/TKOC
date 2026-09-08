import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';
import { rankKingdoms, rankMovement } from '@/lib/ranking';

const select = {
  id: true,
  provinceName: true,
  rulerName: true,
  networth: true,
  acres: true,
  kiID: true,
  reputation: true,
  magicRep: true,
  militaryRep: true,
  rankNetworth: true,
  rankNetworthDay: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const where = { status: 'Alive', acres: { gt: 0 }, kiID: { gt: 0 } } as const;
    const userId = await getUserIdFromRequest(request);
    const [networth, thievery, magic, military, kingdoms, everyone, viewer] = await Promise.all([
      prisma.province.findMany({ where, orderBy: [{ networth: 'desc' }, { acres: 'desc' }], select, take: 100 }),
      prisma.province.findMany({ where, orderBy: [{ reputation: 'desc' }, { networth: 'desc' }], select, take: 100 }),
      prisma.province.findMany({ where, orderBy: [{ magicRep: 'desc' }, { networth: 'desc' }], select, take: 100 }),
      prisma.province.findMany({ where, orderBy: [{ militaryRep: 'desc' }, { networth: 'desc' }], select, take: 100 }),
      prisma.kingdom.findMany({ select: { id: true, name: true } }),
      prisma.province.findMany({ where: { status: 'Alive', acres: { gt: 0 } }, select: { kiID: true, networth: true, acres: true } }),
      userId ? prisma.user.findUnique({ where: { id: userId }, select: { pID: true } }) : null,
    ]);
    const names = new Map(kingdoms.map(kingdom => [kingdom.id, kingdom.name ?? `Kingdom ${kingdom.id}`]));
    const decorate = (rows: typeof networth) => rows.map(row => ({
      ...row,
      movement: rankMovement(row.rankNetworth, row.rankNetworthDay),
    }));
    return NextResponse.json({
      networth: decorate(networth),
      thievery: decorate(thievery),
      magic: decorate(magic),
      military: decorate(military),
      kingdomStandings: rankKingdoms(everyone, names),
      kingdoms: Object.fromEntries(names),
      me: viewer?.pID ?? null,
      total: everyone.length,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalErrorResponse(request, '/api/rankings GET', error);
  }
}
