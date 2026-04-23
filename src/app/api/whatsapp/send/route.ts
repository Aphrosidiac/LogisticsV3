import { NextRequest, NextResponse } from 'next/server';
import {
  sendWhatsAppMessage,
  sendBatchWhatsAppMessages,
} from '@/lib/whatsapp-client';
import { withAuth } from '@/lib/api-auth';
import { validatePhoneNumber } from '@/lib/utils';

const MAX_MESSAGE_LENGTH = 4096;
const MAX_BATCH_SIZE = 50;

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

    if (!validatePhoneNumber(recipient)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { status: 'error', message: `Message must be a string under ${MAX_MESSAGE_LENGTH} characters` },
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
  } catch (error: unknown) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: (error as Error).message || 'Failed to send message',
      },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Messages array is required' },
        { status: 400 }
      );
    }

    if (messages.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { status: 'error', message: `Batch size cannot exceed ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    for (const msg of messages) {
      if (!msg.recipient || !msg.message) {
        return NextResponse.json(
          { status: 'error', message: 'Each message must have recipient and message fields' },
          { status: 400 }
        );
      }
    }

    const results = await sendBatchWhatsAppMessages(messages);

    return NextResponse.json({
      status: 'success',
      message: 'Batch send completed',
      results,
    });
  } catch (error: unknown) {
    console.error('WhatsApp batch send error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: (error as Error).message || 'Failed to send messages',
      },
      { status: 500 }
    );
  }
});
