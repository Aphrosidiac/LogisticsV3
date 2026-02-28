// WhatsApp status check endpoint — proxies to cron-worker:3001
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppState } from '@/lib/whatsapp-client';

export async function GET(request: NextRequest) {
  try {
    const state = await getWhatsAppState();
    return NextResponse.json({
      connected: state.connected,
      ready: state.connected,
      initializing: state.initializing,
      qrCode: state.qrCode,
      message: state.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
