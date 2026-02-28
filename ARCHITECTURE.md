# Architecture & Operations Guide

## Overview

This app has two processes that must run together:

| Process | Command | Port | Role |
|---------|---------|------|------|
| Next.js app | `npm run dev` | 3000 | UI + API routes |
| Cron worker | `node cron-worker.mjs` | 3001 | WhatsApp client + cron scheduler |

**Both must be running.** The Next.js app proxies all WhatsApp operations to the worker.

---

## Cron Worker (`cron-worker.mjs`)

### What it does
- Owns the WhatsApp Puppeteer client (persistent — survives Next.js restarts)
- Exposes an internal HTTP API on **port 3001** for Next.js to call
- Runs the auto-distribution cron loop every 60 seconds
- Auto-reconnects WhatsApp from saved session on startup
- Handles exponential backoff reconnect on disconnect (5s → 10s → 20s... max 5 min)
- Cleans up Chrome processes on graceful shutdown

### Starting the worker

```bash
node cron-worker.mjs
```

Run this alongside `npm run dev` in a separate terminal. Keep it running permanently in production (use PM2 or similar).

### Worker HTTP API (port 3001 — internal only, not exposed publicly)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Returns connection state, QR code, reconnect attempts |
| `POST` | `/init` | Tells worker to start WhatsApp (idempotent) |
| `POST` | `/disconnect` | Destroys WhatsApp client, clears session state |
| `POST` | `/send` | Sends a WhatsApp message `{ recipient, message }` |

### Session persistence

WhatsApp session is saved to `.wwebjs_auth/` in the project root. On worker startup, if this folder exists, it auto-connects without needing a QR scan.

**You only need to scan the QR once.** After that, the worker reconnects automatically on every restart.

---

## WhatsApp Connection Flow

### First-time setup
1. Start the worker: `node cron-worker.mjs`
2. Start Next.js: `npm run dev`
3. Open `http://localhost:3000/whatsapp`
4. Click **Connect WhatsApp**
5. Scan the QR code with your phone
6. Done — session is saved to `.wwebjs_auth/`

### Subsequent startups
1. Start the worker: `node cron-worker.mjs`
2. Worker auto-connects from saved session (no QR needed)
3. Start Next.js: `npm run dev`
4. WhatsApp page shows **Connected** immediately

### If WhatsApp disconnects
The worker automatically schedules a reconnect with exponential backoff. No manual action needed. The UI will show "Not connected" temporarily and recover on its own.

---

## Auto-Distribution Cron

The worker polls `GET /api/cron/distribute` every 60 seconds.

### What the cron does (in order)
1. Checks current time against `distributionTime` config (set in Admin Settings)
2. Checks `lastAutoDistributionDate` — skips if already ran today
3. Loads all pending orders + active drivers
4. Loads any pending balances scheduled for tomorrow (partial deliveries from previous days)
5. Runs distribution algorithm
6. Saves distribution to DB
7. Marks assigned orders as `assigned`
8. Creates pending balances for any partially-fulfilled orders
9. Marks today as done (`lastAutoDistributionDate = today`)
10. Sends WhatsApp message to each assigned driver (if WhatsApp connected)

### Pending Balances
When an order can't be fully assigned in one distribution (driver capacity exceeded), the remaining pallets become a **pending balance** scheduled for the next day. The next cron run picks these up and includes them in the distribution automatically.

This means a driver may receive **multiple WhatsApp messages** if they are assigned both a pending balance and a new order — this is correct behavior.

### Manual cron trigger (for testing)
```bash
# Trigger immediately (bypasses time check if distributionTime is 00:00)
curl http://localhost:3000/api/cron/distribute

# Reset "already ran today" flag to force a re-run
# (replace the ID with your actual app_config row ID)
curl -X PATCH "https://<project>.supabase.co/rest/v1/app_config?id=eq.<id>" \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"last_auto_distribution_date": "2000-01-01"}'
```

---

## Next.js API Routes (WhatsApp)

All WhatsApp routes are thin proxies to the worker. No Puppeteer runs inside Next.js.

| Route | Method | Proxies to |
|-------|--------|-----------|
| `/api/whatsapp/status` | `GET` | `localhost:3001/status` |
| `/api/whatsapp/init` | `GET` | `localhost:3001/status` (for UI polling) |
| `/api/whatsapp/init` | `POST` | `localhost:3001/init` |
| `/api/whatsapp/init` | `DELETE` | `localhost:3001/disconnect` |
| `/api/whatsapp/send` | `POST` | `localhost:3001/send` |
| `/api/internal/whatsapp-sync` | `POST` | Called **by** the worker to sync `whatsapp_connected` to DB |

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used by worker to call Next.js API
```

---

## Production Checklist

- [ ] Run worker with a process manager (PM2, systemd, etc.) so it restarts on crash
- [ ] Set `NEXT_PUBLIC_SITE_URL` to your production domain
- [ ] Scan QR once on the production server to save session
- [ ] Keep `.wwebjs_auth/` persistent across deployments (do not wipe it)
- [ ] Port 3001 should **not** be exposed publicly — firewall it to localhost only
- [ ] Set `distributionTime` in Admin Settings to your desired daily run time

### PM2 example
```bash
pm2 start cron-worker.mjs --name logistics-worker
pm2 start npm --name logistics-app -- run start
pm2 save
pm2 startup
```
