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
    select: { provinceName: true, status: true },
  });
  if (!prov || prov.status !== 'Alive') return null;
  return { pID: user.pID, name: prov.provinceName ?? 'Unknown' };
}

export async function GET(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const messages = await prisma.message.findMany({
      where: { toPID: me.pID },
      orderBy: { id: 'desc' },
      take: 50,
    });
    const unread = messages.filter(m => !m.readAt).length;
    return NextResponse.json({ messages, unread }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/messages GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const { action, to, subject, body, id } = await request.json();

    if (action === 'read') {
      const mid = Number(id);
      if (!mid) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
      // Only mark your own inbox messages read.
      await prisma.message.updateMany({ where: { id: mid, toPID: me.pID, readAt: null }, data: { readAt: new Date() } });
      return NextResponse.json({ message: 'Marked read' }, { status: 200 });
    }

    // default: send
    const recipientName = String(to ?? '').trim();
    const subj = String(subject ?? '').trim();
    const text = String(body ?? '').trim();
    if (!recipientName || !subj || !text) return NextResponse.json({ error: 'Recipient, subject, and body are required' }, { status: 400 });
    if (recipientName.length > 40 || subj.length > 120 || text.length > 5_000) {
      return NextResponse.json({ error: 'Message fields are too long.' }, { status: 400 });
    }

    const recipient = await prisma.province.findFirst({
      where: { provinceName: recipientName, status: 'Alive' },
      select: { id: true },
    });
    if (!recipient) return NextResponse.json({ error: 'No province by that name' }, { status: 404 });

    const rate = await consumeRateLimit(`mail:${me.pID}`, 20, 60 * 60 * 1000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/messages', 'Mail rate limit exceeded', { pID: me.pID });
      return NextResponse.json(
        { error: 'You are sending messages too quickly. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const msg = await prisma.message.create({
      data: { fromPID: me.pID, toPID: recipient.id, fromName: me.name, subject: subj.slice(0, 120), body: text },
    });
    return NextResponse.json({ message: 'Message sent', id: msg.id }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/messages POST', error);
  }
}
