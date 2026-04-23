// ============================================================================
// Cron Worker — persistent process that owns WhatsApp + cron scheduling
// Run alongside `npm run dev` with: node cron-worker.mjs
//
// Exposes an internal HTTP API on port 3001 for Next.js to proxy to:
//   GET  /status        — WhatsApp connection state + QR code
//   POST /init          — Start WhatsApp (or return current state)
//   POST /disconnect    — Destroy WhatsApp client
//   POST /send          — Send a WhatsApp message { recipient, message }
//
// Handles:
//   - Session restore from .wwebjs_auth on startup
//   - Auto-reconnect with exponential backoff on disconnect
//   - Graceful Chrome cleanup on shutdown
//   - Cron loop: polls /api/cron/distribute every 60s
// ============================================================================

import http from 'http';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join } from 'path';

const require = createRequire(import.meta.url);

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const WORKER_PORT = 3001;
const CRON_INTERVAL_MS = 60_000;
const SESSION_PATH = join(process.cwd(), '.wwebjs_auth');
const MAX_CRON_FAILURES = 10;

// ── WhatsApp State ──────────────────────────────────────────────────────────

const wa = {
    client: null,
    isReady: false,
    isInitializing: false,
    qrCode: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    manualDisconnect: false,
};

function log(tag, msg) {
    console.log(`[${tag}] ${new Date().toISOString()} — ${msg}`);
}

// ── Number formatter ────────────────────────────────────────────────────────

function formatNumber(recipient) {
    let n = recipient.replace(/\D/g, '');
    if (n.startsWith('0')) n = '6' + n;
    else if (!n.startsWith('60') && n.length <= 11) n = '60' + n;
    return n + '@c.us';
}

// ── WhatsApp Init ───────────────────────────────────────────────────────────

async function initWhatsApp() {
    if (wa.isReady && wa.client) {
        log('WA', 'Already connected');
        return;
    }
    if (wa.isInitializing) {
        log('WA', 'Already initializing');
        return;
    }

    // Destroy any zombie client
    if (wa.client) {
        try { await wa.client.destroy(); } catch { /* ignore */ }
        wa.client = null;
    }

    wa.isInitializing = true;
    wa.qrCode = null;
    log('WA', `Starting WhatsApp client (attempt ${wa.reconnectAttempts + 1})...`);

    try {
        const { Client, LocalAuth } = require('whatsapp-web.js');
        const qrcode = require('qrcode');

        const client = new Client({
            authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            },
        });

        client.on('qr', async (qrString) => {
            try {
                wa.qrCode = await qrcode.toDataURL(qrString);
                log('WA', 'QR code ready — scan with WhatsApp mobile');
            } catch {
                wa.qrCode = null;
            }
        });

        client.on('ready', async () => {
            wa.isReady = true;
            wa.isInitializing = false;
            wa.qrCode = null;
            wa.reconnectAttempts = 0;
            clearReconnectTimer();
            log('WA', 'Connected and ready');
            await syncConnectedState(true);
        });

        client.on('auth_failure', async (msg) => {
            log('WA', `Auth failure: ${msg}`);
            wa.isReady = false;
            wa.qrCode = null;
            // Keep isInitializing = true so QR re-emits
            await syncConnectedState(false);
        });

        client.on('disconnected', async (reason) => {
            log('WA', `Disconnected: ${reason}`);
            wa.isReady = false;
            wa.isInitializing = false;
            wa.qrCode = null;
            wa.client = null;
            await syncConnectedState(false);
            if (!wa.manualDisconnect) scheduleReconnect();
            wa.manualDisconnect = false;
        });

        wa.client = client;
        client.initialize();

    } catch (err) {
        log('WA', `Init error: ${err.message}`);
        wa.isInitializing = false;
        wa.client = null;
        scheduleReconnect();
    }
}

// ── Reconnect with exponential backoff ──────────────────────────────────────

function clearReconnectTimer() {
    if (wa.reconnectTimer) {
        clearTimeout(wa.reconnectTimer);
        wa.reconnectTimer = null;
    }
}

function scheduleReconnect() {
    if (!existsSync(SESSION_PATH)) {
        log('WA', 'No saved session — skipping auto-reconnect (scan QR to connect)');
        return;
    }
    if (wa.isInitializing) {
        log('WA', 'Already initializing — skipping reconnect schedule');
        return;
    }
    clearReconnectTimer();
    const backoffMs = Math.min(5000 * Math.pow(2, wa.reconnectAttempts), 5 * 60_000); // max 5 min
    wa.reconnectAttempts++;
    log('WA', `Reconnecting in ${backoffMs / 1000}s (attempt ${wa.reconnectAttempts})...`);
    wa.reconnectTimer = setTimeout(() => {
        wa.reconnectTimer = null;
        initWhatsApp();
    }, backoffMs);
}

// ── DB sync ─────────────────────────────────────────────────────────────────

