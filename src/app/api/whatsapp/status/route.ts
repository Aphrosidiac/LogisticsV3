// WhatsApp status check endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppState } from '@/lib/whatsapp-client';

export async function GET(request: NextRequest) {
  try {
    const state = getWhatsAppState();

    return NextResponse.json({
      connected: state.isReady,
      ready: state.isReady,
      initializing: state.isInitializing,
      message: state.isReady
        ? 'WhatsApp is connected and ready'
        : state.isInitializing
        ? 'WhatsApp is initializing'
        : 'WhatsApp is not connected',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to check status',
      },
      { status: 500 }
    );
  }
}
