import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ageOutlook } from '@/lib/apocalypse';
import { getTickIntervalSeconds } from '@/lib/tick-config';
import type { WorldClock } from '@/lib/world-clock';

const headers = { 'Cache-Control': 'no-store' };

// World clock for the sidebar: age, tick, season, phase, the next scheduled
// tick, and where the age stands relative to the Apocalypse.
export async function GET() {
  const intervalSeconds = getTickIntervalSeconds();
  try {
    const state = await prisma.gameState.findUnique({ where: { id: 1 } });
    const tick = state?.tick ?? 0;
    const body: WorldClock = {
      age: state?.age ?? 1,
      tick,
      season: state?.season ?? 'Spring',
      phase: state?.phase ?? 'Running',
      nextTickAt: state?.nextTickAt?.toISOString() ?? null,
      lastTickAt: state?.lastTickAt?.toISOString() ?? null,
      intervalSeconds,
      outlook: ageOutlook(tick, state?.phase),
    };
    return NextResponse.json(body, { status: 200, headers });
  } catch {
    const body: WorldClock = {
      age: 1,
      tick: 0,
      season: 'Spring',
      phase: 'Running',
      nextTickAt: null,
      lastTickAt: null,
      intervalSeconds,
      outlook: ageOutlook(0, 'Running'),
    };
    return NextResponse.json(body, { status: 200, headers });
  }
}
