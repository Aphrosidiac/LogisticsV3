// WhatsApp init endpoint — proxies to cron-worker:3001
import { NextRequest, NextResponse } from 'next/server';
import { initializeWhatsApp, destroyWhatsApp, getWhatsAppState } from '@/lib/whatsapp-client';
import { withAuth } from '@/lib/api-auth';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const state = await getWhatsAppState();
    return NextResponse.json({
      status: state.connected ? 'ready' : state.initializing ? 'initializing' : 'idle',
      qrCode: state.qrCode,
      message: state.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const result = await initializeWhatsApp();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    await destroyWhatsApp();
    return NextResponse.json({ status: 'success', message: 'WhatsApp disconnected successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to disconnect WhatsApp' },
      { status: 500 }
    );
  }
});
