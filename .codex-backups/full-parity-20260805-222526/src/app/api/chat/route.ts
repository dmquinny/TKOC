import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';

async function getMe(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  if (!user?.pID || user.pID === 0) return null;
  const prov = await prisma.province.findUnique({
    where: { id: user.pID },
    select: { provinceName: true, kiID: true, status: true },
  });
  if (!prov || prov.status !== 'Alive') return null;
  return { pID: user.pID, name: prov.provinceName ?? 'Unknown', kiID: prov.kiID ?? 0 };
}

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const scope = request.nextUrl.searchParams.get('scope') === 'kingdom' ? 'kingdom' : 'world';
    const since = Number(request.nextUrl.searchParams.get('since')) || 0;

    if (scope === 'kingdom' && !me.kiID) {
      return NextResponse.json({ messages: [], noKingdom: true }, { status: 200 });
    }

    const where = scope === 'kingdom'
      ? { scope: 'kingdom', kiID: me.kiID, ...(since ? { id: { gt: since } } : {}) }
      : { scope: 'world', ...(since ? { id: { gt: since } } : {}) };

    // Newest 50, returned oldest-first for display.
    const rows = await prisma.chatMessage.findMany({ where, orderBy: { id: 'desc' }, take: 50 });
    return NextResponse.json({ messages: rows.reverse() }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/chat GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const { scope: rawScope, message } = await request.json();
    const scope = rawScope === 'kingdom' ? 'kingdom' : 'world';
    const text = String(message ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
    if (text.length > 280) return NextResponse.json({ error: 'Messages can be up to 280 characters.' }, { status: 400 });
    if (scope === 'kingdom' && !me.kiID) return NextResponse.json({ error: 'You are not in a kingdom' }, { status: 400 });
    const rate = await consumeRateLimit(`chat:${me.pID}`, 10, 30 * 1000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/chat', 'Chat rate limit exceeded', { pID: me.pID });
      return NextResponse.json(
        { error: 'You are sending chat messages too quickly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const row = await prisma.chatMessage.create({
      data: {
        scope,
        kiID: scope === 'kingdom' ? me.kiID : 0,
        pID: me.pID,
        author: me.name,
        message: text,
      },
    });

    return NextResponse.json({ message: row }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/chat POST', error);
  }
}
