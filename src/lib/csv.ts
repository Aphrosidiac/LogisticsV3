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
            date: dateKey ? String(row[dateKey] || '') : undefined,
            pickup: pickupKey ? String(row[pickupKey] || '') : undefined,
            delivery: deliveryKey ? String(row[deliveryKey] || '') : undefined,
            invoice: invoiceKey ? String(row[invoiceKey] || '') : undefined,
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
