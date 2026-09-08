import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { lockProvinceRows, withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

async function getProvinceId(request: NextRequest): Promise<number | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true } });
  return user?.pID && user.pID !== 0 ? user.pID : null;
}

export async function GET(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const [allAdvisors, me, races] = await Promise.all([
      prisma.advisor.findMany({ orderBy: { id: 'asc' } }),
      prisma.province.findUnique({ where: { id: pID }, select: { councilId: true, raceId: true, gold: true } }),
      prisma.race.findMany({ select: { id: true, name: true } }),
    ]);
    const raceName = races.find(race => race.id === me?.raceId)?.name;
    const advisors = allAdvisors.filter(advisor => !raceName || advisor.races.split(',').includes(raceName));
    return NextResponse.json({
      advisors,
      councilId: me?.councilId ?? 0,
      gold: me?.gold ?? 0,
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/council GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const pID = await getProvinceId(request);
    if (!pID) return NextResponse.json({ error: 'No province found' }, { status: 404 });
    const { advisorId } = await request.json();
    const aid = Number(advisorId) || 0;
    const message = await withSerializableTransaction(async tx => {
      await lockProvinceRows(tx, [pID]);
      const province = await tx.province.findUnique({ where: { id: pID } });
      if (!province) throw new Error('Province not found');
      if (province.status !== 'Alive' || (province.acres ?? 0) <= 0) throw new Error('Your province is not active');
      if (province.vacation) throw new Error('You are on vacation and cannot act. End it in Preferences.');
      if (!aid) {
        await tx.province.update({ where: { id: pID }, data: { councilId: 0 } });
        return 'Advisor dismissed.';
      }
      const [advisor, races] = await Promise.all([
        tx.advisor.findUnique({ where: { id: aid } }),
        tx.race.findMany({ select: { id: true, name: true } }),
      ]);
      if (!advisor) throw new Error('Unknown advisor');
      if (province.councilId === aid) return `${advisor.name} is already serving on your council.`;
      const raceName = races.find(race => race.id === province.raceId)?.name;
      if (raceName && !advisor.races.split(',').includes(raceName)) {
        throw new Error(`${advisor.name} refuses to enter your service`);
      }
      if ((province.gold ?? 0) < advisor.costGold) throw new Error('Not enough gold');
      await tx.province.update({
        where: { id: pID },
        data: { councilId: aid, gold: { decrement: advisor.costGold } },
      });
      return `${advisor.name} has been hired.`;
    });
    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message === 'Unknown advisor'
      || message === 'Province not found'
      || message === 'Not enough gold'
      || message === 'Your province is not active'
      || message === 'You are on vacation and cannot act. End it in Preferences.'
      || message.endsWith('refuses to enter your service')
    ) return NextResponse.json({ error: message }, { status: 400 });
    return internalErrorResponse(request, '/api/council POST', error);
  }
}
