// Shared WhatsApp client instance
// NOTE: This works for development and single-instance deployments
// For production with multiple instances, use Redis or similar for state management

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';

// Singleton client instance
let whatsappClient: Client | null = null;
let qrCodeData: string | null = null;
let isReady = false;
let isInitializing = false;

export interface WhatsAppState {
  client: Client | null;
  isReady: boolean;
  isInitializing: boolean;
  qrCode: string | null;
}

export function getWhatsAppState(): WhatsAppState {
  return {
    client: whatsappClient,
    isReady,
    isInitializing,
    qrCode: qrCodeData,
  };
}

export async function initializeWhatsApp(): Promise<{
  status: string;
  qrCode?: string | null;
  message: string;
}> {
  try {
    // If already initialized and ready
    if (whatsappClient && isReady) {
      return {
        status: 'ready',
        message: 'WhatsApp is connected and ready',
      };
    }

    // If initialization in progress
    if (isInitializing) {
      return {
        status: 'initializing',
        qrCode: qrCodeData,
        message: 'WhatsApp is initializing. Scan QR code if available.',
      };
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
        console.log('QR Code generated, scan with WhatsApp mobile app');
      } catch (err) {
        console.error('QR code generation error:', err);
      }
    });

    // Ready event
    whatsappClient.on('ready', () => {
      isReady = true;
      isInitializing = false;
      qrCodeData = null;
      console.log('WhatsApp client is ready');
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

    // Wait a bit for QR code generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      status: 'initializing',
      qrCode: qrCodeData,
      message: 'WhatsApp client initialized. Scan QR code to authenticate.',
    };
  } catch (error: any) {
    isInitializing = false;
    console.error('WhatsApp initialization error:', error);
    throw new Error(error.message || 'Failed to initialize WhatsApp');
  }
}

export async function destroyWhatsApp(): Promise<void> {
  if (whatsappClient) {
    await whatsappClient.destroy();
    whatsappClient = null;
    isReady = false;
    qrCodeData = null;
    isInitializing = false;
    console.log('WhatsApp client destroyed');
  }
}

export async function sendWhatsAppMessage(
  recipient: string,
  message: string
): Promise<{ success: boolean; recipient: string; error?: string }> {
  try {
    if (!whatsappClient || !isReady) {
      throw new Error('WhatsApp is not connected. Please initialize first.');
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

    return {
      success: true,
      recipient: formattedNumber,
    };
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return {
      success: false,
      recipient,
      error: error.message || 'Failed to send message',
    };
  }
}

export async function sendBatchWhatsAppMessages(
  messages: Array<{ recipient: string; message: string }>
): Promise<Array<{ recipient: string; status: string; error?: string }>> {
  if (!whatsappClient || !isReady) {
    throw new Error('WhatsApp is not connected. Please initialize first.');
  }

  const results = [];

  for (const msg of messages) {
    const result = await sendWhatsAppMessage(msg.recipient, msg.message);

    results.push({
      recipient: result.recipient,
      status: result.success ? 'success' : 'failed',
      error: result.error,
    });

    // Add delay between messages to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
