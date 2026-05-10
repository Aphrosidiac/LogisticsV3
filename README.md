# Shuda Logistics — Distribution Management System v3

A Next.js web application for managing logistics order distribution across drivers, with automatic scheduling, partial fulfillment tracking, WhatsApp driver dispatch, and holding orders.

## Features

- **Order Management** — Create, import, and manage delivery orders with zone/district assignment
- **Holding Orders** — Stage incomplete orders (no date/zone yet) and release them when ready
- **Client Directory** — Manage clients with delivery locations, contacts, and attachments
- **Delivery Autofill** — Delivery company selector auto-populates address, postcode, area, state, and contact from client directory (same pattern as pickup)
- **Measurement Units** — Quantity field supports CTN, Roll, Ft, and Others — dynamically labeled in the form and WhatsApp messages
- **Zone-Based Distribution** — Capacity-constrained priority routing algorithm assigns orders to drivers by region and pallet load
- **Pending Balances** — Tracks partial fulfillments; rescheduled balances create new high-priority orders for the target date
- **Auto-Distribution Cron** — Runs once daily at a configurable time; distributes tomorrow's orders and pending balances automatically
- **WhatsApp Messaging** — Sends individual assignments to drivers and/or full reports to admins via WhatsApp Web.js, with configurable recipients (drivers only, admins only, or both)
- **Driver Pickup List** — Drivers receive a simplified numbered pickup route via WhatsApp (company name, pallet count, priority/oversized flags) alongside the detailed assignment
- **Pickup Verification** — After pickup, admin marks each DO as collected or not; generates a WhatsApp checklist with checkmarks/crosses per DO number
- **Delivery Confirmation (POD)** — Upload proof-of-delivery photos per order; photos stored in Supabase Storage and shown in completed orders
- **DO File Attachments** — Upload and view delivery order documents (images/PDFs) via Supabase Storage
- **Google Sheets Import** — Import orders and drivers from public Google Sheets URLs
- **Dynamic Schema Builder** — Configure custom fields for orders and drivers tables
- **Zones & Districts** — Hierarchical geographic management with cascade dropdowns and special zone schedules
- **Completed Orders** — Track delivered orders with driver attribution and POD photos
- **Activity Logging** — Full audit trail of all actions
- **Backup & Restore** — Export/import all data with schema validation
- **Dark/Light Theme** — Toggle between dark and light mode, persistent per user via localStorage
- **Authentication** — Cookie-based session auth with HMAC-signed tokens, server-side expiry, and login rate limiting

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run cron worker (separate terminal — handles WhatsApp + auto-distribution)
node cron-worker.mjs
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=your-secret-key
ADMIN_USERNAME=shudalogistics
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2b$10$...   # bcrypt hash
```

Run the SQL schema from `supabase-schema.sql` in the Supabase SQL editor to create all required tables.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL — orders, drivers, distributions, balances, config, logs, storage)
- **WhatsApp Web.js** (driver dispatch via cron worker on port 3001)

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── distribution/             # Manual distribution run + driver assignments
│   ├── sheets-manager/           # DB Manager — Orders, Drivers, and Holding tabs
│   ├── pickup-verification/      # Mark DOs as collected after driver pickup
│   ├── delivery-confirmation/    # Upload proof-of-delivery photos
│   ├── completed-orders/         # Fulfilled order history with POD
│   ├── zones/                    # Zone & district management
│   ├── clients/                  # Client directory with delivery locations
│   ├── whatsapp/                 # WhatsApp connection & message queue
│   ├── admin/                    # Admin settings (numbers, schedule, recipients)
│   ├── login/                    # Authentication page
│   ├── logs/                     # Activity log viewer
│   ├── backup/                   # Export / import data
│   └── api/
│       ├── auth/                 # Login / logout endpoints
│       ├── cron/                 # Auto-distribution + reset endpoints
│       ├── distribution/         # Cancel & redistribute endpoint
│       ├── internal/             # Internal worker sync endpoints
│       └── whatsapp/             # WhatsApp init / send / status
├── components/                   # UI: Sidebar, Modal, DriverListItem, FileUpload, etc.
├── context/                      # React Context (app state + dispatch)
├── hooks/                        # useWhatsAppSender, useMarkDelivered, usePagination, useModal
├── lib/
│   ├── distribution.ts           # Core distribution algorithm + message formatting
│   ├── db-supabase.ts            # Barrel re-export of all DB operations
│   ├── db-orders.ts              # Order CRUD (including holding orders)
│   ├── db-drivers.ts             # Driver CRUD
│   ├── db-config.ts              # App config operations
│   ├── db-distributions.ts       # Distribution save/load
│   ├── db-logs.ts                # Activity log operations
│   ├── db-whatsapp.ts            # WhatsApp message log
│   ├── db-zones.ts               # Zone / district CRUD
│   ├── db-clients.ts             # Client CRUD
│   ├── column-defs.ts            # Table column definitions + status styles
│   ├── supabase.ts               # Supabase client + table name constants
│   ├── whatsapp-client.ts        # WhatsApp HTTP proxy to cron worker
│   ├── auth.ts                   # Session token signing, verification, expiry
│   ├── api-auth.ts               # API route auth middleware (session + internal)
│   ├── storage.ts                # Supabase Storage (DO attachments)
│   ├── csv.ts                    # CSV / sheet parsing
│   ├── utils.ts                  # Phone formatting, date display, validation helpers
│   └── encryption.ts             # Client-side AES-GCM encryption
├── proxy.ts                      # Next.js middleware (auth guard + route protection)
└── types/
    └── index.ts                  # All TypeScript interfaces
```

