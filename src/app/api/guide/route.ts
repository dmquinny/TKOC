import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { internalErrorResponse } from '@/lib/operational-events';

// Public reference data so the Guide's tables always match the live game.
export async function GET(request: Request) {
  try {
    const [buildings, military, sciences, advisors, races] = await Promise.all([
      prisma.buildingType.findMany({ orderBy: { id: 'asc' } }),
      prisma.militaryType.findMany({ orderBy: { id: 'asc' } }),
      prisma.scienceType.findMany({ orderBy: { id: 'asc' } }),
      prisma.advisor.findMany({ orderBy: { id: 'asc' } }),
      prisma.race.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return NextResponse.json({ buildings, military, sciences, advisors, races }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/guide', error);
  }
}
