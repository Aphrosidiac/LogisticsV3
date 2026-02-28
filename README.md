# Logistics Distribution System v3

A Next.js web application for managing logistics order distribution across drivers, with automatic scheduling, partial fulfillment tracking, and WhatsApp driver dispatch.

## Features

- **Order Management** — Create, import, and manage delivery orders with zone/district assignment
- **Zone-Based Distribution** — Capacity-constrained priority routing algorithm assigns orders to drivers by region and pallet load
- **Pending Balances** — Tracks partial fulfillments; rescheduled balances create new high-priority orders for the target date
- **Auto-Distribution Cron** — Runs once daily at a configurable time; distributes tomorrow's orders and pending balances automatically
- **WhatsApp Driver Dispatch** — Sends individual assignment messages to drivers via WhatsApp Web.js
- **Google Sheets Import** — Import orders and drivers from public Google Sheets URLs
- **Dynamic Schema Builder** — Configure custom fields for orders and drivers tables
- **Zones & Districts** — Hierarchical geographic management
- **Activity Logging** — Full audit trail of all actions
- **Backup & Restore** — Export/import all data
- **Dark Theme UI** — Modern, responsive interface

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

Create `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Run the SQL schema from `supabase-schema.sql` in the Supabase SQL editor to create all required tables.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **Supabase** (PostgreSQL — orders, drivers, distributions, balances, config, logs)
- **WhatsApp Web.js** (driver dispatch via `/api/whatsapp`)

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── distribution/             # Manual distribution run + driver assignments
│   ├── balances/                 # Pending balances — reschedule / cancel
│   ├── sheets-manager/           # Import orders & drivers (Google Sheets or manual)
│   ├── completed-orders/         # Fulfilled order history
│   ├── zones/                    # Zone & district management
│   ├── whatsapp/                 # WhatsApp connection & message queue
│   ├── admin/                    # App config (drivers, admin numbers, cron time, password)
│   ├── logs/                     # Activity log viewer
│   ├── backup/                   # Export / import data
│   └── api/
│       ├── cron/distribute/      # Auto-distribution endpoint (called by cron worker)
│       └── whatsapp/             # WhatsApp init / send / status
├── components/                   # UI: Sidebar, Modal, DriverCard, SchemaBuilder, etc.
├── context/                      # React Context (app state)
├── lib/
│   ├── distribution.ts           # Core distribution algorithm + message formatting
│   ├── balances.ts               # Pending balance CRUD + reschedule logic
│   ├── db-supabase.ts            # All Supabase DB operations
│   ├── db-zones.ts               # Zone / district CRUD
│   ├── supabase.ts               # Supabase client + table name constants
│   ├── completed-orders.ts       # Completed order queries
│   ├── whatsapp-client.ts        # WhatsApp Web.js wrapper
│   ├── csv.ts                    # CSV / sheet parsing
│   ├── storage.ts                # File / attachment storage
│   ├── receipts.ts               # Receipt generation
│   └── encryption.ts             # Password hashing
└── types/
    └── index.ts                  # All TypeScript interfaces
```

## Database Tables

| Table | Purpose |
|---|---|
| `orders` | Delivery orders (zone, pallets, date, status, driver assignment) |
| `drivers` | Drivers (name, identifier, capacity, region, phone) |
| `pending_balances` | Partial fulfillments awaiting redistribution |
| `distributions` | Saved distribution run results |
| `zones` / `districts` | Geographic hierarchy |
| `app_config` | Admin settings, WhatsApp state, schemas, cron schedule |
| `activity_logs` | Audit trail |
| `sheets` | Imported Google Sheets snapshots |
| `whatsapp_messages` | Outbound WhatsApp message queue |

## Distribution Algorithm

1. Filter orders by target date (default: tomorrow)
2. Sort by priority (`high` first), then by pallet count (largest first)
3. Score drivers by region match + remaining capacity
4. Assign fully if order fits; partially if driver has some space → creates `PendingBalance` for remainder
5. If no driver capacity → full `PendingBalance` for next day

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

`cron-worker.mjs` polls `/api/cron/distribute` on a schedule. The distribution time is configurable in Admin Settings (default `20:00`). The cron runs once per day — subsequent calls on the same day are no-ops.

