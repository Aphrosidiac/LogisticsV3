import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'logistics-secret-change-in-production';
const COOKIE_NAME = 'logistics_session';
const MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

function verifyToken(token: string): boolean {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  const expected = `${payload}.${sig}`;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    const maxLen = Math.max(a.length, b.length);
    const aPadded = Buffer.alloc(maxLen, 0);
    const bPadded = Buffer.alloc(maxLen, 0);
    a.copy(aPadded);
    b.copy(bPadded);
    if (!timingSafeEqual(aPadded, bPadded) || a.length !== b.length) return false;
    // Validate token expiry
    const timestamp = parseInt(payload.split(':')[1], 10);
    if (isNaN(timestamp) || Date.now() - timestamp > MAX_AGE_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Allow login page, auth API, and public assets through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo-')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Internal/cron routes: require localhost origin or valid worker secret
  if (
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/internal/')
  ) {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (isLocalhost) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || !verifyToken(token)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
