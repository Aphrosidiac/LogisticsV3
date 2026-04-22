// Internal endpoint called by cron-worker to sync whatsapp_connected state to DB
// Only accessible from localhost or with valid session
import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';
import { withInternalAuth } from '@/lib/api-auth';

export const POST = withInternalAuth(async (request: NextRequest) => {
  try {
    const { connected } = await request.json();
    await db.saveConfig({ whatsappConnected: !!connected });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
});