## Database Tables

| Table | Purpose |
|---|---|
| `orders` | Delivery orders (zone, pallets, date, status, driver assignment, measurement unit, oversized flag, pickup verification, delivery photos) |
| `drivers` | Drivers (name, identifier, capacity, region, phone) |
| `pending_balances` | Partial fulfillments awaiting redistribution |
| `distributions` | Saved distribution run results |
| `zones` / `districts` | Geographic hierarchy |
| `clients` | Client directory with delivery locations |
| `app_config` | Admin settings, schemas, cron schedule, message recipients |
| `activity_logs` | Audit trail |
| `sheets` | Imported Google Sheets snapshots |
| `whatsapp_messages` | Outbound WhatsApp message log |

## Order Statuses

| Status | Description |
|---|---|
| `pending` | Awaiting distribution |
| `holding` | Staged — missing date/zone, not yet ready for distribution |
| `assigned` | Assigned to a driver via distribution |
| `picked_up` | Driver has collected the order (verified via Pickup Verification page) |
| `in_progress` | Being delivered |
| `completed` | Delivered successfully (may include POD photos) |
| `cancelled` | Cancelled |

## Distribution Algorithm

1. Filter orders by target date (default: tomorrow)
2. Sort by priority (`high` first), then FIFO (earliest created first)
3. Calculate pallets including quantity-to-pallet conversion (supports CTN, Roll, Ft, Others)
4. Group by zone, randomize zone processing order for fairness
5. Zone affinity: prefer drivers already serving the same zone
6. Fall back to any driver with remaining capacity
7. Assign fully if order fits; skip if no driver can fit the full order
8. Skipped orders remain pending for the next run

## Holding Orders

Orders can be created in a "holding" state when customers have ordered pallets but haven't provided delivery details (date, zone). Holding orders:
- Only require pallets to save (date and zone are optional)
- Are excluded from distribution (only `pending` orders are distributed)
- Can be released to `pending` once date and zone are provided
- Managed via the "Holding" tab in DB Manager

## WhatsApp Message Recipients

After auto-distribution, WhatsApp messages can be sent to configurable recipients (set in Admin Settings):

| Setting | Behavior |
|---|---|
| **Drivers only** | Each driver receives a simplified pickup route list + detailed assignment |
| **Admins only** | All configured admin numbers receive the full distribution report (default) |
| **Both** | Drivers get pickup list + assignment; admins get the full report |

