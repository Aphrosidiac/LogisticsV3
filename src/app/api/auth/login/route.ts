import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ADMIN_USER, createSessionToken, getSessionCookieOptions } from '@/lib/auth';

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const attempts = loginAttempts.get(ip);

    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt;
      if (elapsed < LOCKOUT_MS) {
        const remainingMin = Math.ceil((LOCKOUT_MS - elapsed) / 60_000);
        return NextResponse.json(
          { error: `Too many login attempts. Try again in ${remainingMin} minutes.` },
          { status: 429 }
        );
      }
      loginAttempts.delete(ip);
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const usernameMatch =
      username === ADMIN_USER.username || username === ADMIN_USER.email;

    if (!usernameMatch) {
      const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(ip, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, ADMIN_USER.passwordHash);
    if (!passwordMatch) {
      const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(ip, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    loginAttempts.delete(ip);

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
