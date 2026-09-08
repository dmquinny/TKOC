import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { internalErrorResponse } from '@/lib/operational-events';

export async function GET(request: Request) {
  try {
    const races = await prisma.race.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json({ races }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/races', error);
  }
}
