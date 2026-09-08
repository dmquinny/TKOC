import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import bcrypt from 'bcrypt';
import {
  LEGACY_MIN_VACATION_TICKS,
  LEGACY_PROVINCE_RENAMES_PER_AGE,
} from '@/lib/legacy-rules';
import { isValidMobileNav, parseMobileNav } from '@/lib/mobile-nav';
import {
  lockProvinceRows,
  lockUserRows,
  withSerializableTransaction,
} from '@/lib/transactions';
import { internalErrorResponse } from '@/lib/operational-events';

const MIN_VACATION_TICKS = LEGACY_MIN_VACATION_TICKS;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pID: true, mobileNav: true } });
    if (!user?.pID || user.pID === 0) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const p = await prisma.province.findUnique({
      where: { id: user.pID },
      select: { provinceName: true, vacation: true, vacationTicks: true },
    });
    return NextResponse.json({
      ...p,
      minVacationTicks: MIN_VACATION_TICKS,
      mobileNav: parseMobileNav(user.mobileNav),
    }, { status: 200 });
  } catch (error) {
    return internalErrorResponse(request, '/api/preferences GET', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pID || user.pID === 0) return NextResponse.json({ error: 'No province found' }, { status: 404 });

    const { action, enable, currentPassword, newPassword, mobileNav } = await request.json();

    if (action === 'mobileNav') {
      if (!isValidMobileNav(mobileNav)) {
        return NextResponse.json({ error: 'Choose four different mobile navigation destinations.' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { mobileNav: JSON.stringify(mobileNav) },
      });
      return NextResponse.json({ message: 'Mobile navigation saved.', mobileNav }, { status: 200 });
    }

    if (action === 'rename') {
      return NextResponse.json({
        error: LEGACY_PROVINCE_RENAMES_PER_AGE === 0
          ? 'Province names are fixed for the age. You can choose a new name when you found your province next age.'
          : 'Province rename limit reached for this age.',
      }, { status: 400 });
    }

    if (action === 'vacation') {
      const result = await withSerializableTransaction(async tx => {
        await lockProvinceRows(tx, [user.pID]);
        const p = await tx.province.findUnique({
          where: { id: user.pID },
          select: {
            status: true,
            vacation: true,
            vacationTicks: true,
            mana: true,
            influence: true,
          },
        });
        if (!p || p.status !== 'Alive') throw new Error('Your province is not active');
        if (enable) {
          const armiesOut = await tx.attack.count({ where: { pID: user.pID } });
          if (armiesOut > 0 || (p.mana ?? 0) < 80 || (p.influence ?? 0) < 80) {
            throw new Error('You cannot enter vacation while armies are away or while mana or influence is below 80%.');
          }
          await tx.province.update({ where: { id: user.pID }, data: { vacation: true, vacationTicks: 0 } });
          return 'Vacation mode enabled. Your province is frozen and safe from attack.';
        }
        if (p.vacation && p.vacationTicks <= MIN_VACATION_TICKS) {
          throw new Error(`You can leave vacation after ${MIN_VACATION_TICKS} full ticks (${p.vacationTicks} so far).`);
        }
        await tx.province.update({ where: { id: user.pID }, data: { vacation: false } });
        return 'Vacation mode disabled. Welcome back.';
      });
      return NextResponse.json({ message: result }, { status: 200 });
    }

    if (action === 'password') {
      const cur = String(currentPassword ?? '');
      const next = String(newPassword ?? '');
      if (next.length < 8 || next.length > 72) {
        return NextResponse.json({ error: 'New password must be between 8 and 72 characters.' }, { status: 400 });
      }
      await withSerializableTransaction(async tx => {
        await lockUserRows(tx, [userId]);
        const currentUser = await tx.user.findUnique({ where: { id: userId } });
        if (!currentUser?.password) throw new Error('No password set');
        const ok = await bcrypt.compare(cur, currentUser.password);
        if (!ok) throw new Error('Current password is incorrect');
        const hashed = await bcrypt.hash(next, 12);
        await tx.user.update({
          where: { id: userId },
          data: { password: hashed, sessionVersion: { increment: 1 } },
        });
      });
      const response = NextResponse.json({ message: 'Password changed. Please sign in again.' }, { status: 200 });
      response.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message === 'Your province is not active'
      || message === 'You cannot enter vacation while armies are away or while mana or influence is below 80%.'
      || message.startsWith('You can leave vacation after ')
      || message === 'No password set'
      || message === 'Current password is incorrect'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(request, '/api/preferences POST', error);
  }
}
