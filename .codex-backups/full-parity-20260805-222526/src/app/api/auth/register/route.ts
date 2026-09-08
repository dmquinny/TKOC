import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit';
import { withSerializableTransaction } from '@/lib/transactions';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';

const MAX_ACCOUNTS_PER_IP = 3;

export async function POST(request: Request) {
  try {
    const { username, password, email } = await request.json();
    const cleanUsername = String(username ?? '').trim();
    const cleanPassword = String(password ?? '');
    const cleanEmail = String(email ?? '').trim().toLowerCase();

    if (!/^[A-Za-z0-9_]{3,16}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3–16 letters, numbers, or underscores.' },
        { status: 400 }
      );
    }
    if (cleanPassword.length < 8 || cleanPassword.length > 72) {
      return NextResponse.json({ error: 'Password must be between 8 and 72 characters.' }, { status: 400 });
    }
    if (
      cleanEmail.length > 100
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const identity = requestIdentity(request);
    const rate = await consumeRateLimit(`register:${identity}`, 10, 60 * 60 * 1000);
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/auth/register', 'Registration rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }
    const ip = identity === 'unknown' ? null : identity;

    const hashedPassword = await bcrypt.hash(cleanPassword, 12);

    const newUser = await withSerializableTransaction(async tx => {
      if (ip && await tx.user.count({ where: { regIp: ip } }) >= MAX_ACCOUNTS_PER_IP) {
        throw new Error('Too many accounts have been created from your network.');
      }
      const existingUser = await tx.user.findFirst({
        where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] },
        select: { id: true },
      });
      if (existingUser) throw new Error('Username or email already exists');
      return tx.user.create({
        data: {
          username: cleanUsername,
          email: cleanEmail,
          password: hashedPassword,
          created: new Date(),
          dob: new Date(),
          regIp: ip,
        },
      });
    });

    return NextResponse.json(
      { message: 'User created successfully', userId: newUser.id },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Too many accounts have been created from your network.') {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (
      message === 'Username or email already exists'
      || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    ) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 });
    }
    return internalErrorResponse(request, '/api/auth/register', error);
  }
}
