import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';
import { prisma } from '@/lib/prisma';
import { loadActivity } from '@/lib/server/activity';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const activity = await loadActivity(prisma, user.pID);
    if (!activity) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    return NextResponse.json(activity, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalErrorResponse(request, '/api/activity', error);
  }
}
