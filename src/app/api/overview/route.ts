import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { ageOutlook, type AgeOutlook } from '@/lib/apocalypse';
import { buildChecklist, type ChecklistItem } from '@/lib/checklist';
import { buildForecast, type Forecast } from '@/lib/forecast';
import { internalErrorResponse } from '@/lib/operational-events';
import { rankMovement } from '@/lib/ranking';
import { loadActivity, type ActivityData } from '@/lib/server/activity';
import { getTickIntervalSeconds } from '@/lib/tick-config';

export type OverviewProvince = {
  id: number;
  provinceName: string;
  rulerName: string;
  race: string;
  acres: number;
  landUsed: number;
  peasants: number;
  gold: number;
  food: number;
  metal: number;
  mana: number;
  influence: number;
  morale: number;
  networth: number;
  protection: number;
  vacation: boolean;
  kingdom: { id: number; name: string } | null;
};

export type OverviewData = {
  province: OverviewProvince;
  tick: number;
  season: string;
  phase: string;
  intervalSeconds: number;
  outlook: AgeOutlook;
  forecast: Forecast;
  activity: ActivityData;
  checklist: ChecklistItem[];
  rank: { networth: number; movement: number | null; total: number };
  effects: Array<{ id: number; type: string; magnitude: number; ticksLeft: number }>;
  news: Array<{ id: number; message: string; createdAt: string }>;
};

// One round trip for the Overview screen: province, economy forecast, queued
// work, first-steps guidance, rank, effects, and recent news.
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
    if (!user?.pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const pID = user.pID;

    const [province, state, news, activity, aliveCount] = await Promise.all([
      prisma.province.findUnique({
        where: { id: pID },
        include: {
          buildings: { select: { num: true } },
          buildOrders: { select: { num: true } },
          researchOrders: { select: { id: true } },
          militaryOrders: { select: { id: true } },
          exploreOrders: { select: { id: true } },
          science: { select: { id: true } },
          military: { select: { num: true } },
          effects: { orderBy: { ticksLeft: 'desc' } },
        },
      }),
      prisma.gameState.findUnique({ where: { id: 1 } }),
      prisma.news.findMany({ where: { pID }, orderBy: { id: 'desc' }, take: 15 }),
      loadActivity(prisma, pID),
      prisma.province.count({ where: { status: 'Alive', acres: { gt: 0 } } }),
    ]);
    if (!province || !activity) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [race, kingdom, kingdomChatMessages] = await Promise.all([
      province.raceId ? prisma.race.findUnique({ where: { id: province.raceId }, select: { name: true } }) : null,
      province.kiID ? prisma.kingdom.findUnique({ where: { id: province.kiID }, select: { id: true, name: true } }) : null,
      province.kiID ? prisma.chatMessage.count({ where: { scope: 'kingdom', kiID: province.kiID, pID } }) : 0,
    ]);

    const landUsed = province.buildings.reduce((sum, item) => sum + item.num, 0)
      + province.buildOrders.reduce((sum, item) => sum + item.num, 0);
    const militaryTotal = province.military.reduce((sum, item) => sum + item.num, 0);
    const tick = state?.tick ?? 0;

    const body: OverviewData = {
      province: {
        id: province.id,
        provinceName: province.provinceName ?? 'Unnamed province',
        rulerName: province.rulerName ?? 'Unknown ruler',
        race: race?.name ?? 'Unknown',
        acres: province.acres ?? 0,
        landUsed,
        peasants: province.peasants ?? 0,
        gold: province.gold ?? 0,
        food: province.food ?? 0,
        metal: province.metal ?? 0,
        mana: province.mana ?? 0,
        influence: province.influence ?? 0,
        morale: province.morale ?? 0,
        networth: province.networth ?? 0,
        protection: province.protection ?? 0,
        vacation: province.vacation,
        kingdom: kingdom ? { id: kingdom.id, name: kingdom.name ?? `Kingdom ${kingdom.id}` } : null,
      },
      tick,
      season: state?.season ?? 'Spring',
      phase: state?.phase ?? 'Running',
      intervalSeconds: getTickIntervalSeconds(),
      outlook: ageOutlook(tick, state?.phase),
      forecast: buildForecast({
        gold: province.gold ?? 0,
        food: province.food ?? 0,
        metal: province.metal ?? 0,
        peasants: province.peasants ?? 0,
        incomeChange: province.incomeChange ?? 0,
        foodChange: province.foodChange ?? 0,
        metalChange: province.metalChange,
        peasantChange: province.peasantChange ?? 0,
        aliveTicks: province.aliveTicks,
        vacation: province.vacation,
      }),
      activity,
      checklist: buildChecklist({
        acres: province.acres ?? 0,
        landUsed,
        buildOrders: province.buildOrders.length,
        researchOrders: province.researchOrders.length,
        sciences: province.science.length,
        raceName: race?.name ?? '',
        militaryOrders: province.militaryOrders.length,
        militaryTotal,
        exploreOrders: province.exploreOrders.length,
        councilId: province.councilId ?? 0,
        inKingdom: Boolean(province.kiID),
        kingdomChatMessages,
      }),
      rank: {
        networth: province.rankNetworth,
        movement: rankMovement(province.rankNetworth, province.rankNetworthDay),
        total: aliveCount,
      },
      effects: province.effects.map(effect => ({
        id: effect.id,
        type: effect.type,
        magnitude: effect.magnitude,
        ticksLeft: effect.ticksLeft,
      })),
      news: news.map(item => ({ id: item.id, message: item.message, createdAt: item.createdAt.toISOString() })),
    };
    return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalErrorResponse(request, '/api/overview', error);
  }
}
