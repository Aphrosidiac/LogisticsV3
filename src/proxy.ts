import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'logistics-secret-change-in-production';
const COOKIE_NAME = 'logistics_session';

// Inline verify (middleware runs in Edge runtime — can't import from lib)
function verifyToken(token: string): boolean {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  const expected = `${payload}.${sig}`;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always forward pathname so layout can detect /login
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Allow login page, auth API, and public assets through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/internal/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo-')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
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
