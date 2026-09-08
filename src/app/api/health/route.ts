import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/admin';
import { getTickIntervalSeconds } from '@/lib/tick-config';

export async function GET(request: NextRequest) {
  const checkedAt = new Date();

  try {
    const showDetails = await isAdminRequest(request);
    const state = await prisma.gameState.findUnique({ where: { id: 1 } });
    const intervalSeconds = getTickIntervalSeconds();
    const tickLagSeconds = state?.nextTickAt
      ? Math.max(0, Math.floor((checkedAt.getTime() - state.nextTickAt.getTime()) / 1000))
      : 0;
    const tickHealthy = tickLagSeconds <= intervalSeconds;
    const strict = request.nextUrl.searchParams.get('strict') === '1';

    const summary = {
      status: tickHealthy ? 'ok' : 'degraded',
      database: 'connected',
      checkedAt: checkedAt.toISOString(),
    };

    return NextResponse.json(showDetails ? {
      ...summary,
      tick: {
        healthy: tickHealthy,
        age: state?.age ?? 1,
        number: state?.tick ?? 0,
        lastTickAt: state?.lastTickAt?.toISOString() ?? null,
        nextTickAt: state?.nextTickAt?.toISOString() ?? null,
        lagSeconds: tickLagSeconds,
        lastDurationMs: state?.lastTickDurationMs ?? null,
        intervalSeconds,
      },
    } : summary, {
      status: strict && !tickHealthy ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      checkedAt: checkedAt.toISOString(),
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
