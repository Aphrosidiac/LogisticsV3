// WhatsApp message sending endpoint
import { NextRequest, NextResponse } from 'next/server';
import {
  sendWhatsAppMessage,
  sendBatchWhatsAppMessages,
} from '@/lib/whatsapp-client';
import { withAuth } from '@/lib/api-auth';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { recipient, message } = body;

    if (!recipient || !message) {
      return NextResponse.json(
        { status: 'error', message: 'Recipient and message are required' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(recipient, message);

    if (result.success) {
      return NextResponse.json({
        status: 'success',
        message: 'Message sent successfully',
        recipient: result.recipient,
      });
    } else {
      return NextResponse.json(
        {
          status: 'error',
          message: result.error || 'Failed to send message',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to send message',
      },
      { status: 500 }
    );
  }
});

// Batch send endpoint
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { messages } = body; // Array of { recipient, message }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { status: 'error', message: 'Messages array is required' },
        { status: 400 }
      );
    }

    const results = await sendBatchWhatsAppMessages(messages);

    return NextResponse.json({
      status: 'success',
      message: 'Batch send completed',
      results,
    });
  } catch (error: any) {
    console.error('WhatsApp batch send error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to send messages',
      },
      { status: 500 }
    );
  }
});
