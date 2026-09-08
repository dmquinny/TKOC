import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { KINGDOM_CAP } from '@/lib/kingdom-rules';
import { internalErrorResponse } from '@/lib/operational-events';

// Public list of kingdoms a new province could join, for the create screen.
export async function GET(request: Request) {
  try {
    const kingdoms = await prisma.kingdom.findMany({
      where: { numProvinces: { lt: KINGDOM_CAP } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, numProvinces: true, password: true },
    });

    const list = kingdoms.map(k => ({
      id: k.id,
      name: k.name,
      numProvinces: k.numProvinces,
      cap: KINGDOM_CAP,
      hasPassword: !!(k.password && k.password.length > 0),
    }));

    return NextResponse.json({ kingdoms: list, cap: KINGDOM_CAP }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/kingdoms', error);
  }
}
