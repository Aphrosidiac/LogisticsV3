// WhatsApp client — thin HTTP proxy to cron-worker on port 3001.
// All Puppeteer/WhatsApp logic lives in cron-worker.mjs.
// Next.js API routes call these functions; they forward to the worker.

const WORKER_URL = 'http://localhost:3001';

async function workerFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${WORKER_URL}${path}`, options);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WhatsAppState {
  connected: boolean;
  initializing: boolean;
  qrCode: string | null;
  message: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getWhatsAppState(): Promise<WhatsAppState> {
  try {
    return await workerFetch('/status');
  } catch {
    return { connected: false, initializing: false, qrCode: null, message: 'Worker not running' };
  }
}

export async function initializeWhatsApp(): Promise<{
  status: string;
  qrCode?: string | null;
  message: string;
}> {
  try {
    return await workerFetch('/init', { method: 'POST' });
  } catch {
    return { status: 'error', qrCode: null, message: 'Worker not running. Start cron-worker.mjs first.' };
  }
}

export async function destroyWhatsApp(): Promise<void> {
  try {
    await workerFetch('/disconnect', { method: 'POST' });
  } catch {
    // ignore if worker not running
  }
}

export async function sendWhatsAppMessage(
  recipient: string,
  message: string
): Promise<{ success: boolean; recipient: string; error?: string }> {
  try {
    const data = await workerFetch('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, message }),
    });
    return {
      success: data.status === 'success',
      recipient: data.recipient || recipient,
      error: data.status !== 'success' ? data.message : undefined,
    };
  } catch (error: any) {
    return { success: false, recipient, error: 'Worker not running' };
  }
}

export async function sendBatchWhatsAppMessages(
  messages: Array<{ recipient: string; message: string }>,
  batchSize = 5,
  delayMs = 500
): Promise<Array<{ recipient: string; status: string; error?: string }>> {
  const results: Array<{ recipient: string; status: string; error?: string }> = [];

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        const result = await sendWhatsAppMessage(msg.recipient, msg.message);
        return {
          recipient: result.recipient,
          status: result.success ? 'success' : 'failed',
          error: result.error,
        };
      })
    );
    results.push(...batchResults);
    // Delay between batches to avoid rate limiting
    if (i + batchSize < messages.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
