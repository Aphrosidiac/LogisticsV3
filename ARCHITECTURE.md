# Architecture & Operations Guide

## Overview

This app has two processes that must run together:

| Process | Command | Port | Role |
|---------|---------|------|------|
| Next.js app | `npm run dev` | 3000 | UI + API routes |
| Cron worker | `node cron-worker.mjs` | 3001 | WhatsApp client + cron scheduler |

**Both must be running.** The Next.js app proxies all WhatsApp operations to the worker.

---

## Authentication

The app uses a proxy-based auth system (`src/proxy.ts`) that runs on every request:

- **Token format**: HMAC-SHA256 signed payload stored in `logistics_session` cookie
- **Protected routes**: All routes except `/login`, `/api/auth/*`, `/_next/*`, `/favicon*`, `/logo-*`
- **Unauthenticated users**: Redirected to `/login`
- **API auth**: Internal endpoints use `withInternalAuth()` from `src/lib/api-auth.ts`

The proxy also sets `x-pathname` header so the layout can detect the login page and render it without the sidebar.

---

## DB Layer Architecture

The database layer is split into focused modules:

| Module | Responsibility |
|--------|---------------|
| `db-orders.ts` | Order CRUD, holding orders, status updates |
| `db-drivers.ts` | Driver CRUD, phone updates |
| `db-config.ts` | App config load/save, distribution date tracking |
| `db-distributions.ts` | Save/load distribution results |
| `db-logs.ts` | Activity log operations |
| `db-whatsapp.ts` | WhatsApp message log |
| `db-zones.ts` | Zone and district CRUD |
| `db-supabase.ts` | Barrel re-export of all modules |

All modules import the Supabase client from `supabase.ts`.

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useWhatsAppSender` | Manages WhatsApp connection state, per-recipient send tracking, broadcast |
| `useMarkDelivered` | Handles marking driver assignments as delivered with loading states |
| `usePagination` | Generic pagination logic for tables |
| `useModal` | Modal open/close state management |

---

## Theme System

Dark/light mode is implemented via CSS-only overrides:

- **Toggle**: `ThemeToggle` component in the top-right corner
- **Persistence**: `localStorage.getItem('theme')` — `'dark'` (default) or `'light'`
- **Mechanism**: Adds/removes `html.light` class on `<html>` element
- **CSS**: `globals.css` contains `html.light .class-name` rules that remap dark colors to light equivalents
- **Logo handling**: `.logo-invertible` class applies `filter: invert(1)` in light mode

No component files need changes for theme support — all handled via CSS specificity overrides.

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
4. Loads any pending balances scheduled for tomorrow
5. Runs distribution algorithm
6. Saves distribution to DB
7. Marks assigned orders as `assigned`
8. Creates pending balances for any partially-fulfilled orders
9. Marks today as done (`lastAutoDistributionDate = today`)
10. Sends WhatsApp messages based on `autoMessageRecipients` config:
    - `'drivers'` — individual assignments to each driver with a phone number
    - `'admins'` — full distribution report to all admin numbers
    - `'both'` — both of the above

### Pending Balances
When an order can't be fully assigned in one distribution (driver capacity exceeded), the remaining pallets become a **pending balance** scheduled for the next day. The next cron run picks these up and includes them in the distribution automatically.

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
AUTH_SECRET=your-secret-key                  # HMAC signing key for session tokens
```

---

## Production Checklist

- [ ] Run worker with a process manager (PM2, systemd, etc.) so it restarts on crash
- [ ] Set `NEXT_PUBLIC_SITE_URL` to your production domain
- [ ] Set `AUTH_SECRET` to a strong random value
- [ ] Scan QR once on the production server to save session
- [ ] Keep `.wwebjs_auth/` persistent across deployments (do not wipe it)
- [ ] Port 3001 should **not** be exposed publicly — firewall it to localhost only
- [ ] Set `distributionTime` in Admin Settings to your desired daily run time
- [ ] Configure `autoMessageRecipients` in Admin Settings (drivers, admins, or both)

### PM2 example
```bash
pm2 start cron-worker.mjs --name logistics-worker
pm2 start npm --name logistics-app -- run start
pm2 save
pm2 startup
```
