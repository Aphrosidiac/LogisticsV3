import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET || 'logistics-secret-change-in-production';
const COOKIE_NAME = 'logistics_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MAX_AGE_MS = MAX_AGE * 1000;

export const ADMIN_USER = {
  username: process.env.ADMIN_USERNAME || 'shudalogistics',
  email: process.env.ADMIN_EMAIL || 'test@gmail.com',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$EH36Bytq6E4rIIR5Pv07m.isFiDy2Ug2k9WOtcv5u5ClGs/4SqpFu',
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
    // Pad to equal length to avoid timing leak on length difference
    const maxLen = Math.max(a.length, b.length);
    const aPadded = Buffer.alloc(maxLen, 0);
    const bPadded = Buffer.alloc(maxLen, 0);
    a.copy(aPadded);
    b.copy(bPadded);
    if (!timingSafeEqual(aPadded, bPadded) || a.length !== b.length) return null;
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
    const parts = payload.split(':');
    const username = parts[0];
    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp) || Date.now() - timestamp > MAX_AGE_MS) return null;
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
    sameSite: 'strict' as const,
    path: '/',
  };
}

export { COOKIE_NAME, MAX_AGE };
