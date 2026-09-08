import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { internalErrorResponse } from '@/lib/operational-events';

async function getProvince(request: NextRequest) {
  const userID = await getUserIdFromRequest(request);
  if (!userID) return null;
  const user = await prisma.user.findUnique({ where: { id: userID }, select: { pID: true } });
  if (!user?.pID) return null;
  return prisma.province.findUnique({
    where: { id: user.pID },
    select: { id: true, provinceName: true, kiID: true, status: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const me = await getProvince(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const scope = request.nextUrl.searchParams.get('scope') === 'kingdom' ? 'kingdom' : 'world';
    if (scope === 'kingdom' && !me.kiID) return NextResponse.json({ error: 'You are not in a kingdom' }, { status: 400 });
    const threadID = Number(request.nextUrl.searchParams.get('threadId') ?? 0);
    const access = scope === 'kingdom' ? { scope, kiID: me.kiID } : { scope, kiID: 0 };
    if (threadID) {
      const thread = await prisma.forumThread.findFirst({
        where: { id: threadID, ...access },
        include: { posts: { orderBy: { id: 'asc' } } },
      });
      if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      return NextResponse.json({ thread });
    }
    const threads = await prisma.forumThread.findMany({
      where: access,
      include: { _count: { select: { posts: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ threads, scope, inKingdom: Boolean(me.kiID) });
  } catch (error) {
    return internalErrorResponse(request, '/api/forums GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getProvince(request);
    if (!me) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    if (me.status !== 'Alive') return NextResponse.json({ error: 'Your province is not active' }, { status: 400 });
    const body = await request.json();
    const scope = body.scope === 'kingdom' ? 'kingdom' : 'world';
    if (scope === 'kingdom' && !me.kiID) return NextResponse.json({ error: 'You are not in a kingdom' }, { status: 400 });
    const author = me.provinceName ?? 'Unknown province';
    const text = String(body.body ?? '').trim();
    if (!text || text.length > 10_000) return NextResponse.json({ error: 'Post must be between 1 and 10,000 characters' }, { status: 400 });

    if (body.action === 'createThread') {
      const title = String(body.title ?? '').trim();
      if (!title || title.length > 120) return NextResponse.json({ error: 'Title must be between 1 and 120 characters' }, { status: 400 });
      const thread = await prisma.forumThread.create({
        data: {
          scope,
          kiID: scope === 'kingdom' ? me.kiID : 0,
          authorPID: me.id,
          author,
          title,
          posts: { create: { authorPID: me.id, author, body: text } },
        },
      });
      return NextResponse.json({ message: 'Thread created.', threadId: thread.id });
    }

    if (body.action === 'reply') {
      const threadID = Number(body.threadId);
      const thread = await prisma.forumThread.findFirst({
        where: {
          id: threadID,
          ...(scope === 'kingdom' ? { scope, kiID: me.kiID } : { scope, kiID: 0 }),
        },
      });
      if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      if (thread.locked) return NextResponse.json({ error: 'This thread is locked' }, { status: 400 });
      await prisma.$transaction([
        prisma.forumPost.create({ data: { threadId: thread.id, authorPID: me.id, author, body: text } }),
        prisma.forumThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } }),
      ]);
      return NextResponse.json({ message: 'Reply posted.' });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return internalErrorResponse(request, '/api/forums POST', error);
  }
}

