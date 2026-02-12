// WhatsApp message sending endpoint
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'whatsapp-web.js';

// Import client from init route (in production, use proper state management)
let whatsappClient: Client | null = null;
let isReady = false;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { recipient, message } = body;

        if (!recipient || !message) {
            return NextResponse.json(
                { status: 'error', message: 'Recipient and message are required' },
                { status: 400 }
            );
        }

        // Check if client is ready
        if (!whatsappClient || !isReady) {
            return NextResponse.json(
                {
                    status: 'error',
                    message: 'WhatsApp is not connected. Please initialize first.',
                },
                { status: 503 }
            );
        }

        // Format phone number (remove non-digits, add country code if needed)
        let formattedNumber = recipient.replace(/\D/g, '');

        // Add Malaysia country code if not present
        if (!formattedNumber.startsWith('60') && formattedNumber.length === 10) {
            formattedNumber = '60' + formattedNumber;
        }

        // WhatsApp ID format: number@c.us
        const chatId = `${formattedNumber}@c.us`;

        // Send message
        await whatsappClient.sendMessage(chatId, message);

        return NextResponse.json({
            status: 'success',
            message: 'Message sent successfully',
            recipient: formattedNumber,
        });
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
}

// Batch send endpoint
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages } = body; // Array of { recipient, message }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { status: 'error', message: 'Messages array is required' },
                { status: 400 }
            );
        }

        if (!whatsappClient || !isReady) {
            return NextResponse.json(
                {
                    status: 'error',
                    message: 'WhatsApp is not connected. Please initialize first.',
                },
                { status: 503 }
            );
        }

        const results = [];

        for (const msg of messages) {
            try {
                let formattedNumber = msg.recipient.replace(/\D/g, '');

                if (!formattedNumber.startsWith('60') && formattedNumber.length === 10) {
                    formattedNumber = '60' + formattedNumber;
                }

                const chatId = `${formattedNumber}@c.us`;
                await whatsappClient.sendMessage(chatId, msg.message);

                results.push({
                    recipient: formattedNumber,
                    status: 'success',
                });

                // Add delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error: any) {
                results.push({
                    recipient: msg.recipient,
                    status: 'failed',
                    error: error.message,
                });
            }
        }

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
}