### Driver Pickup List Format

Drivers receive a simplified numbered pickup route matching operational workflow:

```
☀️☀️☀️☀️☀️☀️☀️☀️☀️
Ambil barang kl
1)securepac 1p
2)crafted 1p
3)pp stell 1p panjang🚨🚨🚨
4)sun paper 130ctn(4-5)p🚨🚨🚨
```

- `Xp` = X pallets, `Xctn(Y)p` = X cartons (Y pallets equivalent)
- `panjang` = oversized item flag
- `🚨🚨🚨` = high priority order

### Pickup Verification Message

After admin verifies pickup, a collection checklist is sent:

```
COLLECT BY SHUDA
COLLECT DATE : 2026-05-07
1) VINYL FLOORING (54952✅, 55240✅) 1 pallet + 1 pallet
2) JM CONCEPTUAL (55093✅, 55391❌) 1 pallet + 1 pallet
```

Recipient selection auto-saves on change. Manual sending is also available via the Distribution page and Admin Settings.

## Pending Balance Lifecycle

```
Distribution run
  └─► Order can't fit any driver (skipped)
          │
          ├─ Next cron / manual run
          │    └─► Remains pending, picked up again
          │
          ├─ Manual Cancel
          │    └─► status: cancelled
          │
          └─ Manual Reschedule
               └─► New order created for remaining quantity
                   on chosen date with priority: high
```

## Cron Worker

`cron-worker.mjs` runs as a separate Node process that:
- Owns the WhatsApp Puppeteer client (persistent session)
- Exposes an internal HTTP API on `127.0.0.1:3001` (localhost only)
- Polls `/api/cron/distribute` every 60 seconds
- Auto-reconnects WhatsApp with exponential backoff (5s → 5min max)
- Pauses cron after 10 consecutive failures (10-min cooldown, then resumes)
- Includes reconnect mutex to prevent dual WhatsApp client initialization

The distribution time is configurable in Admin Settings (default `20:00`). The cron runs once per day — subsequent calls on the same day are no-ops (atomic date claim prevents race conditions).

## Authentication & Security

The app uses cookie-based session authentication:
- HMAC-SHA256 signed tokens stored in `logistics_session` cookie
- Server-side token expiry validation (7 days)
- Timing-safe comparison with padding to prevent length-leak attacks
- `SameSite=Strict` cookies
- Login rate limiting: 5 failed attempts per IP triggers 15-minute lockout
- `proxy.ts` guards all routes except `/login`, `/api/auth/*`, and public assets
- `/api/cron/*` and `/api/internal/*` restricted to localhost origin only
- API input validation: phone format, message length (4096 char limit), date format, batch size caps
- Storage path traversal prevention on file delete
- Backup import schema validation

## Deployment

### Production (VPS at 43.156.81.159)

```bash
ssh ubuntu@43.156.81.159 "cd ~/ShudaLogistics/LogisticsV3 && git pull && npm install && npm run build && pm2 restart logistics && pm2 restart logistics-cron"
```

### PM2 Setup

```bash
pm2 start npm --name logistics -- start
pm2 start cron-worker.mjs --name logistics-cron
pm2 save
pm2 startup
```

### Production Checklist

- [x] Worker bound to localhost only (port 3001 not exposed)
- [x] `AUTH_SECRET` set to a strong random value
- [x] Session tokens expire server-side after 7 days
- [x] Login rate limiting enabled
- [x] Cron/internal routes blocked from non-localhost
- [x] Input validation on all API routes
- [ ] Scan QR once on the production server to save WhatsApp session
- [ ] Keep `.wwebjs_auth/` persistent across deployments
- [ ] Set `distributionTime` in Admin Settings
- [ ] Configure `autoMessageRecipients` in Admin Settings
- [ ] Run `supabase/migrations/20260507_features_update.sql` in Supabase SQL Editor