async function syncConnectedState(connected) {
    try {
        await fetch(`${BASE_URL}/api/internal/whatsapp-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connected }),
        });
    } catch {
        // non-fatal
    }
}

// ── Send message ─────────────────────────────────────────────────────────────

async function sendMessage(recipient, message) {
    if (!wa.isReady || !wa.client) {
        return { success: false, error: 'WhatsApp not connected' };
    }
    try {
        const chatId = formatNumber(recipient);
        await wa.client.sendMessage(chatId, message);
        return { success: true, recipient: chatId };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ── Destroy ──────────────────────────────────────────────────────────────────

async function destroyWhatsApp() {
    clearReconnectTimer();
    wa.manualDisconnect = true;
    if (wa.client) {
        try { await wa.client.destroy(); } catch { /* ignore */ }
        wa.client = null;
    }
    wa.isReady = false;
    wa.isInitializing = false;
    wa.qrCode = null;
    wa.reconnectAttempts = 0;
    wa.manualDisconnect = false;
    await syncConnectedState(false);
    log('WA', 'Disconnected');
}

// ── HTTP Server on port 3001 ─────────────────────────────────────────────────

function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
        });
    });
}

function send(res, status, data) {
    const json = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
    res.end(json);
}

const server = http.createServer(async (req, res) => {
    const url = req.url;
    const method = req.method;

    // GET /status
    if (method === 'GET' && url === '/status') {
        return send(res, 200, {
            connected: wa.isReady,
            initializing: wa.isInitializing,
            qrCode: wa.qrCode,
            reconnectAttempts: wa.reconnectAttempts,
            message: wa.isReady ? 'Connected' : wa.isInitializing ? 'Initializing' : 'Not connected',
        });
    }

    // POST /init
    if (method === 'POST' && url === '/init') {
        initWhatsApp(); // fire-and-forget
        return send(res, 200, {
            status: wa.isReady ? 'ready' : wa.isInitializing ? 'initializing' : 'starting',
            qrCode: wa.qrCode,
            message: wa.isReady ? 'Connected' : 'Starting...',
        });
    }

    // POST /disconnect
    if (method === 'POST' && url === '/disconnect') {
        await destroyWhatsApp();
        return send(res, 200, { status: 'success', message: 'Disconnected' });
    }

    // POST /send
    if (method === 'POST' && url === '/send') {
        const body = await readBody(req);
        if (!body.recipient || !body.message) {
            return send(res, 400, { status: 'error', message: 'recipient and message required' });
        }
        const result = await sendMessage(body.recipient, body.message);
        return send(res, result.success ? 200 : 500, {
            status: result.success ? 'success' : 'error',
            recipient: result.recipient,
            message: result.error || 'Message sent',
        });
    }

    send(res, 404, { error: 'Not found' });
});

server.listen(WORKER_PORT, '127.0.0.1', () => {
    log('HTTP', `Worker API listening on 127.0.0.1:${WORKER_PORT}`);
});

// ── Cron Loop ────────────────────────────────────────────────────────────────

let cronConsecutiveFailures = 0;

async function runCron() {
    try {
        const res = await fetch(`${BASE_URL}/api/cron/distribute`);
        if (!res.ok) {
            cronConsecutiveFailures++;
            log('CRON', `HTTP ${res.status} from distribute API (failures: ${cronConsecutiveFailures}/${MAX_CRON_FAILURES})`);
            if (cronConsecutiveFailures >= MAX_CRON_FAILURES) {
                log('CRON', `Pausing cron after ${MAX_CRON_FAILURES} consecutive failures — will retry in 10 min`);
                setTimeout(() => { cronConsecutiveFailures = 0; log('CRON', 'Resuming cron after cooldown'); }, 10 * 60_000);
            }
            return;
        }
        cronConsecutiveFailures = 0;
        const data = await res.json();
        if (data.ran) {
            if (data.noOrders) {
                log('CRON', `No pending orders for ${data.targetDate}`);
            } else {
                log('CRON', `Distribution ran for ${data.targetDate} — Orders: ${data.summary?.totalOrders}, Drivers: ${data.summary?.assignedDrivers}`);
                if (data.whatsapp?.length > 0) {
                    const sent = data.whatsapp.filter(w => w.success).length;
                    log('CRON', `WhatsApp: ${sent}/${data.whatsapp.length} sent`);
                }
            }
        }
    } catch (err) {
        cronConsecutiveFailures++;
        log('CRON', `Error: ${err.message} (failures: ${cronConsecutiveFailures}/${MAX_CRON_FAILURES})`);
        if (cronConsecutiveFailures >= MAX_CRON_FAILURES) {
            log('CRON', `Pausing cron after ${MAX_CRON_FAILURES} consecutive failures — will retry in 10 min`);
            setTimeout(() => { cronConsecutiveFailures = 0; log('CRON', 'Resuming cron after cooldown'); }, 10 * 60_000);
        }
    }
}

const cronInterval = setInterval(() => {
    if (cronConsecutiveFailures >= MAX_CRON_FAILURES) return;
    runCron();
}, CRON_INTERVAL_MS);
log('CRON', `Polling ${BASE_URL}/api/cron/distribute every ${CRON_INTERVAL_MS / 1000}s`);

// ── Startup ──────────────────────────────────────────────────────────────────

log('WORKER', 'Starting up...');

// Auto-connect if session exists
if (existsSync(SESSION_PATH)) {
    log('WA', 'Saved session found — auto-connecting...');
    initWhatsApp();
} else {
    log('WA', 'No saved session — open the WhatsApp page and scan QR to connect');
}

// Run cron immediately on start
runCron();

// ── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown() {
    log('WORKER', 'Shutting down...');
    clearInterval(cronInterval);
    clearReconnectTimer();
    server.close();
    if (wa.client) {
        try { await wa.client.destroy(); } catch { /* ignore */ }
    }
    log('WORKER', 'Goodbye.');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
