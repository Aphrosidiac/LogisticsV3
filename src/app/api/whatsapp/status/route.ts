// WhatsApp status check endpoint — proxies to cron-worker:3001
import { NextResponse } from 'next/server';
import { getWhatsAppState } from '@/lib/whatsapp-client';
import { withAuth } from '@/lib/api-auth';

export const GET = withAuth(async () => {
  try {
    const state = await getWhatsAppState();
    return NextResponse.json({
      connected: state.connected,
      ready: state.connected,
      initializing: state.initializing,
      qrCode: state.qrCode,
      message: state.message,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { status: 'error', message: (error as Error).message || 'Failed to check status' },
      { status: 500 }
    );
  }
});
