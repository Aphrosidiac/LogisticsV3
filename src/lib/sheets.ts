// Google Sheets data fetching and parsing

import { Order, Driver } from '@/types';
import { generateId } from './utils';

// Default drivers if sheet doesn't have driver data
const DEFAULT_DRIVERS: Driver[] = [
    { id: '1', name: 'Driver 1', identifier: 'D1' },
    { id: '2', name: 'Driver 2', identifier: 'D2' },
    { id: '3', name: 'Driver 3', identifier: 'D3' },
    { id: '4', name: 'Driver 4', identifier: 'D4' },
];

interface SheetData {
    orders: Order[];
    drivers: Driver[];
}

function extractSheetId(url: string): string | null {
    // Match Google Sheets URL patterns
    const patterns = [
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /\/d\/([a-zA-Z0-9-_]+)/,
        /^([a-zA-Z0-9-_]+)$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

async function fetchSheetData(sheetId: string, gid: string = '0'): Promise<unknown[][]> {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    // Google returns JSONP-like response, extract JSON
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);

    if (!jsonMatch) {
        throw new Error('Invalid response format from Google Sheets');
    }

    const data = JSON.parse(jsonMatch[1]);

    if (!data.table || !data.table.rows) {
        throw new Error('No data found in sheet');
    }

    // Extract column headers from col.label
    let headers: string[] = data.table.cols.map((col: { label?: string }) =>
        (col.label || '').toString().trim().toUpperCase()
    );

    // Extract rows
    const rows: unknown[][] = data.table.rows.map((row: { c?: Array<{ v?: unknown }> }) =>
        (row.c || []).map((cell) => cell?.v ?? '')
    );

    // If headers are empty/blank, use first row as headers
    const hasValidHeaders = headers.some(h => h.length > 0);
    if (!hasValidHeaders && rows.length > 0) {
        headers = rows[0].map(cell => String(cell ?? '').trim().toUpperCase());
        return [headers, ...rows.slice(1)]; // Skip first row since it's headers
    }

    return [headers, ...rows];
}

function parseOrders(data: unknown[][]): Order[] {
    if (data.length < 2) return [];

    const headers = data[0] as string[];
    const palletIdx = headers.findIndex(h => h.includes('PALLET'));
    const zoneIdx = headers.findIndex(h => h.includes('ZONE'));
    const dateIdx = headers.findIndex(h => h.includes('DATE'));
    const pickupIdx = headers.findIndex(h => h.includes('PICKUP'));
    const deliveryIdx = headers.findIndex(h => h.includes('DELIVERY'));
    const invoiceIdx = headers.findIndex(h => h.includes('INVOICE'));

    if (palletIdx === -1 || zoneIdx === -1) {
        throw new Error('Required columns PALLETS and ZONE not found in sheet');
    }

    const orders: Order[] = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const palletValue = row[palletIdx];
        const zoneValue = row[zoneIdx];

        // Skip rows without valid zone
        if (!zoneValue || String(zoneValue).trim() === '') continue;

        // Build raw data map
        const rawData: Record<string, string> = {};
        headers.forEach((h, idx) => {
            rawData[h] = String(row[idx] ?? '');
        });

        orders.push({
            id: generateId(),
            pallets: Number(palletValue) || 1,
            zone: String(zoneValue).trim().toUpperCase(),
            date: dateIdx >= 0 ? String(row[dateIdx] ?? '') : undefined,
            pickup: pickupIdx >= 0 ? String(row[pickupIdx] ?? '') : undefined,
            delivery: deliveryIdx >= 0 ? String(row[deliveryIdx] ?? '') : undefined,
            invoice: invoiceIdx >= 0 ? String(row[invoiceIdx] ?? '') : undefined,
            rawData,
        });
    }

    return orders;
}

function parseDrivers(data: unknown[][]): Driver[] {
    if (data.length < 2) return [];

    const headers = data[0] as string[];
    // Look for columns containing driver/name - prioritize "DRIVER NAME" or "DRIVER"
    const nameIdx = headers.findIndex(h =>
        h.includes('DRIVER') || h === 'NAME' || h.includes('NAMA') || h.includes('PEMANDU')
    );
    const idIdx = headers.findIndex(h =>
        h.includes('IDENTIFIER') || h.includes('LORRY') || h.includes('LORI') ||
        (h.includes('ID') && !h.includes('DRIVER'))
    );

    if (nameIdx === -1) return [];

    const drivers: Driver[] = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const name = String(row[nameIdx] ?? '').trim();

        if (!name) continue;

        drivers.push({
            id: generateId(),
            name,
            identifier: idIdx >= 0 ? String(row[idIdx] ?? name) : name,
        });
    }

    return drivers;
}

// Extract unique drivers from orders data if DRIVER column exists
function extractDriversFromOrders(data: unknown[][]): Driver[] {
    if (data.length < 2) return [];

    const headers = data[0] as string[];
    const driverIdx = headers.findIndex(h =>
        h.includes('DRIVER') || h.includes('PEMANDU') || h.includes('NAMA')
    );

    if (driverIdx === -1) return [];

    const uniqueNames = new Set<string>();
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const name = String(row[driverIdx] ?? '').trim();
        if (name) {
            uniqueNames.add(name);
        }
    }

    return Array.from(uniqueNames).map((name, idx) => ({
        id: generateId(),
        name,
        identifier: `D-${String(idx + 1).padStart(3, '0')}`,
    }));
}

export async function fetchGoogleSheet(url: string): Promise<SheetData> {
    const sheetId = extractSheetId(url);

    if (!sheetId) {
        throw new Error('Invalid Google Sheets URL');
    }

    // Fetch orders from first sheet
    const ordersData = await fetchSheetData(sheetId, '0');
    const orders = parseOrders(ordersData);

    console.log('Orders sheet headers:', ordersData[0]);

    if (orders.length === 0) {
        throw new Error('No valid orders found in sheet');
    }

    // Try multiple strategies to find drivers
    let drivers: Driver[] = [];

    // Strategy 1: Try to extract drivers from the orders sheet (if DRIVER column exists)
    drivers = extractDriversFromOrders(ordersData);
    console.log('Drivers found from orders sheet:', drivers.length);

    // Strategy 2: Try common sheet GIDs for a separate drivers sheet
    if (drivers.length === 0) {
        // Try to extract gid from URL if provided
        const gidMatch = url.match(/gid=(\d+)/);
        const urlGid = gidMatch ? gidMatch[1] : null;

        // Common GIDs: 0 is first sheet, subsequent sheets have random large numbers
        // Also try small numbers in case sheets are numbered sequentially
        const driverSheetGids = [
            ...(urlGid ? [urlGid] : []),
            '189997645',  // Original app's driver sheet
            '1',
            '2',
            '3',
            '1045298764', // Common random GID
            '915171033',  // Another common pattern
        ];

        for (const gid of driverSheetGids) {
            if (gid === '0') continue; // Skip orders sheet
            try {
                console.log(`Trying driver sheet gid=${gid}...`);
                const driversData = await fetchSheetData(sheetId, gid);
                console.log(`Sheet gid=${gid} headers:`, driversData[0]);
                drivers = parseDrivers(driversData);
                if (drivers.length > 0) {
                    console.log(`Found ${drivers.length} drivers in sheet gid=${gid}:`, drivers.map(d => d.name));
                    break;
                }
            } catch (err) {
                console.log(`Sheet gid=${gid} failed:`, err);
                // Continue to next GID
            }
        }
    }

    // Fallback to default drivers if none found
    if (drivers.length === 0) {
        drivers = DEFAULT_DRIVERS;
    }

    return { orders, drivers };
}
