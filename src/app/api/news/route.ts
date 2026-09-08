import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID || user.pID === 0) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const news = await prisma.news.findMany({
      where: { pID: user.pID },
      orderBy: { id: 'desc' },
      take: 15,
    });

    return NextResponse.json({ news }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/news', error);
  }
}
