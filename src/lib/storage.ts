// localStorage wrapper for persistent data storage

import { AppConfig, AppCache, LogEntry } from '@/types';

const STORAGE_KEYS = {
    CONFIG: 'logistics-config',
    CACHE: 'logistics-cache',
    LOGS: 'logistics-logs',
} as const;

const MAX_LOGS = 500;

// Default values
const defaultConfig: AppConfig = {
    sheetsUrl: '',
    adminNumbers: [],
    manualDrivers: [],
};

const defaultCache: AppCache = {
    orders: [],
    drivers: [],
    lastDistribution: null,
    lastFetch: null,
};

// Config operations
export function getConfig(): AppConfig {
    if (typeof window === 'undefined') return defaultConfig;

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
        return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig;
    } catch {
        return defaultConfig;
    }
}

export function saveConfig(config: Partial<AppConfig>): AppConfig {
    const current = getConfig();
    const updated = { ...current, ...config };

    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    }

    return updated;
}

// Cache operations
export function getCache(): AppCache {
    if (typeof window === 'undefined') return defaultCache;

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CACHE);
        return stored ? { ...defaultCache, ...JSON.parse(stored) } : defaultCache;
    } catch {
        return defaultCache;
    }
}

export function saveCache(cache: Partial<AppCache>): AppCache {
    const current = getCache();
    const updated = { ...current, ...cache };

    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(updated));
    }

    return updated;
}

// Log operations
export function getLogs(): LogEntry[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const logs = getLogs();

    const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        ...entry,
    };

    // Add to beginning and limit size
    const updated = [newEntry, ...logs].slice(0, MAX_LOGS);

    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
    }

    return newEntry;
}

export function clearLogs(): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    }
}
