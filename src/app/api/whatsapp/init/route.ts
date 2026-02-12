// WhatsApp initialization and QR code generation endpoint
import { NextRequest, NextResponse } from 'next/server';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';

// Store WhatsApp client instance (in production, use Redis or similar)
let whatsappClient: Client | null = null;
let qrCodeData: string | null = null;
let isReady = false;
let isInitializing = false;

export async function GET(request: NextRequest) {
    try {
        // If already initialized and ready
        if (whatsappClient && isReady) {
            return NextResponse.json({
                status: 'ready',
                message: 'WhatsApp is connected and ready',
            });
        }

        // If initialization in progress
        if (isInitializing) {
            return NextResponse.json({
                status: 'initializing',
                qrCode: qrCodeData,
                message: 'WhatsApp is initializing. Scan QR code if available.',
            });
        }

        // Initialize WhatsApp client
        isInitializing = true;
        qrCodeData = null;
        isReady = false;

        whatsappClient = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth',
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                ],
            },
        });

        // QR code event
        whatsappClient.on('qr', async (qr) => {
            try {
                qrCodeData = await qrcode.toDataURL(qr);
            } catch (err) {
                console.error('QR code generation error:', err);
            }
        });

        // Ready event
        whatsappClient.on('ready', () => {
            isReady = true;
            isInitializing = false;
            qrCodeData = null;
        });

        // Auth failure event
        whatsappClient.on('auth_failure', (msg) => {
            console.error('WhatsApp authentication failed:', msg);
            isReady = false;
            isInitializing = false;
            qrCodeData = null;
        });

        // Disconnected event
        whatsappClient.on('disconnected', (reason) => {
            console.log('WhatsApp disconnected:', reason);
            isReady = false;
            whatsappClient = null;
        });

        // Initialize
        await whatsappClient.initialize();

        return NextResponse.json({
            status: 'initializing',
            qrCode: qrCodeData,
            message: 'WhatsApp client initialized. Waiting for authentication.',
        });
    } catch (error: any) {
        isInitializing = false;
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
        if (whatsappClient) {
            await whatsappClient.destroy();
            whatsappClient = null;
            isReady = false;
            qrCodeData = null;
            isInitializing = false;
        }

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

// Get current status
export { whatsappClient, isReady };
