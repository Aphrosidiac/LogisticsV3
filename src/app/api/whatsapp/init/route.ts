// WhatsApp init endpoint — proxies to cron-worker:3001
import { NextResponse } from 'next/server';
import { initializeWhatsApp, destroyWhatsApp, getWhatsAppState } from '@/lib/whatsapp-client';
import { withAuth } from '@/lib/api-auth';

export const GET = withAuth(async () => {
  try {
    const state = await getWhatsAppState();
    return NextResponse.json({
      status: state.connected ? 'ready' : state.initializing ? 'initializing' : 'idle',
      qrCode: state.qrCode,
      message: state.message,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { status: 'error', message: (error as Error).message || 'Failed to get status' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async () => {
  try {
    const result = await initializeWhatsApp();
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { status: 'error', message: (error as Error).message || 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async () => {
  try {
    await destroyWhatsApp();
    return NextResponse.json({ status: 'success', message: 'WhatsApp disconnected successfully' });
  } catch (error: unknown) {
    return NextResponse.json(
      { status: 'error', message: (error as Error).message || 'Failed to disconnect WhatsApp' },
      { status: 500 }
    );
  }
});
