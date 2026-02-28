// CSV import/export utilities
import Papa from 'papaparse';
import type { Order, Driver } from '@/types';
import { generateId } from './utils';

export interface ParsedCSV {
    headers: string[];
    data: Record<string, any>[];
}

export async function parseCSVFile(file: File): Promise<ParsedCSV> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toUpperCase(),
            complete: (results) => {
                const headers = results.meta.fields || [];
                resolve({
                    headers,
                    data: results.data as Record<string, any>[],
                });
            },
            error: (error: Error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            },
        });
    });
}

export async function parseCSVText(text: string): Promise<ParsedCSV> {
    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toUpperCase(),
            complete: (results) => {
                const headers = results.meta.fields || [];
                resolve({
                    headers,
                    data: results.data as Record<string, any>[],
                });
            },
            error: (error: Error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            },
        });
    });
}

export function csvToOrders(data: Record<string, any>[]): Order[] {
    const orders: Order[] = [];

    for (const row of data) {
        const headers = Object.keys(row);
        const palletKey = headers.find(h => h.includes('PALLET'));
        const zoneKey = headers.find(h => h.includes('ZONE'));

        if (!palletKey || !zoneKey) continue;

        const zone = String(row[zoneKey] || '').trim();
        if (!zone) continue;

        const dateKey = headers.find(h => h.includes('DATE'));
        const pickupKey = headers.find(h => h.includes('PICKUP'));
        const deliveryKey = headers.find(h => h.includes('DELIVERY'));
        const invoiceKey = headers.find(h => h.includes('INVOICE'));

        orders.push({
            id: generateId(),
            pallets: Number(row[palletKey]) || 1,
            zone: zone.toUpperCase(),
            date: dateKey ? String(row[dateKey] || '') : new Date().toISOString().split('T')[0],
            pickup: pickupKey ? String(row[pickupKey] || '') : undefined,
            delivery: deliveryKey ? String(row[deliveryKey] || '') : undefined,
            invoice: invoiceKey ? String(row[invoiceKey] || '') : undefined,
            rawData: row,
        });
    }

    return orders;
}

// New function to convert sheet data (with schema field names) to orders
export function sheetDataToOrders(data: Record<string, any>[]): Order[] {
    const orders: Order[] = [];

    for (const row of data) {
        // Skip empty rows
        if (!row || Object.values(row).every(val => !val || val === '' || val === '-')) {
            continue;
        }

        // Extract zone - handle both "Zone" and zone with district format
        let zone = String(row['Zone'] || row['ZONE'] || '').trim();
        if (zone.includes('→')) {
            // Extract just the zone part from "Zone → District" format
            zone = zone.split('→')[0].trim();
        }
        
        if (!zone || zone === '' || zone === '-') continue;

        // Extract other fields using exact schema field names
        const pallets = Number(row['Quantity'] || row['QUANTITY'] || row['Pallets'] || row['PALLETS'] || 1);
        const date = String(row['Delivery Date'] || row['DELIVERY DATE'] || row['Date'] || row['DATE'] || new Date().toISOString().split('T')[0]);
        const priority = String(row['Priority'] || row['PRIORITY'] || 'standard').toLowerCase();
        const pickup = String(row['Pickup'] || row['PICKUP'] || '');
        const delivery = String(row['Delivery'] || row['DELIVERY'] || '');
        const invoice = String(row['Invoice'] || row['INVOICE'] || row['Invoice Number'] || row['INVOICE NUMBER'] || '');

        orders.push({
            id: generateId(),
            pallets,
            zone: zone.toUpperCase(),
            date,
            priority: priority as 'high' | 'standard',
            pickup: pickup || undefined,
            delivery: delivery || undefined,
            invoice: invoice || undefined,
            rawData: row,
        });
    }

    return orders;
}

export function csvToDrivers(data: Record<string, any>[]): Driver[] {
    const drivers: Driver[] = [];

    for (const row of data) {
        const headers = Object.keys(row);
        const nameKey = headers.find(h =>
            h.includes('DRIVER') || h === 'NAME' || h.includes('NAMA') || h.includes('PEMANDU')
        );
        const idKey = headers.find(h =>
            h.includes('IDENTIFIER') || h.includes('LORRY') || h.includes('LORI') ||
            (h.includes('ID') && !h.includes('DRIVER'))
        );

        if (!nameKey) continue;

        const name = String(row[nameKey] || '').trim();
        if (!name) continue;

        drivers.push({
            id: generateId(),
            name,
            identifier: idKey ? String(row[idKey] || name) : name,
        });
    }

    return drivers;
}

// New function to convert sheet data (with schema field names) to drivers
export function sheetDataToDrivers(data: Record<string, any>[]): Driver[] {
    const drivers: Driver[] = [];

    for (const row of data) {
        // Skip empty rows
        if (!row || Object.values(row).every(val => !val || val === '' || val === '-')) {
            continue;
        }

        // Extract fields using exact schema field names
        const name = String(row['Driver Name'] || row['DRIVER NAME'] || row['Name'] || row['NAME'] || '').trim();
        const identifier = String(row['Identifier'] || row['IDENTIFIER'] || name);
        const homeRegion = String(row['Home Region'] || row['HOME REGION'] || '');
        const maxCapacity = Number(row['Max Capacity (Pallets)'] || row['MAX CAPACITY (PALLETS)'] || row['Max Capacity'] || row['MAX CAPACITY'] || 11);

        if (!name || name === '' || name === '-') continue;

        drivers.push({
            id: generateId(),
            name,
            identifier,
            home_region: homeRegion || undefined,
            max_capacity: maxCapacity,
        });
    }

    return drivers;
}

export function ordersToCSV(orders: Order[]): string {
    if (orders.length === 0) return '';

    const headers = ['Zone', 'Pallets', 'Date', 'Pickup', 'Delivery', 'Invoice'];
    const rows = orders.map(order => ({
        Zone: order.zone,
        Pallets: order.pallets,
        Date: order.date || '',
        Pickup: order.pickup || '',
        Delivery: order.delivery || '',
        Invoice: order.invoice || '',
    }));

    return Papa.unparse({ fields: headers, data: rows });
}

export function driversToCSV(drivers: Driver[]): string {
    if (drivers.length === 0) return '';

    const headers = ['Driver Name', 'Identifier'];
    const rows = drivers.map(driver => ({
        'Driver Name': driver.name,
        'Identifier': driver.identifier,
    }));

    return Papa.unparse({ fields: headers, data: rows });
}

export function downloadCSV(filename: string, csvContent: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function sheetDataToCSV(headers: string[], data: Record<string, any>[]): string {
    if (data.length === 0) return '';
    return Papa.unparse({ fields: headers, data });
}
