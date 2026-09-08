import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminRequest } from '@/lib/admin';
import { AGE_LENGTH, endAge, startFreshWorld } from '@/lib/age';
import { lockGameState, withSerializableTransaction } from '@/lib/transactions';
import {
  internalErrorResponse,
  recordOperationalEvent,
  requestIdFor,
} from '@/lib/operational-events';

const USER_PAGE_SIZE = 20;
const EVENT_PAGE_SIZE = 25;

function isStartFreshEnabled() {
  return process.env.ENABLE_ADMIN_START_FRESH?.trim().toLowerCase() !== 'false';
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanFilter(value: string | null, limit = 80) {
  return String(value ?? '').trim().slice(0, limit);
}

function serializeEvent<T extends { id: bigint }>(event: T) {
  return { ...event, id: event.id.toString() };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminRequest(request);
    if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const params = request.nextUrl.searchParams;
    const userPage = positiveInteger(params.get('userPage'), 1);
    const userQuery = cleanFilter(params.get('userQuery'));
    const userStatus = cleanFilter(params.get('userStatus'), 20);
    const eventPage = positiveInteger(params.get('eventPage'), 1);
    const severity = cleanFilter(params.get('severity'), 12);
    const eventKind = cleanFilter(params.get('eventKind'), 32);
    const eventRoute = cleanFilter(params.get('eventRoute'), 120);
    const requestQuery = cleanFilter(params.get('requestQuery'), 64);
    const acknowledgement = cleanFilter(params.get('acknowledgement'), 16);
    const hours = Math.min(24 * 90, positiveInteger(params.get('hours'), 24));
    const eventSince = new Date(Date.now() - hours * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const matchingProvinceIds = userQuery
      ? (await prisma.province.findMany({
          where: {
            OR: [
              { provinceName: { contains: userQuery } },
              { rulerName: { contains: userQuery } },
            ],
          },
          select: { id: true },
          take: 200,
        })).map(province => province.id)
      : [];

    const userWhere: Prisma.UserWhereInput = {};
    if (userQuery) {
      userWhere.OR = [
        { username: { contains: userQuery } },
        { email: { contains: userQuery } },
        ...(matchingProvinceIds.length ? [{ pID: { in: matchingProvinceIds } }] : []),
      ];
    }
    if (userStatus === 'admin') userWhere.access = 1;
    if (userStatus === 'active') {
      userWhere.status = { not: 'Banned' };
      userWhere.access = { not: 1 };
    }
    if (userStatus === 'banned') userWhere.status = 'Banned';

    const eventWhere: Prisma.OperationalEventWhereInput = {
      createdAt: { gte: eventSince },
    };
    if (severity && severity !== 'all') eventWhere.severity = severity;
    if (eventKind && eventKind !== 'all') eventWhere.kind = eventKind;
    if (eventRoute) eventWhere.route = { contains: eventRoute };
    if (requestQuery) eventWhere.requestId = { contains: requestQuery };
    if (acknowledgement === 'open') {
      eventWhere.acknowledgedAt = null;
      eventWhere.severity = severity && severity !== 'all'
        ? severity
        : { in: ['warning', 'error'] };
    }
    if (acknowledgement === 'acknowledged') eventWhere.acknowledgedAt = { not: null };

    const [
      state,
      usersTotal,
      userList,
      eventsTotal,
      events,
      eventKinds,
      errors24h,
      warnings24h,
      openEvents,
      provinces,
      alive,
      killed,
      protectedProvinces,
      vacation,
      kingdoms,
      users,
      newUsers24h,
      exploreOrders,
      buildOrders,
      researchOrders,
      militaryOrders,
      armiesAway,
      activeEffects,
      broadcastHistory,
    ] = await Promise.all([
      prisma.gameState.findUnique({ where: { id: 1 } }),
      prisma.user.count({ where: userWhere }),
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          country: true,
          status: true,
          pID: true,
          access: true,
          created: true,
          activeSessions: true,
        },
        orderBy: { id: 'asc' },
        skip: (userPage - 1) * USER_PAGE_SIZE,
        take: USER_PAGE_SIZE,
      }),
      prisma.operationalEvent.count({ where: eventWhere }),
      prisma.operationalEvent.findMany({
        where: eventWhere,
        orderBy: { createdAt: 'desc' },
        skip: (eventPage - 1) * EVENT_PAGE_SIZE,
        take: EVENT_PAGE_SIZE,
      }),
      prisma.operationalEvent.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        distinct: ['kind'],
        select: { kind: true },
        orderBy: { kind: 'asc' },
      }),
      prisma.operationalEvent.count({ where: { severity: 'error', createdAt: { gte: since24h } } }),
      prisma.operationalEvent.count({ where: { severity: 'warning', createdAt: { gte: since24h } } }),
      prisma.operationalEvent.count({
        where: { acknowledgedAt: null, severity: { in: ['warning', 'error'] } },
      }),
      prisma.province.count(),
      prisma.province.count({ where: { status: 'Alive' } }),
      prisma.province.count({ where: { status: 'Killed' } }),
      prisma.province.count({ where: { status: 'Alive', protection: { gt: 0 } } }),
      prisma.province.count({ where: { status: 'Alive', vacation: true } }),
      prisma.kingdom.count(),
      prisma.user.count(),
      prisma.user.count({ where: { created: { gte: since24h } } }),
      prisma.exploreOrder.count(),
      prisma.buildOrder.count(),
      prisma.researchOrder.count(),
      prisma.militaryOrder.count(),
      prisma.attack.count({ where: { OR: [{ totick: { gt: 0 } }, { backtick: { gt: 0 } }, { staytick: { gt: 0 } }] } }),
      prisma.effect.count(),
      prisma.operationalEvent.findMany({
        where: { kind: 'broadcast' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const provinceIds = [...new Set(userList.map(user => user.pID).filter(pID => pID > 0))];
    const userProvinces = provinceIds.length
      ? await prisma.province.findMany({
          where: { id: { in: provinceIds } },
          select: {
            id: true,
            provinceName: true,
            rulerName: true,
            kiID: true,
            status: true,
            acres: true,
            networth: true,
            protection: true,
            vacation: true,
          },
        })
      : [];
    const kingdomIds = [...new Set(userProvinces.map(province => province.kiID).filter(kiID => kiID > 0))];
    const userKingdoms = kingdomIds.length
      ? await prisma.kingdom.findMany({
          where: { id: { in: kingdomIds } },
          select: { id: true, name: true },
        })
      : [];
    const provinceById = new Map(userProvinces.map(province => [province.id, province]));
    const kingdomById = new Map(userKingdoms.map(kingdom => [kingdom.id, kingdom.name]));
    const activeOrders = exploreOrders + buildOrders + researchOrders + militaryOrders;

    return NextResponse.json({
      admin,
      stats: {
        provinces,
        alive,
        killed,
        protected: protectedProvinces,
        vacation,
        kingdoms,
        users,
        newUsers24h,
        activeOrders,
        exploreOrders,
        buildOrders,
        researchOrders,
        militaryOrders,
        armiesAway,
        activeEffects,
      },
      state,
      users: {
        items: userList.map(user => {
          const province = provinceById.get(user.pID);
          return {
            ...user,
            province: province ? {
              ...province,
              kingdomName: kingdomById.get(province.kiID) ?? null,
            } : null,
          };
        }),
        page: userPage,
        pageSize: USER_PAGE_SIZE,
        total: usersTotal,
        totalPages: Math.max(1, Math.ceil(usersTotal / USER_PAGE_SIZE)),
      },
      operational: {
        errors24h,
        warnings24h,
        openEvents,
        page: eventPage,
        pageSize: EVENT_PAGE_SIZE,
        total: eventsTotal,
        totalPages: Math.max(1, Math.ceil(eventsTotal / EVENT_PAGE_SIZE)),
        kinds: eventKinds.map(item => item.kind),
        events: events.map(serializeEvent),
      },
      broadcasts: broadcastHistory.map(serializeEvent),
      features: { startFresh: isStartFreshEnabled() },
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return internalErrorResponse(request, '/api/admin GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminRequest(request);
    if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const requestId = requestIdFor(request);
    const audit = async (
      summary: string,
      severity: 'info' | 'warning' = 'info',
      detail?: string,
      kind = 'admin-action',
      pID?: number,
    ) => recordOperationalEvent({
      kind,
      severity,
      summary: `${admin.username}: ${summary}`,
      detail,
      requestId,
      route: '/api/admin',
      userId: admin.id,
      pID,
    });

    if (action === 'broadcast') {
      const text = String(body.message ?? '').trim();
      const audience = String(body.audience ?? 'all');
      if (!text) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
      if (text.length > 280) return NextResponse.json({ error: 'Broadcasts can be up to 280 characters.' }, { status: 400 });
      if (!['all', 'active', 'protected', 'unprotected'].includes(audience)) {
        return NextResponse.json({ error: 'Unknown broadcast audience' }, { status: 400 });
      }

      const where: Prisma.ProvinceWhereInput = { status: 'Alive' };
      if (audience === 'active') where.vacation = false;
      if (audience === 'protected') where.protection = { gt: 0 };
      if (audience === 'unprotected') {
        where.protection = { lte: 0 };
        where.vacation = false;
      }
      const provinces = await prisma.province.findMany({ where, select: { id: true } });
      if (provinces.length) {
        await prisma.news.createMany({
          data: provinces.map(province => ({
            pID: province.id,
            message: `Herald: ${text}`.slice(0, 255),
          })),
        });
      }
      if (audience === 'all') {
        await prisma.chatMessage.create({
          data: { scope: 'world', kiID: 0, pID: 0, author: 'Herald', message: text },
        });
      }
      await audit(
        `sent a broadcast to ${provinces.length} provinces`,
        'info',
        JSON.stringify({ audience, recipients: provinces.length, message: text }),
        'broadcast',
      );
      return NextResponse.json({
        message: `Broadcast sent to ${provinces.length.toLocaleString()} provinces.`,
      }, { status: 200 });
    }

    if (action === 'ban' || action === 'unban') {
      const userId = Number(body.userId);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return NextResponse.json({ error: 'Choose a user' }, { status: 400 });
      }
      if (userId === admin.id) {
        return NextResponse.json({ error: 'You cannot change your own access.' }, { status: 400 });
      }
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, access: true, pID: true, status: true },
      });
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (target.access === 1) {
        return NextResponse.json({ error: 'Administrator accounts cannot be changed here.' }, { status: 400 });
      }
      const nextStatus = action === 'ban' ? 'Banned' : 'Active';
      if (target.status !== nextStatus) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            status: nextStatus,
            sessionVersion: { increment: 1 },
          },
        });
      }
      await audit(
        `${action === 'ban' ? 'banned' : 'reinstated'} ${target.username ?? `user ${target.id}`}`,
        action === 'ban' ? 'warning' : 'info',
        JSON.stringify({ targetUserId: target.id, previousStatus: target.status, nextStatus }),
        'admin-action',
        target.pID || undefined,
      );
      return NextResponse.json({
        message: action === 'ban' ? 'User banned and active sessions revoked.' : 'User reinstated.',
      }, { status: 200 });
    }

    if (action === 'acknowledgeEvent') {
      const eventId = String(body.eventId ?? '');
      if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
      const existing = await prisma.operationalEvent.findUnique({ where: { id: BigInt(eventId) } });
      if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (!existing.acknowledgedAt) {
        await prisma.operationalEvent.update({
          where: { id: existing.id },
          data: { acknowledgedAt: new Date(), acknowledgedBy: admin.id },
        });
        await audit(`acknowledged event ${eventId}`, 'info', existing.summary);
      }
      return NextResponse.json({ message: 'Event acknowledged.' }, { status: 200 });
    }

    if (action === 'startApocalypse') {
      if (body.confirmation !== 'APOCALYPSE') {
        return NextResponse.json({ error: 'Type APOCALYPSE to confirm.' }, { status: 400 });
      }
      await withSerializableTransaction(async tx => {
        await tx.gameState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
        await lockGameState(tx);
        await tx.gameState.update({ where: { id: 1 }, data: { tick: AGE_LENGTH, phase: 'Apocalypse' } });
      });
      await audit('started the Apocalypse', 'warning');
      return NextResponse.json({ message: 'The Apocalypse has been unleashed.' }, { status: 200 });
    }

    if (action === 'endAge') {
      if (body.confirmation !== 'END AGE') {
        return NextResponse.json({ error: 'Type END AGE to confirm.' }, { status: 400 });
      }
      const state = await prisma.gameState.findUnique({ where: { id: 1 } });
      const age = state?.age ?? 1;
      await endAge(age);
      await audit(`ended age ${age}`, 'warning');
      return NextResponse.json({ message: `Age ${age} ended; the world has been reset.` }, { status: 200 });
    }

    if (action === 'startFresh') {
      if (!isStartFreshEnabled()) return NextResponse.json({ error: 'Start Fresh is disabled' }, { status: 403 });
      if (body.confirmation !== 'START FRESH') {
        return NextResponse.json({ error: 'Type START FRESH to confirm this reset.' }, { status: 400 });
      }
      await startFreshWorld();
      await audit('cleared the playable world', 'warning');
      return NextResponse.json({
        message: 'The playable world and tick history were cleared. User accounts and reference data were preserved.',
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return internalErrorResponse(request, '/api/admin POST', error);
  }
}
