// IndexedDB database wrapper for better data management
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Order, Driver, AppConfig, AppCache, LogEntry, DistributionResult, MessageTemplate } from '@/types';

// Database schema definition
interface LogisticsDB extends DBSchema {
    config: {
        key: string;
        value: AppConfig & { id: string };
    };
    sheets: {
        key: string;
        value: {
            id: string;
            name: string;
            type: 'orders' | 'drivers';
            data: Record<string, any>[];
            headers: string[];
            createdAt: string;
            updatedAt: string;
        };
        indexes: { 'by-type': string; 'by-date': string };
    };
    orders: {
        key: string;
        value: Order & { sheetId?: string };
        indexes: { 'by-zone': string; 'by-date': string };
    };
    drivers: {
        key: string;
        value: Driver & { sheetId?: string };
        indexes: { 'by-name': string };
    };
    distributions: {
        key: string;
        value: DistributionResult & { id: string };
        indexes: { 'by-timestamp': string };
    };
    logs: {
        key: string;
        value: LogEntry;
        indexes: { 'by-type': string; 'by-timestamp': string };
    };
    history: {
        key: string;
        value: {
            id: string;
            action: string;
            data: any;
            timestamp: string;
        };
        indexes: { 'by-timestamp': string };
    };
    whatsapp: {
        key: string;
        value: {
            id: string;
            recipient: string;
            message: string;
            status: 'pending' | 'sent' | 'failed';
            sentAt?: string;
            error?: string;
            distributionId?: string;
        };
        indexes: { 'by-status': string; 'by-timestamp': string };
    };
}

const DB_NAME = 'logistics-v3';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<LogisticsDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<LogisticsDB>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<LogisticsDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Config store
            if (!db.objectStoreNames.contains('config')) {
                db.createObjectStore('config', { keyPath: 'id' });
            }

            // Sheets store
            if (!db.objectStoreNames.contains('sheets')) {
                const sheetStore = db.createObjectStore('sheets', { keyPath: 'id' });
                sheetStore.createIndex('by-type', 'type');
                sheetStore.createIndex('by-date', 'updatedAt');
            }

            // Orders store
            if (!db.objectStoreNames.contains('orders')) {
                const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
                orderStore.createIndex('by-zone', 'zone');
                orderStore.createIndex('by-date', 'date');
            }

            // Drivers store
            if (!db.objectStoreNames.contains('drivers')) {
                const driverStore = db.createObjectStore('drivers', { keyPath: 'id' });
                driverStore.createIndex('by-name', 'name');
            }

            // Distributions store
            if (!db.objectStoreNames.contains('distributions')) {
                const distStore = db.createObjectStore('distributions', { keyPath: 'id' });
                distStore.createIndex('by-timestamp', 'timestamp');
            }

            // Logs store
            if (!db.objectStoreNames.contains('logs')) {
                const logStore = db.createObjectStore('logs', { keyPath: 'id' });
                logStore.createIndex('by-type', 'type');
                logStore.createIndex('by-timestamp', 'timestamp');
            }

            // History store for undo/redo
            if (!db.objectStoreNames.contains('history')) {
                const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                historyStore.createIndex('by-timestamp', 'timestamp');
            }

            // WhatsApp messages store
            if (!db.objectStoreNames.contains('whatsapp')) {
                const waStore = db.createObjectStore('whatsapp', { keyPath: 'id' });
                waStore.createIndex('by-status', 'status');
                waStore.createIndex('by-timestamp', 'sentAt');
            }
        },
    });

    return dbInstance;
}

// Config operations
export async function getConfig(): Promise<AppConfig> {
    const db = await getDB();
    const config = await db.get('config', 'main');
    return config || {
        id: 'main',
        adminNumbers: [],
        manualDrivers: [],
        whatsappConnected: false,
        messageTemplates: [
            {
                id: crypto.randomUUID(),
                name: 'Default',
                content: 'Hello {driver},\n\nYour delivery assignment:\n{zones}\nTotal: {pallets} pallets\n\nThank you!',
            },
        ],
        schemas: {
            orders: undefined,
            drivers: undefined,
        },
    };
}

