import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
  
  // Clear the token cookie
  response.cookies.set({
    name: 'auth_token',
    value: '',
    httpOnly: true,
    expires: new Date(0),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
