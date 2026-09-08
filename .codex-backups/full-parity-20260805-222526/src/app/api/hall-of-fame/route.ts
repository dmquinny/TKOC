import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { internalErrorResponse } from '@/lib/operational-events';

export async function GET(request: Request) {
  try {
    const [state, results] = await Promise.all([
      prisma.gameState.findUnique({ where: { id: 1 } }),
      prisma.ageResult.findMany({ orderBy: [{ age: 'desc' }, { rank: 'asc' }] }),
    ]);

    const byAge = new Map<number, typeof results>();
    for (const r of results) {
      if (!byAge.has(r.age)) byAge.set(r.age, []);
      byAge.get(r.age)!.push(r);
    }
    const ages = [...byAge.entries()].map(([age, entries]) => ({ age, entries }));

    return NextResponse.json({ state, ages }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/hall-of-fame', error);
  }
}
