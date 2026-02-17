// WhatsApp initialization and QR code generation endpoint
import { NextRequest, NextResponse } from 'next/server';
import { initializeWhatsApp, destroyWhatsApp } from '@/lib/whatsapp-client';

export async function GET(request: NextRequest) {
  try {
    const result = await initializeWhatsApp();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('WhatsApp initialization error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to initialize WhatsApp',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await destroyWhatsApp();

    return NextResponse.json({
      status: 'success',
      message: 'WhatsApp disconnected successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to disconnect WhatsApp',
      },
      { status: 500 }
    );
  }
}
