import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { pID: true }
    });

    if (!user || !user.pID || user.pID === 0) {
      return NextResponse.json({ error: 'Province not found' }, { status: 404 });
    }

    const [province, state, effects] = await Promise.all([
      prisma.province.findUnique({ where: { id: user.pID } }),
      prisma.gameState.findUnique({ where: { id: 1 } }),
      prisma.effect.findMany({ where: { pID: user.pID }, orderBy: { ticksLeft: 'desc' } }),
    ]);

    return NextResponse.json({ province, season: state?.season ?? 'Spring', tick: state?.tick ?? 0, effects }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/province', error);
  }
}