export async function saveConfig(config: Partial<AppConfig>) {
    const db = await getDB();
    const current = await getConfig();
    await db.put('config', { id: 'main', ...current, ...config });
}

// Schema operations
export async function saveSchema(type: 'orders' | 'drivers', schema: any) {
    const db = await getDB();
    const config = await getConfig();
    await db.put('config', {
        id: 'main',
        ...config,
        schemas: {
            ...config.schemas,
            [type]: schema,
        },
    });
}

export async function getSchema(type: 'orders' | 'drivers') {
    const config = await getConfig();
    return config.schemas?.[type] || null;
}

// Sheet operations
export async function createSheet(name: string, type: 'orders' | 'drivers', headers: string[], data: Record<string, any>[] = []) {
    const db = await getDB();
    const sheet = {
        id: crypto.randomUUID(),
        name,
        type,
        headers,
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.add('sheets', sheet);
    return sheet;
}

export async function getAllSheets() {
    const db = await getDB();
    return db.getAll('sheets');
}

export async function getSheetsByType(type: 'orders' | 'drivers') {
    const db = await getDB();
    return db.getAllFromIndex('sheets', 'by-type', type);
}

export async function getSheet(id: string) {
    const db = await getDB();
    return db.get('sheets', id);
}

export async function updateSheet(id: string, updates: Partial<LogisticsDB['sheets']['value']>) {
    const db = await getDB();
    const sheet = await db.get('sheets', id);
    if (!sheet) throw new Error('Sheet not found');
    await db.put('sheets', { ...sheet, ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteSheet(id: string) {
    const db = await getDB();
    await db.delete('sheets', id);
}

// Order operations
export async function saveOrders(orders: Order[], sheetId?: string) {
    const db = await getDB();
    const tx = db.transaction('orders', 'readwrite');
    await Promise.all(orders.map(order => tx.store.put({ ...order, sheetId })));
    await tx.done;
}

export async function getAllOrders() {
    const db = await getDB();
    return db.getAll('orders');
}

export async function clearOrders() {
    const db = await getDB();
    await db.clear('orders');
}

// Driver operations
export async function saveDrivers(drivers: Driver[], sheetId?: string) {
    const db = await getDB();
    const tx = db.transaction('drivers', 'readwrite');
    await Promise.all(drivers.map(driver => tx.store.put({ ...driver, sheetId })));
    await tx.done;
}

export async function getAllDrivers() {
    const db = await getDB();
    return db.getAll('drivers');
}

export async function addDriver(driver: Driver) {
    const db = await getDB();
    await db.add('drivers', { ...driver, id: driver.id || crypto.randomUUID() });
}

export async function updateDriver(id: string, updates: Partial<Driver>) {
    const db = await getDB();
    const driver = await db.get('drivers', id);
    if (!driver) throw new Error('Driver not found');
    await db.put('drivers', { ...driver, ...updates });
}

export async function deleteDriver(id: string) {
    const db = await getDB();
    await db.delete('drivers', id);
}

export async function clearDrivers() {
    const db = await getDB();
    await db.clear('drivers');
}

// Distribution operations
export async function saveDistribution(distribution: DistributionResult) {
    const db = await getDB();
    const id = crypto.randomUUID();
    await db.add('distributions', { ...distribution, id });
    return id;
}

export async function getAllDistributions() {
    const db = await getDB();
    return db.getAll('distributions');
}

export async function getDistribution(id: string) {
    const db = await getDB();
    return db.get('distributions', id);
}

export async function getLatestDistribution() {
    const db = await getDB();
    const all = await db.getAllFromIndex('distributions', 'by-timestamp');
    return all[all.length - 1] || null;
}

// Log operations
export async function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>) {
    const db = await getDB();
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...log,
    };
    await db.add('logs', entry);
    return entry;
}

export async function getAllLogs() {
    const db = await getDB();
    const logs = await db.getAllFromIndex('logs', 'by-timestamp');
    return logs.reverse();
}

export async function clearLogs() {
    const db = await getDB();
    await db.clear('logs');
}

// History operations for undo/redo
export async function addHistory(action: string, data: any) {
    const db = await getDB();
    const entry = {
        id: crypto.randomUUID(),
        action,
        data,
        timestamp: new Date().toISOString(),
    };
    await db.add('history', entry);

    // Keep only last 50 history entries
    const all = await db.getAllFromIndex('history', 'by-timestamp');
    if (all.length > 50) {
        const toDelete = all.slice(0, all.length - 50);
        const tx = db.transaction('history', 'readwrite');
        await Promise.all(toDelete.map(h => tx.store.delete(h.id)));
        await tx.done;
    }
}

export async function getHistory(limit: number = 50) {
    const db = await getDB();
    const all = await db.getAllFromIndex('history', 'by-timestamp');
    return all.slice(-limit).reverse();
}

// WhatsApp message operations
export async function addWhatsAppMessage(recipient: string, message: string, distributionId?: string) {
    const db = await getDB();
    const msg = {
        id: crypto.randomUUID(),
        recipient,
        message,
        status: 'pending' as const,
        distributionId,
    };
    await db.add('whatsapp', msg);
    return msg;
}

export async function updateWhatsAppMessage(id: string, updates: Partial<LogisticsDB['whatsapp']['value']>) {
    const db = await getDB();
    const msg = await db.get('whatsapp', id);
    if (!msg) throw new Error('Message not found');
    await db.put('whatsapp', { ...msg, ...updates });
}

export async function getAllWhatsAppMessages() {
    const db = await getDB();
    return db.getAll('whatsapp');
}

export async function getPendingWhatsAppMessages() {
    const db = await getDB();
    return db.getAllFromIndex('whatsapp', 'by-status', 'pending');
}

// Backup and restore
export async function exportAllData() {
    const db = await getDB();
    const data = {
        config: await db.get('config', 'main'),
        sheets: await db.getAll('sheets'),
        orders: await db.getAll('orders'),
        drivers: await db.getAll('drivers'),
        distributions: await db.getAll('distributions'),
        logs: await db.getAll('logs'),
        whatsapp: await db.getAll('whatsapp'),
        exportedAt: new Date().toISOString(),
    };
    return data;
}

export async function importAllData(data: any) {
    const db = await getDB();

    // Clear all stores
    await Promise.all([
        db.clear('sheets'),
        db.clear('orders'),
        db.clear('drivers'),
        db.clear('distributions'),
        db.clear('logs'),
        db.clear('whatsapp'),
    ]);

    // Import data
    if (data.config) await db.put('config', data.config);
    if (data.sheets) {
        const tx = db.transaction('sheets', 'readwrite');
        await Promise.all(data.sheets.map((s: any) => tx.store.add(s)));
        await tx.done;
    }
    if (data.orders) {
        const tx = db.transaction('orders', 'readwrite');
        await Promise.all(data.orders.map((o: any) => tx.store.add(o)));
        await tx.done;
    }
    if (data.drivers) {
        const tx = db.transaction('drivers', 'readwrite');
        await Promise.all(data.drivers.map((d: any) => tx.store.add(d)));
        await tx.done;
    }
    if (data.distributions) {
        const tx = db.transaction('distributions', 'readwrite');
        await Promise.all(data.distributions.map((d: any) => tx.store.add(d)));
        await tx.done;
    }
    if (data.logs) {
        const tx = db.transaction('logs', 'readwrite');
        await Promise.all(data.logs.map((l: any) => tx.store.add(l)));
        await tx.done;
    }
}
