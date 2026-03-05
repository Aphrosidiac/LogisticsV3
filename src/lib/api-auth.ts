// API route auth middleware
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './auth';

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * Wraps an API route handler with session authentication.
 * Returns 401 if no valid session cookie is present.
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request);
  };
}

/**
 * For internal endpoints called from cron-worker (localhost only).
 * Checks that the request originates from localhost OR has a valid session.
 */
export function withInternalAuth(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest) => {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (isLocalhost) {
      return handler(request);
    }
    // Fall back to session auth for non-localhost
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request);
  };
}
