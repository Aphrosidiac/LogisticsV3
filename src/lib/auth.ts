// Simple session auth — signed cookie, no external JWT library needed
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET || 'logistics-secret-change-in-production';
const COOKIE_NAME = 'logistics_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Single hardcoded admin user
// Password is bcrypt hash of "abc123"
export const ADMIN_USER = {
  username: 'shudalogistics',
  email: 'test@gmail.com',
  // bcrypt hash of "abc123", rounds=10
  passwordHash: '$2b$10$D0FkyKIXrad7Wnf0dQUsRui3WjKa6.yWkk0LRdx81hDZy5tb0jZvW',
};

function sign(payload: string): string {
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const expected = sign(payload);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  return sign(payload);
}

export async function getSession(): Promise<{ username: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = verify(token);
    if (!payload) return null;
    const [username] = payload.split(':');
    return { username };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    maxAge: MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export { COOKIE_NAME, MAX_AGE };
