# Architecture & Operations Guide

## Overview

This app has two processes that must run together:

| Process | Command | Port | Role |
|---------|---------|------|------|
| Next.js app | `npm run start` | 3000 | UI + API routes |
| Cron worker | `node cron-worker.mjs` | 3001 | WhatsApp client + cron scheduler |

**Both must be running.** The Next.js app proxies all WhatsApp operations to the worker.

---

## Authentication

The app uses a proxy-based auth system (`src/proxy.ts`) that runs on every request:

- **Token format**: HMAC-SHA256 signed payload (`username:timestamp.signature`) stored in `logistics_session` cookie
- **Server-side expiry**: Tokens validated against 7-day max age on every request (not just browser cookie expiry)
- **Timing-safe comparison**: Buffers padded to equal length before `timingSafeEqual` to prevent length-leak attacks
- **Cookie settings**: `HttpOnly`, `SameSite=Strict`, `Secure` in production
- **Protected routes**: All routes except `/login`, `/api/auth/*`, `/_next/*`, `/favicon*`, `/logo-*`
- **Internal routes**: `/api/cron/*` and `/api/internal/*` restricted to localhost origin (checked via host + x-forwarded-for)
- **Rate limiting**: Login endpoint tracks failed attempts per IP — 5 failures triggers 15-minute lockout

The proxy sets `x-pathname` header so the layout can detect the login page and render it without the sidebar.

---

## DB Layer Architecture

The database layer is split into focused modules:

| Module | Responsibility |
|--------|---------------|
| `db-orders.ts` | Order CRUD, holding orders, status updates |
| `db-drivers.ts` | Driver CRUD, phone updates |
| `db-config.ts` | App config load/save, distribution date tracking |
| `db-distributions.ts` | Save/load distribution results |
| `db-clients.ts` | Client directory CRUD |
| `db-logs.ts` | Activity log operations |
| `db-whatsapp.ts` | WhatsApp message log |
| `db-zones.ts` | Zone and district CRUD |
| `db-supabase.ts` | Barrel re-export of all modules + sheet/backup operations |

All modules import the Supabase client from `supabase.ts`.

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useWhatsAppSender` | Manages WhatsApp connection state, per-recipient send tracking, broadcast with cleanup |
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
- Exposes an internal HTTP API on **127.0.0.1:3001** (localhost only, not accessible from network)
- Runs the auto-distribution cron loop every 60 seconds
- Auto-reconnects WhatsApp from saved session on startup
- Handles exponential backoff reconnect on disconnect (5s → 10s → 20s... max 5 min)
- Includes reconnect mutex to prevent dual WhatsApp client initialization
- Pauses cron after 10 consecutive failures (10-minute cooldown, then auto-resumes)
- Cleans up Chrome processes on graceful shutdown

### Starting the worker

```bash
node cron-worker.mjs
```

Run this alongside `npm run dev` in a separate terminal. In production, managed by PM2.

### Worker HTTP API (127.0.0.1:3001 — internal only)

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
The worker automatically schedules a reconnect with exponential backoff (mutex-protected to prevent dual clients). No manual action needed. The UI will show "Not connected" temporarily and recover on its own.

---

## Auto-Distribution Cron

The worker polls `GET /api/cron/distribute` every 60 seconds.

### What the cron does (in order)
1. Checks if distribution is paused → skips if paused
2. Checks current time against `distributionTime` config (set in Admin Settings)
3. Checks `lastAutoDistributionDate` — skips if already ran today
4. **Atomically claims today's date** (prevents race conditions from concurrent calls)
5. Loads all pending orders + active drivers
6. Runs distribution algorithm
7. Merges with existing distribution for the target date if one exists
8. Saves distribution to DB
9. Marks assigned orders as `assigned` with driver ID
10. Sends WhatsApp messages based on `autoMessageRecipients` config:
    - `'admins'` (default) — full distribution report to all admin numbers
    - `'drivers'` — individual assignments to each driver with a phone number
    - `'both'` — both of the above

### Cron failure handling
If the distribute API fails 10 times consecutively, the cron pauses for 10 minutes then resets the failure counter and resumes polling.

---

## API Routes

### Auth
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/login` | `POST` | Public | Login with rate limiting (5 attempts / 15-min lockout) |
| `/api/auth/logout` | `GET` | Session | Clear session cookie |

### WhatsApp (all proxied to worker)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/whatsapp/status` | `GET` | Session | Connection state |
| `/api/whatsapp/init` | `GET/POST/DELETE` | Session | Poll status / start / disconnect |
| `/api/whatsapp/send` | `POST` | Session | Send single message (validates phone format + 4096 char limit) |
| `/api/whatsapp/send` | `PUT` | Session | Batch send (max 50 messages, validates each item) |

### Distribution
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/cron/distribute` | `GET` | Localhost | Auto-distribution (called by worker) |
| `/api/cron/reset-distribution` | `POST` | Localhost | Reset today's distribution flag |
| `/api/distribution/cancel-redistribute` | `POST` | Session | Cancel + redistribute (validates YYYY-MM-DD date format) |

### Internal
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/internal/whatsapp-sync` | `POST` | Localhost | Worker syncs WhatsApp connection state to DB |

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used by worker to call Next.js API
AUTH_SECRET=your-secret-key                  # HMAC signing key for session tokens
ADMIN_USERNAME=shudalogistics                # Login username
ADMIN_EMAIL=admin@example.com               # Alternative login (email)
ADMIN_PASSWORD_HASH=$2b$10$...              # bcrypt hash of password
```

---

## Deployment

### Production VPS: 43.156.81.159

```bash
ssh ubuntu@43.156.81.159 "cd ~/ShudaLogistics/LogisticsV3 && git pull && npm install && npm run build && pm2 restart logistics && pm2 restart logistics-cron"
```

### PM2 processes

| Name | Script | Mode | Port |
|------|--------|------|------|
| `logistics` | `npm start` | fork | 3000 |
| `logistics-cron` | `cron-worker.mjs` | fork | 3001 |

### Production checklist

- [x] Worker HTTP server bound to `127.0.0.1` (not exposed to network)
- [x] `AUTH_SECRET` set to strong random value
- [x] Session tokens validated server-side with 7-day expiry
- [x] Login rate limiting (5 attempts, 15-min lockout per IP)
- [x] Cron/internal routes restricted to localhost
- [x] Input validation on all API routes (phone, message length, date format, batch size)
- [x] Path traversal prevention on storage delete
- [x] Distribution race condition prevention (atomic date claim)
- [ ] Scan QR once on the production server to save session
- [ ] Keep `.wwebjs_auth/` persistent across deployments
- [ ] Set `distributionTime` in Admin Settings
- [ ] Configure `autoMessageRecipients` in Admin Settings
