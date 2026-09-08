import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';
import { unseenBattleReportCount } from '@/lib/server/battle-reports';
import type { NotificationCounts } from '@/lib/world-clock';

// Live counters for the navigation badges. `sinceNews` is the newest news id
// the browser has already shown, so only genuinely new items are counted.
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const pID = user.pID;
    const sinceNews = Math.max(0, Number(request.nextUrl.searchParams.get('sinceNews')) || 0);

    const [unreadMessages, unseenBattles, latestNews, newNews] = await Promise.all([
      prisma.message.count({ where: { toPID: pID, readAt: null } }),
      unseenBattleReportCount(prisma, pID),
      prisma.news.findFirst({ where: { pID }, orderBy: { id: 'desc' }, select: { id: true } }),
      prisma.news.count({ where: { pID, id: { gt: sinceNews } } }),
    ]);

    const body: NotificationCounts = {
      unreadMessages,
      unseenBattles,
      newNews: Math.min(99, newNews),
      latestNewsId: latestNews?.id ?? 0,
    };
    return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalErrorResponse(request, '/api/notifications', error);
  }
}
