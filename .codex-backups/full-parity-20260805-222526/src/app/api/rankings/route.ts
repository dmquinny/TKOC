import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rankings = await prisma.province.findMany({
      where: { status: 'Alive', acres: { gt: 0 } },
      orderBy: [
        { networth: 'desc' },
        { acres: 'desc' },
      ],
      select: {
        id: true,
        provinceName: true,
        rulerName: true,
        networth: true,
        acres: true,
      },
      take: 100, // Top 100 players
    });

    return NextResponse.json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
}
