// WhatsApp init endpoint — proxies to cron-worker:3001
import { NextRequest, NextResponse } from 'next/server';
import { initializeWhatsApp, destroyWhatsApp, getWhatsAppState } from '@/lib/whatsapp-client';

export async function GET(request: NextRequest) {
  try {
    // Return current worker state (used by UI polling loop)
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
}

export async function POST(request: NextRequest) {
  try {
    const result = await initializeWhatsApp();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await destroyWhatsApp();
    return NextResponse.json({ status: 'success', message: 'WhatsApp disconnected successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to disconnect WhatsApp' },
      { status: 500 }
    );
  }
}
