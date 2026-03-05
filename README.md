# Shuda Logistics — Distribution Management System v3

A Next.js web application for managing logistics order distribution across drivers, with automatic scheduling, partial fulfillment tracking, WhatsApp driver dispatch, and holding orders.

## Features

- **Order Management** — Create, import, and manage delivery orders with zone/district assignment
- **Holding Orders** — Stage incomplete orders (no date/zone yet) and release them when ready
- **Zone-Based Distribution** — Capacity-constrained priority routing algorithm assigns orders to drivers by region and pallet load
- **Pending Balances** — Tracks partial fulfillments; rescheduled balances create new high-priority orders for the target date
- **Auto-Distribution Cron** — Runs once daily at a configurable time; distributes tomorrow's orders and pending balances automatically
- **WhatsApp Messaging** — Sends individual assignments to drivers and/or full reports to admins via WhatsApp Web.js, with configurable recipients (drivers only, admins only, or both)
- **DO File Attachments** — Upload and view delivery order documents (images/PDFs) via Supabase Storage
- **Google Sheets Import** — Import orders and drivers from public Google Sheets URLs
- **Dynamic Schema Builder** — Configure custom fields for orders and drivers tables
- **Zones & Districts** — Hierarchical geographic management with cascade dropdowns
- **Completed Orders** — Track delivered orders with driver attribution
- **Activity Logging** — Full audit trail of all actions
- **Backup & Restore** — Export/import all data
- **Dark/Light Theme** — Toggle between dark and light mode, persistent per user via localStorage
- **Authentication** — Cookie-based session auth with HMAC-signed tokens

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

Create `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=your-secret-key
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
│   ├── balances/                 # Pending balances — reschedule / cancel
│   ├── sheets-manager/           # DB Manager — Orders, Drivers, and Holding tabs
│   ├── completed-orders/         # Fulfilled order history
│   ├── zones/                    # Zone & district management
│   ├── whatsapp/                 # WhatsApp connection & message queue
│   ├── admin/                    # Admin settings (driver phones, admin numbers, schedule, message recipients)
│   ├── login/                    # Authentication page
│   ├── logs/                     # Activity log viewer
│   ├── backup/                   # Export / import data
│   └── api/
│       ├── auth/                 # Login / logout endpoints
│       ├── cron/distribute/      # Auto-distribution endpoint (called by cron worker)
│       ├── internal/             # Internal worker sync endpoints
│       └── whatsapp/             # WhatsApp init / send / status
├── components/                   # UI: Sidebar, ThemeToggle, Modal, DriverListItem, etc.
├── context/                      # React Context (app state + dispatch)
├── hooks/                        # Custom hooks (useWhatsAppSender, useMarkDelivered, usePagination, useModal)
├── lib/
│   ├── distribution.ts           # Core distribution algorithm + message formatting
│   ├── balances.ts               # Pending balance CRUD + reschedule logic
│   ├── db-supabase.ts            # Barrel re-export of all DB operations
│   ├── db-orders.ts              # Order CRUD (including holding orders)
│   ├── db-drivers.ts             # Driver CRUD
│   ├── db-config.ts              # App config operations
│   ├── db-distributions.ts       # Distribution save/load
│   ├── db-logs.ts                # Activity log operations
│   ├── db-whatsapp.ts            # WhatsApp message log
│   ├── db-zones.ts               # Zone / district CRUD
│   ├── column-defs.ts            # Table column definitions + status styles
│   ├── supabase.ts               # Supabase client + table name constants
│   ├── whatsapp-client.ts        # WhatsApp HTTP proxy to cron worker
│   ├── api-auth.ts               # API route auth middleware (internal + session)
│   ├── storage.ts                # Supabase Storage (DO attachments)
│   ├── csv.ts                    # CSV / sheet parsing
│   ├── utils.ts                  # Phone formatting, date display, validation helpers
│   └── encryption.ts             # Password hashing
├── proxy.ts                      # Next.js proxy (auth guard + pathname forwarding)
└── types/
    └── index.ts                  # All TypeScript interfaces
```

## Database Tables

| Table | Purpose |
|---|---|
| `orders` | Delivery orders (zone, pallets, date, status, driver assignment, attachments) |
| `drivers` | Drivers (name, identifier, capacity, region, phone) |
| `pending_balances` | Partial fulfillments awaiting redistribution |
| `distributions` | Saved distribution run results |
| `zones` / `districts` | Geographic hierarchy |
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
| `in_progress` | Being delivered |
| `completed` | Delivered successfully |
| `cancelled` | Cancelled |

## Distribution Algorithm

1. Filter orders by target date (default: tomorrow)
2. Sort by priority (`high` first), then by pallet count (largest first)
3. Score drivers by region match + remaining capacity
4. Assign fully if order fits; partially if driver has some space → creates `PendingBalance` for remainder
5. If no driver capacity → full `PendingBalance` for next day

## Holding Orders

Orders can be created in a "holding" state when customers have ordered pallets but haven't provided delivery details (date, zone). Holding orders:
- Only require pallets to save (date and zone are optional)
- Are excluded from distribution (only `pending` orders are distributed)
- Can be released to `pending` once date and zone are provided
- Managed via the "Holding" tab in DB Manager

## WhatsApp Message Recipients

After auto-distribution, WhatsApp messages can be sent to configurable recipients (set in Admin Settings → Distribution Schedule):

| Setting | Behavior |
|---|---|
| **Drivers only** | Each driver with a phone number receives their individual assignment |
| **Admins only** | All configured admin numbers receive the full distribution report |
| **Both** | Drivers get individual assignments + admins get the full report |

Manual sending is also available: the Distribution page has "Send via WhatsApp" for admins, and the Admin Settings page has per-driver send + "Send All" buttons.

## Pending Balance Lifecycle

```
Distribution run
  └─► PendingBalance created (status: pending, scheduled_for_date: targetDate + 1)
          │
          ├─ Next cron / manual run
          │    └─► convertBalancesToOrders() → re-enters distribution as high-priority
          │
          ├─ Manual Cancel
          │    └─► status: cancelled (removed from list)
          │
          └─ Manual Reschedule
               └─► balance cancelled + new Order created for remaining_quantity
                   on chosen date with priority: high → picked up by distribution
```

## Cron Worker

`cron-worker.mjs` runs as a separate Node process that:
- Owns the WhatsApp Puppeteer client (persistent session)
- Exposes an internal HTTP API on port 3001
- Polls `/api/cron/distribute` every 60 seconds
- Auto-reconnects WhatsApp with exponential backoff

The distribution time is configurable in Admin Settings (default `20:00`). The cron runs once per day — subsequent calls on the same day are no-ops.

## Authentication

The app uses cookie-based session authentication:
- HMAC-SHA256 signed tokens stored in `logistics_session` cookie
- `proxy.ts` guards all routes except `/login`, `/api/auth/*`, and public assets
- Login credentials are configured via the admin settings page
