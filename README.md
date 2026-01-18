# Logistics Distribution Web App

A Next.js web application for automating logistics order distribution across drivers with WhatsApp sharing capabilities.

## Features

- **Google Sheets Integration** - Import orders and drivers from public Google Sheets
- **Zone-Based Distribution** - Automatically distribute orders using pallet load balancing
- **WhatsApp Sharing** - Copy distribution reports or share via WhatsApp links
- **Activity Logging** - Track all actions with timestamped logs
- **Dark Theme UI** - Modern, responsive interface

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Google Sheets Format

Your sheet must be **publicly accessible** with these columns:

### Orders Sheet (Sheet 1)
| Required | Optional |
|----------|----------|
| PALLETS | DATE |
| ZONE | PICKUP |
| | DELIVERY |
| | INVOICE |

### Drivers Sheet (Sheet 2)
| Column | Description |
|--------|-------------|
| DRIVER NAME | Driver's name |
| LORRY | Vehicle identifier |

## Usage

1. **Import Data** - Paste Google Sheets URL and fetch data
2. **Calculate Distribution** - Assign zones to drivers with load balancing
3. **Add Admin Numbers** - Configure phone numbers for notifications
4. **Share Report** - Copy to clipboard or open in WhatsApp

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- localStorage (client-side storage)

## Project Structure

```
src/
├── app/           # Pages (dashboard, sheets, distribution, admin, logs)
├── components/    # UI components (Sidebar, StatCard, DriverCard, etc.)
├── context/       # React Context for state management
├── lib/           # Business logic (sheets, distribution, storage)
└── types/         # TypeScript interfaces
```

## Key Differences from Original Electron App

| Feature | Electron | Web App |
|---------|----------|---------|
| WhatsApp | QR scan + auto-send | Share links + clipboard |
| Storage | File system | Browser localStorage |
| Platform | Windows only | Any browser |
