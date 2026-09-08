import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Lightweight world clock for the sidebar: age, tick, season, phase.
export async function GET() {
  try {
    const state = await prisma.gameState.findUnique({ where: { id: 1 } });
    return NextResponse.json({
      age: state?.age ?? 1,
      tick: state?.tick ?? 0,
      season: state?.season ?? 'Spring',
      phase: state?.phase ?? 'Running',
    }, { status: 200 });
  } catch {
    return NextResponse.json({ age: 1, tick: 0, season: 'Spring', phase: 'Running' }, { status: 200 });
  }
}
