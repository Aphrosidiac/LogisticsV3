import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ADMIN_USER, createSessionToken, getSessionCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const usernameMatch =
      username === ADMIN_USER.username || username === ADMIN_USER.email;

    if (!usernameMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, ADMIN_USER.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = createSessionToken(ADMIN_USER.username);
    const opts = getSessionCookieOptions();

    const response = NextResponse.json({ ok: true, username: ADMIN_USER.username });
    response.cookies.set(opts.name, token, {
      maxAge: opts.maxAge,
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
