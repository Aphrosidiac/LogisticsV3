// Utility functions

/** Application timezone — matches deployment region (MY/SG = UTC+8) */
export const APP_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Get current date as YYYY-MM-DD in the app timezone (not UTC).
 * Safe to call on both server and client.
 */
export function getLocalDate(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(date);
}

export function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function formatTimestamp(date: Date = new Date()): string {
    return date.toLocaleString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function formatPhoneNumber(phone: string): string {
    // Strip non-numeric characters
    return phone.replace(/\D/g, '');
}

export function validatePhoneNumber(phone: string): boolean {
    const cleaned = formatPhoneNumber(phone);
    return cleaned.length >= 10 && cleaned.length <= 15;
}

export function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function cn(...classes: (string | boolean | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}

/**
 * Convert YYYY-MM-DD to DD/MM/YYYY for display
 */
export function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

/**
 * Status color utility for badges/pills
 */
export function getStatusColor(status: string): string {
    switch (status) {
        case 'pending':
            return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        case 'assigned':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'completed':
        case 'fulfilled':
            return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        case 'cancelled':
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'rescheduled':
            return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        default:
            return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
}
