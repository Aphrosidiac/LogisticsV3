// Internal endpoint called by cron-worker to sync whatsapp_connected state to DB
// Not exposed to the public — only called from localhost:3001
import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';

export async function POST(request: NextRequest) {
  try {
    const { connected } = await request.json();
    await db.saveConfig({ whatsappConnected: !!connected });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
