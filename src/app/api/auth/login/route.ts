import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { signAuthToken } from '@/lib/auth';
import { consumeRateLimit, requestIdentity } from '@/lib/rate-limit';
import { internalErrorResponse, recordSuspiciousAction } from '@/lib/operational-events';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const cleanUsername = String(username ?? '').trim();
    const cleanPassword = String(password ?? '');

    if (!cleanUsername || !cleanPassword || cleanUsername.length > 16 || cleanPassword.length > 72) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }
    const rate = await consumeRateLimit(
      `login:${requestIdentity(request)}:${cleanUsername.toLowerCase()}`,
      10,
      15 * 60 * 1000,
    );
    if (!rate.allowed) {
      await recordSuspiciousAction(request, '/api/auth/login', 'Login rate limit exceeded', {
        detail: `Username: ${cleanUsername}`,
      });
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findFirst({
      where: { username: cleanUsername }
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.status === 'Banned') {
      return NextResponse.json(
        { error: 'This account has been banned.' },
        { status: 403 }
      );
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signAuthToken({
      userId: user.id,
      username: user.username,
      sessionVersion: user.sessionVersion,
    });

    const response = NextResponse.json(
      { message: 'Login successful', pID: user.pID },
      { status: 200 }
    );

    // Set HTTP-only cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Use lax to prevent login loss on redirect
      maxAge: 60 * 60 * 24,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      path: '/',
    });

    return response;
  } catch (error) {
    return internalErrorResponse(request, '/api/auth/login', error);
  }
}
