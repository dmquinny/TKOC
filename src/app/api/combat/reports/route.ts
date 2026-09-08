import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';
import { listBattleReports, markBattleReportsSeen } from '@/lib/server/battle-reports';

async function getProvinceId(request: NextRequest): Promise<number | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  return user?.pID || null;
}

// Battle history for the signed-in province, newest first.
export async function GET(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 30));
    const reports = await listBattleReports(prisma, pID, limit);
    return NextResponse.json({ reports, me: pID }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalErrorResponse(request, '/api/combat/reports GET', error);
  }
}

// Mark every report of an attack on this province as read.
export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    if (body?.action !== 'seen') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    const marked = await markBattleReportsSeen(prisma, pID);
    return NextResponse.json({ marked }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/combat/reports POST', error);
  }
}
