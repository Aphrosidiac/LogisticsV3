'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Package,
    Users,
    Plus,
    Download,
    Upload,
    Trash2,
    Edit2,
    X,
    Check,
    AlertCircle,
    RefreshCw,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Phone,
    Search,
    Paperclip,
    FileText,
    Eye,
} from 'lucide-react';
import DOViewerModal from '@/components/DOViewerModal';
import ZoneDistrictSelector from '@/components/ZoneDistrictSelector';
import { uploadOrderAttachment, deleteAttachment } from '@/lib/storage';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db-supabase';
import * as csv from '@/lib/csv';
import type { Order, Driver } from '@/types';

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
    key: string;
    label: string;
    shortLabel?: string;
    type: 'text' | 'number' | 'date' | 'select' | 'tel';
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: any;
    options?: { value: string; label: string }[];
    placeholder?: string;
    hint?: string;
}

const ORDER_COLS: ColDef[] = [
    {
        key: 'do_number', label: 'DO Number', type: 'text',
        placeholder: 'e.g. DO-2025-001', hint: 'Delivery order reference number',
    },
    {
        key: 'invoice_number', label: 'Invoice Number', shortLabel: 'Invoice #', type: 'text',
        placeholder: 'e.g. INV-001',
    },
    {
        key: 'date', label: 'Delivery Date', type: 'date', required: true,
        hint: 'Date the delivery should be completed',
    },
    {
        key: 'zone', label: 'Zone', type: 'text', required: true,
        placeholder: 'e.g. A, B1, North', hint: 'Delivery zone for routing',
    },
    {
        key: 'pickup', label: 'Pickup Location', shortLabel: 'Pickup', type: 'text',
        placeholder: 'Warehouse / origin address',
    },
    {
        key: 'delivery', label: 'Delivery Location', shortLabel: 'Delivery', type: 'text',
        placeholder: 'Customer / destination address',
    },
    {
        key: 'pallets', label: 'Pallets', type: 'number', required: true,
        min: 1, max: 99, step: 1, placeholder: '1',
        hint: 'Number of pallets (whole number, 1–99)',
    },
    {
        key: 'ctn_amount', label: 'CTN Amount', shortLabel: 'CTN', type: 'number',
        min: 0, step: 1, placeholder: '0',
        hint: 'Number of cartons (used with CTN/Pallet ratio for conversion)',
    },
    {
        key: 'ctn_to_pallet_ratio', label: 'CTN per Pallet', shortLabel: 'CTN Ratio', type: 'number',
        min: 1, step: 1, placeholder: '—',
        hint: 'How many cartons equal one pallet (e.g. 40 means 40 CTN = 1 pallet)',
    },
    {
        key: 'priority', label: 'Priority', type: 'select',
        defaultValue: 'standard',
        options: [
            { value: 'standard', label: 'Standard' },
            { value: 'high', label: 'High Priority' },
        ],
    },
    {
        key: 'status', label: 'Status', type: 'select',
        defaultValue: 'pending',
        options: [
            { value: 'pending', label: 'Pending' },
            { value: 'assigned', label: 'Assigned' },
            { value: 'completed', label: 'Completed' },
        ],
    },
];

const DRIVER_COLS: ColDef[] = [
    {
        key: 'name', label: 'Full Name', shortLabel: 'Name', type: 'text', required: true,
        placeholder: 'Driver full name',
    },
    {
        key: 'identifier', label: 'Vehicle / Plate No.', shortLabel: 'Vehicle', type: 'text', required: true,
        placeholder: 'e.g. WXX 1234 or Lorry 1',
    },
    {
        key: 'phone', label: 'Phone (WhatsApp)', shortLabel: 'Phone', type: 'tel',
        placeholder: '60123456789',
        hint: 'Include country code, digits only. Used for automated WhatsApp dispatch.',
    },
    {
        key: 'home_region', label: 'Home Region / Zone', shortLabel: 'Region', type: 'text',
        placeholder: 'e.g. A, North, Subang',
        hint: 'Preferred delivery zone — improves routing score',
    },
    {
        key: 'max_capacity', label: 'Max Capacity (Pallets)', shortLabel: 'Max Cap.', type: 'number',
        required: true, min: 1, max: 50, step: 1, defaultValue: 11, placeholder: '11',
        hint: 'Maximum number of pallets this driver can carry per trip',
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayDate(isoDate?: string | null): string {
    if (!isoDate) return '—';
    const parts = String(isoDate).split('T')[0].split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

const PRIORITY_STYLE: Record<string, string> = {
    high: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    standard: 'bg-zinc-800 text-zinc-500 border border-zinc-700/80',
};

const STATUS_STYLE: Record<string, string> = {
    pending:     'bg-amber-500/10 text-amber-400 border border-amber-500/25',
    assigned:    'bg-blue-500/10 text-blue-300 border border-blue-500/25',
    in_progress: 'bg-purple-500/10 text-purple-400 border border-purple-500/25',
    completed:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    cancelled:   'bg-zinc-700/40 text-zinc-500 border border-zinc-700/60',
};

const STATUS_ROW_ACCENT: Record<string, string> = {
    pending:     'border-l-[3px] border-l-amber-500/50',
    assigned:    'border-l-[3px] border-l-blue-500/50',
    in_progress: 'border-l-[3px] border-l-purple-500/50',
    completed:   'border-l-[3px] border-l-emerald-500/50',
    cancelled:   'border-l-[3px] border-l-zinc-600/40',
};

function Badge({ value, styleMap, labels }: {
    value?: string;
    styleMap: Record<string, string>;
    labels?: Record<string, string>;
}) {
    const key = value || '';
    const style = styleMap[key] || 'bg-zinc-700/40 text-zinc-500 border border-zinc-700/60';
    const text = labels?.[key] || key.replace('_', ' ') || '—';
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${style}`}>{text}</span>;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateOrder(data: Partial<Order>): Record<string, string> {
    const e: Record<string, string> = {};

    if (!data.date) {
        e.date = 'Delivery date is required';
    }

    if (!data.zone?.trim()) {
        e.zone = 'Zone is required';
    }

    const pallets = Number(data.pallets);
    if (data.pallets === undefined || data.pallets === null || String(data.pallets) === '') {
        e.pallets = 'Pallets is required';
    } else if (isNaN(pallets) || pallets < 1 || pallets > 99) {
        e.pallets = 'Must be a whole number between 1 and 99';
    } else if (!Number.isInteger(pallets)) {
        e.pallets = 'Must be a whole number (no decimals)';
    }

    if (data.ctn_amount !== undefined && data.ctn_amount !== null && String(data.ctn_amount) !== '') {
        const ctn = Number(data.ctn_amount);
        if (isNaN(ctn) || ctn < 0) e.ctn_amount = 'Must be 0 or greater';
        else if (!Number.isInteger(ctn)) e.ctn_amount = 'Must be a whole number';
    }

    if (data.ctn_to_pallet_ratio !== undefined && data.ctn_to_pallet_ratio !== null && String(data.ctn_to_pallet_ratio) !== '') {
        const ratio = Number(data.ctn_to_pallet_ratio);
        if (isNaN(ratio) || ratio < 1) e.ctn_to_pallet_ratio = 'Must be 1 or greater';
        else if (!Number.isInteger(ratio)) e.ctn_to_pallet_ratio = 'Must be a whole number';
    }

    return e;
}

function validateDriver(data: Partial<Driver>): Record<string, string> {
    const e: Record<string, string> = {};

    if (!data.name?.trim()) e.name = 'Name is required';
    if (!data.identifier?.trim()) e.identifier = 'Vehicle/ID is required';

    if (data.phone) {
        const cleaned = cleanPhone(data.phone);
        if (cleaned.length < 10 || cleaned.length > 15) {
            e.phone = 'Phone must be 10–15 digits including country code (e.g. 60123456789)';
        }
    }

    const cap = Number(data.max_capacity);
    if (data.max_capacity === undefined || data.max_capacity === null || String(data.max_capacity) === '') {
        e.max_capacity = 'Max capacity is required';
    } else if (isNaN(cap) || cap < 1 || cap > 50) {
        e.max_capacity = 'Must be between 1 and 50';
    } else if (!Number.isInteger(cap)) {
        e.max_capacity = 'Must be a whole number';
    }

    return e;
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function ordersToCSV(orders: Order[]): string {
    const headers = ['DO Number', 'Invoice Number', 'Delivery Date', 'Zone', 'Pickup', 'Delivery', 'Pallets', 'CTN Amount', 'CTN per Pallet', 'Priority', 'Status'];
    const rows = orders.map(o => [
        o.do_number || '',
        o.invoice_number || '',
        toDisplayDate(o.date),
        o.zone || '',
        o.pickup || '',
        o.delivery || '',
        o.pallets ?? '',
        o.ctn_amount ?? '',
        o.ctn_to_pallet_ratio ?? '',
        o.priority || 'standard',
        o.status || 'pending',
    ]);
    return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function driversToCSV(drivers: Driver[]): string {
    const headers = ['Name', 'Vehicle / Plate No.', 'Phone (WhatsApp)', 'Home Region', 'Max Capacity'];
    const rows = drivers.map(d => [
        d.name, d.identifier, d.phone || '', d.home_region || '', d.max_capacity ?? 11,
    ]);
    return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCSV(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DatabaseManagerPage() {
    const { addLog, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'orders' | 'drivers'>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);


    // Modals
    const [orderModal, setOrderModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Order> } | null>(null);
    const [driverModal, setDriverModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Driver> } | null>(null);

    // Inline delete confirm
    const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
    const [confirmDeleteDriverId, setConfirmDeleteDriverId] = useState<string | null>(null);

    // Saving/deleting states
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // DO viewer modal
    const [viewingDO, setViewingDO] = useState<{ url: string; filename: string } | null>(null);

    // Order filters & sort
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState('active');
    const [orderDateFrom, setOrderDateFrom] = useState('');
    const [orderDateTo, setOrderDateTo] = useState('');
    const [orderSort, setOrderSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'asc' });

    // Driver filters & sort
    const [driverSearch, setDriverSearch] = useState('');
    const [driverStatusFilter, setDriverStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [driverSort, setDriverSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' });

    // Pagination
    const [orderPageSize, setOrderPageSize] = useState(10);
    const [orderPage, setOrderPage] = useState(1);
    const [driverPageSize, setDriverPageSize] = useState(10);
    const [driverPage, setDriverPage] = useState(1);

    const filteredOrders = useMemo(() => {
        let result = [...orders];
        if (orderSearch) {
            const q = orderSearch.toLowerCase();
            result = result.filter(o =>
                o.do_number?.toLowerCase().includes(q) ||
                o.zone?.toLowerCase().includes(q) ||
                o.delivery?.toLowerCase().includes(q) ||
                o.pickup?.toLowerCase().includes(q) ||
                o.invoice_number?.toLowerCase().includes(q)
            );
        }
        if (orderStatusFilter === 'active') result = result.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
        else if (orderStatusFilter) result = result.filter(o => o.status === orderStatusFilter);
        if (orderDateFrom) result = result.filter(o => o.date >= orderDateFrom);
        if (orderDateTo) result = result.filter(o => o.date <= orderDateTo);
        result.sort((a, b) => {
            let av: any, bv: any;
            switch (orderSort.field) {
                case 'date': av = a.date || ''; bv = b.date || ''; break;
                case 'zone': av = a.zone?.toLowerCase() || ''; bv = b.zone?.toLowerCase() || ''; break;
                case 'pallets': av = a.pallets ?? 0; bv = b.pallets ?? 0; break;
                case 'status': av = a.status || ''; bv = b.status || ''; break;
                default: av = ''; bv = '';
            }
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return orderSort.dir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [orders, orderSearch, orderStatusFilter, orderDateFrom, orderDateTo, orderSort]);

    const filteredDrivers = useMemo(() => {
        let result = [...drivers];
        if (driverSearch) {
            const q = driverSearch.toLowerCase();
            result = result.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                d.identifier?.toLowerCase().includes(q) ||
                d.home_region?.toLowerCase().includes(q)
            );
        }
        if (driverStatusFilter === 'active') result = result.filter(d => d.is_active !== false);
        else if (driverStatusFilter === 'inactive') result = result.filter(d => d.is_active === false);
        result.sort((a, b) => {
            let av: any, bv: any;
            switch (driverSort.field) {
                case 'name': av = a.name?.toLowerCase() || ''; bv = b.name?.toLowerCase() || ''; break;
                case 'max_capacity': av = a.max_capacity ?? 0; bv = b.max_capacity ?? 0; break;
                default: av = ''; bv = '';
            }
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return driverSort.dir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [drivers, driverSearch, driverSort]);

    function toggleOrderSort(field: string) {
        setOrderSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }
    function toggleDriverSort(field: string) {
        setDriverSort(prev => ({ field, dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }
    function clearOrderFilters() {
        setOrderSearch(''); setOrderStatusFilter(''); setOrderDateFrom(''); setOrderDateTo('');
    }

    // Reset to page 1 when filters or sort change
    useEffect(() => { setOrderPage(1); }, [orderSearch, orderStatusFilter, orderDateFrom, orderDateTo, orderSort]);
    useEffect(() => { setDriverPage(1); }, [driverSearch, driverSort, driverStatusFilter]);

    // Paged slices
    const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
    const pagedOrders = filteredOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);
    const driverTotalPages = Math.max(1, Math.ceil(filteredDrivers.length / driverPageSize));
    const pagedDrivers = filteredDrivers.slice((driverPage - 1) * driverPageSize, driverPage * driverPageSize);

    useEffect(() => { loadAll(); }, []);

    async function loadAll() {
        setLoading(true);
        try {
            const [o, d] = await Promise.all([db.getAllOrders(), db.getAllDrivers()]);
            setOrders(o);
            setDrivers(d);
            dispatch({ type: 'SET_ORDERS', payload: o });
            dispatch({ type: 'SET_DRIVERS', payload: d });
        } catch (err: any) {
            addLog('error', 'Failed to load data', err.message);
        } finally {
            setLoading(false);
        }
    }

    // ── Order CRUD ──────────────────────────────────────────────────────────

    async function handleSaveOrder(
        data: Partial<Order>,
        pendingFile: File | null,
        removeAttachment: boolean,
    ) {
        setSaving(true);
        try {
            let orderId: string;

            if (orderModal?.mode === 'add') {
                const created = await db.addOrder(data);
                orderId = created.id;
                const updated = [...orders, created];
                setOrders(updated);
                dispatch({ type: 'SET_ORDERS', payload: updated });
                addLog('success', 'Order added');
            } else if (orderModal?.mode === 'edit' && data.id) {
                await db.updateOrder(data.id, data);
                orderId = data.id;
                const updated = orders.map(o => o.id === data.id ? { ...o, ...data } as Order : o);
                setOrders(updated);
                dispatch({ type: 'SET_ORDERS', payload: updated });
                addLog('success', 'Order updated');
            } else {
                return;
            }

            // Handle attachment changes
            const existingUrl = data.attachment_urls?.[0];
            if (removeAttachment && existingUrl) {
                await deleteAttachment(existingUrl).catch(() => null);
                await db.updateOrder(orderId, { attachment_urls: [] });
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, attachment_urls: [] } : o));
                dispatch({ type: 'SET_ORDERS', payload: orders.map(o => o.id === orderId ? { ...o, attachment_urls: [] } : o) });
            } else if (pendingFile) {
                const result = await uploadOrderAttachment(orderId, pendingFile);
                if (result.success && result.url) {
                    await db.updateOrder(orderId, { attachment_urls: [result.url] });
                    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, attachment_urls: [result.url!] } : o));
                    addLog('success', 'DO file uploaded');
                } else {
                    addLog('error', 'DO file upload failed', result.error);
                }
            }

            setOrderModal(null);
        } catch (err: any) {
            addLog('error', 'Failed to save order', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteOrder(id: string) {
        setDeletingId(id);
        try {
            await db.deleteOrder(id);
            const updated = orders.filter(o => o.id !== id);
            setOrders(updated);
            dispatch({ type: 'SET_ORDERS', payload: updated });
            addLog('success', 'Order deleted');
        } catch (err: any) {
            addLog('error', 'Failed to delete order', err.message);
        } finally {
            setDeletingId(null);
            setConfirmDeleteOrderId(null);
        }
    }

    // ── Driver CRUD ─────────────────────────────────────────────────────────

    async function handleSaveDriver(data: Partial<Driver>) {
        setSaving(true);
        try {
            if (driverModal?.mode === 'add') {
                await db.addDriver({ ...data, id: crypto.randomUUID() } as Driver);
                await loadAll(); // reload to get the DB-assigned id
                addLog('success', 'Driver added');
            } else if (driverModal?.mode === 'edit' && data.id) {
                await db.updateDriver(data.id, data);
                const updated = drivers.map(d => d.id === data.id ? { ...d, ...data } as Driver : d);
                setDrivers(updated);
                dispatch({ type: 'SET_DRIVERS', payload: updated });
                addLog('success', 'Driver updated');
            }
            setDriverModal(null);
        } catch (err: any) {
            addLog('error', 'Failed to save driver', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteDriver(id: string) {
        setDeletingId(id);
        try {
            await db.deleteDriver(id);
            const updated = drivers.filter(d => d.id !== id);
            setDrivers(updated);
            dispatch({ type: 'SET_DRIVERS', payload: updated });
            addLog('success', 'Driver deleted');
        } catch (err: any) {
            addLog('error', 'Failed to delete driver', err.message);
        } finally {
            setDeletingId(null);
            setConfirmDeleteDriverId(null);
        }
    }

    async function handleToggleDriverActive(driver: Driver) {
        const newState = driver.is_active === false ? true : false;
        try {
            await db.setDriverActive(driver.id, newState);
            const updated = drivers.map(d => d.id === driver.id ? { ...d, is_active: newState } : d);
            setDrivers(updated);
            dispatch({ type: 'SET_DRIVERS', payload: updated });
            addLog('success', `Driver ${driver.name} ${newState ? 'activated' : 'deactivated'}`);
        } catch (err: any) {
            addLog('error', `Failed to ${newState ? 'activate' : 'deactivate'} driver`, err.message);
        }
    }

    // ── CSV ─────────────────────────────────────────────────────────────────

    async function handleImportOrdersCSV(file: File) {
        try {
            const parsed = await csv.parseCSVFile(file);
            let imported = 0;
            let failed = 0;

            for (const row of parsed.data) {
                const get = (...keys: string[]) => {
                    for (const k of keys) {
                        for (const [col, val] of Object.entries(row)) {
                            if (col.toLowerCase().replace(/[\s_\-\.]/g, '') === k.toLowerCase().replace(/[\s_\-\.]/g, '')) {
                                return String(val || '').trim();
                            }
                        }
                    }
                    return '';
                };

                // Parse DD/MM/YYYY or YYYY-MM-DD to ISO date
                function parseImportDate(raw: string): string {
                    if (!raw) return '';
                    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // already ISO
                    const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
                    return '';
                }

                const dateRaw = get('date', 'deliverydate', 'delivery date', 'deliverdate');
                const palletsRaw = get('pallets', 'pallet', 'qty', 'quantity');
                const zoneRaw = get('zone', 'area', 'region');

                const orderData: Partial<Order> = {
                    do_number: get('donumber', 'do number', 'do#', 'do') || undefined,
                    invoice_number: get('invoicenumber', 'invoice number', 'invoice', 'inv') || undefined,
                    date: parseImportDate(dateRaw),
                    zone: zoneRaw,
                    pickup: get('pickup', 'from', 'origin', 'pickuplocation', 'pickup location') || undefined,
                    delivery: get('delivery', 'to', 'destination', 'deliverylocation', 'delivery location') || undefined,
                    pallets: palletsRaw ? parseInt(palletsRaw) : undefined,
                    ctn_amount: get('ctn', 'ctnamount', 'ctn amount', 'cartons') ? parseInt(get('ctn', 'ctnamount', 'ctn amount', 'cartons')) : undefined,
                    ctn_to_pallet_ratio: get('ctnperpallet', 'ctn per pallet', 'ctntopallet', 'ctnratio') ? parseInt(get('ctnperpallet', 'ctn per pallet', 'ctntopallet', 'ctnratio')) : undefined,
                    priority: get('priority') === 'high' ? 'high' : 'standard',
                    status: 'pending',
                };

                const errors = validateOrder(orderData);
                if (Object.keys(errors).length === 0) {
                    try {
                        await db.addOrder(orderData);
                        imported++;
                    } catch {
                        failed++;
                    }
                } else {
                    failed++;
                }
            }

            await loadAll();
            addLog('success', `CSV import: ${imported} orders added${failed > 0 ? `, ${failed} skipped (validation failed)` : ''}`);
        } catch (err: any) {
            addLog('error', 'CSV import failed', err.message);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-1.5">Operations</p>
                <h1 className="text-3xl font-bold text-white tracking-tight">Database Manager</h1>
                <p className="text-zinc-500 mt-1 text-sm">
                    Centralized orders and drivers — changes sync instantly to distribution
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
                {([
                    { key: 'orders', label: 'Orders', count: orders.length, Icon: Package },
                    { key: 'drivers', label: 'Drivers', count: drivers.length, Icon: Users },
                ] as const).map(({ key, label, count, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${activeTab === key
                            ? 'border-emerald-500 text-white'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === key ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                            {count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Orders tab */}
            {activeTab === 'orders' && (
                <div className="card">
                    {/* Toolbar */}
                    <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-white">Orders</h2>
                            <p className="text-xs text-zinc-600 mt-0.5">
                                {filteredOrders.length === orders.length
                                    ? `${orders.length} records`
                                    : `${filteredOrders.length} of ${orders.length} records`} · DD/MM/YYYY
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadCSV('orders.csv', ordersToCSV(orders))}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all"
                            >
                                <Download className="w-3.5 h-3.5" /> Export
                            </button>
                            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all cursor-pointer">
                                <Upload className="w-3.5 h-3.5" /> Import
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) handleImportOrdersCSV(e.target.files[0]); e.target.value = ''; }}
                                />
                            </label>
                            <button
                                onClick={() => setOrderModal({ mode: 'add', data: { priority: 'standard', status: 'pending' } })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm shadow-emerald-900/50"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Order
                            </button>
                        </div>
                    </div>

                    {/* Order Filters */}
                    <div className="px-5 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search DO#, zone, delivery…"
                                value={orderSearch}
                                onChange={e => setOrderSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                            />
                        </div>
                        <select
                            value={orderStatusFilter}
                            onChange={e => setOrderStatusFilter(e.target.value)}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 min-w-[130px]"
                        >
                            <option value="active">Active (excl. completed)</option>
                            <option value="">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="completed">Completed</option>
                        </select>
                        <input
                            type="date"
                            value={orderDateFrom}
                            onChange={e => setOrderDateFrom(e.target.value)}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                            title="From date"
                        />
                        <span className="text-zinc-600 text-xs">to</span>
                        <input
                            type="date"
                            value={orderDateTo}
                            onChange={e => setOrderDateTo(e.target.value)}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                            title="To date"
                        />
                        {(orderSearch || orderStatusFilter || orderDateFrom || orderDateTo) && (
                            <button
                                onClick={clearOrderFilters}
                                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700/50 rounded-lg hover:bg-zinc-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Completed orders hidden notice */}
                    {orderStatusFilter === 'active' && orders.filter(o => o.status === 'completed').length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs text-zinc-400">
                            <span>
                                <span className="text-emerald-400 font-medium">{orders.filter(o => o.status === 'completed').length} completed order{orders.filter(o => o.status === 'completed').length !== 1 ? 's' : ''}</span>
                                {' '}hidden from this view — all data is linked in the same database.
                            </span>
                            <Link href="/completed-orders" className="text-emerald-400 hover:text-emerald-300 underline whitespace-nowrap ml-4">
                                View Completed Orders →
                            </Link>
                        </div>
                    )}

                    {/* Orders table */}
                    {orders.length === 0 ? (
                        <div className="p-12 text-center">
                            <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                            <p className="text-zinc-500">No orders yet. Add one or import a CSV.</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-zinc-500 text-sm mb-2">No orders match your filters.</p>
                            <button onClick={clearOrderFilters} className="text-xs text-emerald-400 hover:text-emerald-300 underline">Clear filters</button>
                        </div>
                    ) : (
                        <div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                        <th className="pl-4 pr-2 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-8">#</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">DO #</th>
                                        <SortTh label="Date" field="date" sort={orderSort} onSort={toggleOrderSort} />
                                        <SortTh label="Zone" field="zone" sort={orderSort} onSort={toggleOrderSort} />
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Pickup → Delivery</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">DO</th>
                                        <SortTh label="Pallets" field="pallets" sort={orderSort} onSort={toggleOrderSort} />
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Priority</th>
                                        <SortTh label="Status" field="status" sort={orderSort} onSort={toggleOrderSort} />
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-20">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {pagedOrders.map((order, i) => (
                                        <tr key={order.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group h-[44px] ${STATUS_ROW_ACCENT[order.status || 'pending'] || 'border-l-[3px] border-l-zinc-700/30'}`}>
                                            <td className="pl-4 pr-2 py-3 text-[10px] text-zinc-600 font-mono">{(orderPage - 1) * orderPageSize + i + 1}</td>
                                            <td className="px-3 py-3 text-zinc-400 font-mono text-xs">{order.do_number || <span className="text-zinc-700">—</span>}</td>
                                            <td className="px-3 py-3 text-zinc-300 whitespace-nowrap text-sm">{toDisplayDate(order.date)}</td>
                                            <td className="px-3 py-3 text-zinc-200 font-medium text-sm">{order.zone || <span className="text-zinc-600">—</span>}</td>
                                            <td className="px-3 py-3 text-zinc-500 max-w-[220px] text-xs">
                                                {order.pickup || order.delivery
                                                    ? <span className="truncate block">{order.pickup || '?'} → {order.delivery || '?'}</span>
                                                    : <span className="text-zinc-700">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {order.attachment_urls?.[0] ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setViewingDO({ url: order.attachment_urls![0], filename: order.attachment_urls![0] })}
                                                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                                                            title="View DO"
                                                        >
                                                            <Paperclip className="w-3 h-3" />
                                                            DO
                                                        </button>
                                                        <a
                                                            href={order.attachment_urls![0]}
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                                                            title="Download"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-700 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-zinc-200 font-semibold text-sm text-center tabular-nums">{order.pallets ?? <span className="text-zinc-700">—</span>}</td>
                                            <td className="px-3 py-3">
                                                <Badge value={order.priority} styleMap={PRIORITY_STYLE} labels={{ standard: 'Std', high: 'High' }} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <Badge value={order.status} styleMap={STATUS_STYLE} labels={{ in_progress: 'In Prog' }} />
                                            </td>
                                            <td className="w-[120px] px-3 py-3">
                                                <div className="grid">
                                                    <div className={`row-start-1 col-start-1 flex items-center gap-1 transition-opacity duration-150 ${confirmDeleteOrderId === order.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                                        <button
                                                            onClick={() => handleDeleteOrder(order.id)}
                                                            disabled={deletingId === order.id}
                                                            className="px-2 py-1 text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md hover:bg-rose-500/25 transition-colors"
                                                        >
                                                            {deletingId === order.id ? '…' : 'Delete'}
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteOrderId(null)}
                                                            className="px-2 py-1 text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <div className={`row-start-1 col-start-1 flex items-center gap-1 transition-opacity duration-150 ${confirmDeleteOrderId === order.id ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <button
                                                            onClick={() => setOrderModal({ mode: 'edit', data: { ...order } })}
                                                            className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 rounded-md transition-colors"
                                                            title="Edit order"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteOrderId(order.id)}
                                                            className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                                            title="Delete order"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Orders pagination */}
                        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-4 flex-wrap bg-zinc-900/30">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-1">Per page</span>
                                {[10, 50, 100].map(size => (
                                    <button
                                        key={size}
                                        onClick={() => { setOrderPageSize(size); setOrderPage(1); }}
                                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                                            orderPageSize === size
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50'
                                        }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500">
                                    {filteredOrders.length === 0 ? '0' : `${(orderPage - 1) * orderPageSize + 1}-${Math.min(orderPage * orderPageSize, filteredOrders.length)}`} of {filteredOrders.length}
                                </span>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                                        disabled={orderPage === 1}
                                        className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-md hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-zinc-400 px-2 min-w-[4rem] text-center tabular-nums">
                                        {orderPage} / {orderTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))}
                                        disabled={orderPage >= orderTotalPages}
                                        className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-md hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            )}

            {/* Drivers tab */}
            {activeTab === 'drivers' && (
                <div className="card">
                    {/* Toolbar */}
                    <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-white">Drivers</h2>
                            <p className="text-xs text-zinc-600 mt-0.5">{drivers.length} records · phone numbers used for WhatsApp dispatch</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadCSV('drivers.csv', driversToCSV(drivers))}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all"
                            >
                                <Download className="w-3.5 h-3.5" /> Export
                            </button>
                            <button
                                onClick={() => setDriverModal({ mode: 'add', data: { max_capacity: 11 } })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm shadow-emerald-900/50"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add Driver
                            </button>
                        </div>
                    </div>

                    {/* Driver Filters */}
                    <div className="px-5 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center gap-2">
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search name, vehicle, region…"
                                value={driverSearch}
                                onChange={e => setDriverSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                            />
                        </div>
                        <select
                            value={driverStatusFilter}
                            onChange={e => setDriverStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="all">All drivers</option>
                            <option value="active">Active only</option>
                            <option value="inactive">Inactive only</option>
                        </select>
                        {(driverSearch || driverStatusFilter !== 'all') && (
                            <button
                                onClick={() => { setDriverSearch(''); setDriverStatusFilter('all'); }}
                                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700/50 rounded-lg hover:bg-zinc-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <span className="text-xs text-zinc-600 ml-auto">
                            {filteredDrivers.length === drivers.length ? `${drivers.length} total` : `${filteredDrivers.length} of ${drivers.length}`}
                        </span>
                    </div>

                    {/* Drivers table */}
                    {drivers.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                            <p className="text-zinc-500">No drivers yet. Add one to get started.</p>
                        </div>
                    ) : filteredDrivers.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-zinc-500 text-sm mb-2">No drivers match your search.</p>
                            <button onClick={() => setDriverSearch('')} className="text-xs text-emerald-400 hover:text-emerald-300 underline">Clear search</button>
                        </div>
                    ) : (
                        <div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                        <th className="pl-4 pr-2 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-8">#</th>
                                        <SortTh label="Name" field="name" sort={driverSort} onSort={toggleDriverSort} />
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Vehicle / Plate</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> WhatsApp
                                            </span>
                                        </th>
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Home Region</th>
                                        <SortTh label="Capacity" field="max_capacity" sort={driverSort} onSort={toggleDriverSort} />
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                        <th className="px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-28">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedDrivers.map((driver, i) => (
                                        <tr key={driver.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group h-[44px] border-l-[3px] ${driver.is_active === false ? 'border-l-zinc-600/40 opacity-60' : 'border-l-transparent'}`}>
                                            <td className="pl-4 pr-2 py-3 text-[10px] text-zinc-600 font-mono">{(driverPage - 1) * driverPageSize + i + 1}</td>
                                            <td className="px-3 py-3 text-zinc-200 font-medium text-sm">{driver.name}</td>
                                            <td className="px-3 py-3 text-zinc-400 font-mono text-xs">{driver.identifier}</td>
                                            <td className="px-3 py-3">
                                                {driver.phone
                                                    ? <span className="text-emerald-400 font-mono text-xs">{driver.phone}</span>
                                                    : <span className="text-zinc-700 text-xs italic">not set</span>
                                                }
                                            </td>
                                            <td className="px-3 py-3 text-zinc-400 text-sm">{driver.home_region || <span className="text-zinc-700">—</span>}</td>
                                            <td className="px-3 py-3 text-zinc-300 text-center font-semibold tabular-nums text-sm">{driver.max_capacity ?? 11}</td>
                                            <td className="px-3 py-3">
                                                {driver.is_active === false
                                                    ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase bg-zinc-700/40 text-zinc-500 border border-zinc-700/60">Inactive</span>
                                                    : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Active</span>
                                                }
                                            </td>
                                            <td className="w-[120px] px-3 py-3">
                                                <div className="grid">
                                                    <div className={`row-start-1 col-start-1 flex items-center gap-1 transition-opacity duration-150 ${confirmDeleteDriverId === driver.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                                        <button
                                                            onClick={() => handleDeleteDriver(driver.id)}
                                                            disabled={deletingId === driver.id}
                                                            className="px-2 py-1 text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md hover:bg-rose-500/25 transition-colors"
                                                        >
                                                            {deletingId === driver.id ? '…' : 'Delete'}
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteDriverId(null)}
                                                            className="px-2 py-1 text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    <div className={`row-start-1 col-start-1 flex items-center gap-1 transition-opacity duration-150 ${confirmDeleteDriverId === driver.id ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <button
                                                            onClick={() => setDriverModal({ mode: 'edit', data: { ...driver } })}
                                                            className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 rounded-md transition-colors"
                                                            title="Edit driver"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleDriverActive(driver)}
                                                            className={`p-1.5 rounded-md transition-colors ${
                                                                driver.is_active === false
                                                                    ? 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                                    : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                                                            }`}
                                                            title={driver.is_active === false ? 'Activate driver' : 'Deactivate driver'}
                                                        >
                                                            {driver.is_active === false
                                                                ? <Check className="w-3.5 h-3.5" />
                                                                : <X className="w-3.5 h-3.5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteDriverId(driver.id)}
                                                            className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                                            title="Delete driver"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Drivers pagination */}
                        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-1">Per page</span>
                                {[10, 50, 100].map(size => (
                                    <button
                                        key={size}
                                        onClick={() => { setDriverPageSize(size); setDriverPage(1); }}
                                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                                            driverPageSize === size
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50'
                                        }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500">
                                    {filteredDrivers.length === 0 ? '0' : `${(driverPage - 1) * driverPageSize + 1}-${Math.min(driverPage * driverPageSize, filteredDrivers.length)}`} of {filteredDrivers.length}
                                </span>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={() => setDriverPage(p => Math.max(1, p - 1))}
                                        disabled={driverPage === 1}
                                        className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-md hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-zinc-400 px-2 min-w-[4rem] text-center tabular-nums">
                                        {driverPage} / {driverTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setDriverPage(p => Math.min(driverTotalPages, p + 1))}
                                        disabled={driverPage >= driverTotalPages}
                                        className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-md hover:bg-zinc-800 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            )}

            {/* Order Modal */}
            {orderModal && (
                <FormModal
                    title={orderModal.mode === 'add' ? 'Add Order' : 'Edit Order'}
                    onClose={() => setOrderModal(null)}
                >
                    <OrderForm
                        initial={orderModal.data}
                        saving={saving}
                        onSave={handleSaveOrder}
                        onCancel={() => setOrderModal(null)}
                    />
                </FormModal>
            )}

            {/* DO Viewer Modal */}
            {viewingDO && (
                <DOViewerModal
                    url={viewingDO.url}
                    filename={viewingDO.filename}
                    onClose={() => setViewingDO(null)}
                />
            )}

            {/* Driver Modal */}
            {driverModal && (
                <FormModal
                    title={driverModal.mode === 'add' ? 'Add Driver' : 'Edit Driver'}
                    onClose={() => setDriverModal(null)}
                >
                    <DriverForm
                        initial={driverModal.data}
                        saving={saving}
                        onSave={handleSaveDriver}
                        onCancel={() => setDriverModal(null)}
                    />
                </FormModal>
            )}
        </div>
    );
}

// ── SortTh ────────────────────────────────────────────────────────────────────

function SortTh({ label, field, sort, onSort, className }: {
    label: string;
    field: string;
    sort: { field: string; dir: 'asc' | 'desc' };
    onSort: (f: string) => void;
    className?: string;
}) {
    const active = sort.field === field;
    return (
        <th
            className={`px-3 py-3 text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap transition-colors ${className || ''}`}
            onClick={() => onSort(field)}
        >
            <span className="flex items-center gap-1">
                {label}
                <span className={`text-[9px] leading-none ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </span>
        </th>
    );
}

// ── FormModal wrapper ─────────────────────────────────────────────────────────

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 overflow-y-auto" onClick={onClose}>
            <div className="flex min-h-full items-center justify-center p-6">
                <div
                    className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl my-auto"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
                        <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="px-6 py-5">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Order Form ────────────────────────────────────────────────────────────────

function OrderForm({ initial, saving, onSave, onCancel }: {
    initial: Partial<Order>;
    saving: boolean;
    onSave: (data: Partial<Order>, pendingFile: File | null, removeAttachment: boolean) => void;
    onCancel: () => void;
}) {
    const [data, setData] = useState<Partial<Order>>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [removeAttachment, setRemoveAttachment] = useState(false);
    const { cache } = useApp();
    const zones = cache.zones || [];

    const savedUrl = removeAttachment ? undefined : (initial.attachment_urls?.[0]);

    function set(key: string, value: any) {
        setData(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
        setTouched(prev => ({ ...prev, [key]: true }));
    }

    function handleZoneSelect(val: { zone_id: string; district_id: string } | null) {
        if (!val) {
            setData(prev => ({ ...prev, zone_id: undefined, district_id: undefined, zone: '' }));
        } else {
            const z = zones.find(z => z.id === val.zone_id);
            const d = z?.districts.find(d => d.id === val.district_id);
            const zoneText = z && d ? `${z.name} - ${d.name}` : (z?.name || '');
            setData(prev => ({ ...prev, zone_id: val.zone_id, district_id: val.district_id, zone: zoneText }));
        }
        if (errors.zone) setErrors(prev => { const n = { ...prev }; delete n.zone; return n; });
        setTouched(prev => ({ ...prev, zone: true }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const errs = validateOrder(data);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            const t: Record<string, boolean> = {};
            Object.keys(errs).forEach(k => { t[k] = true; });
            setTouched(prev => ({ ...prev, ...t }));
            return;
        }
        onSave({
            ...data,
            pallets: Number(data.pallets),
            ctn_amount: data.ctn_amount !== undefined && String(data.ctn_amount) !== '' ? Number(data.ctn_amount) : undefined,
            ctn_to_pallet_ratio: data.ctn_to_pallet_ratio !== undefined && String(data.ctn_to_pallet_ratio) !== '' ? Number(data.ctn_to_pallet_ratio) : undefined,
        }, pendingFile, removeAttachment);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Group 1: Delivery info */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Delivery Info</legend>
                <div className="grid grid-cols-2 gap-3">
                    <FormField col={ORDER_COLS.find(c => c.key === 'do_number')!} value={data.do_number} error={touched.do_number ? errors.do_number : undefined} onChange={v => set('do_number', v)} />
                    <FormField col={ORDER_COLS.find(c => c.key === 'invoice_number')!} value={data.invoice_number} error={touched.invoice_number ? errors.invoice_number : undefined} onChange={v => set('invoice_number', v)} />
                </div>
                <FormField col={ORDER_COLS.find(c => c.key === 'date')!} value={data.date} error={touched.date ? errors.date : undefined} onChange={v => set('date', v)} />
                <div>
                    <ZoneDistrictSelector
                        value={{ zone_id: data.zone_id, district_id: data.district_id }}
                        onChange={handleZoneSelect}
                        zones={zones}
                        required
                    />
                    {touched.zone && errors.zone && (
                        <p className="text-xs text-rose-400 mt-1">{errors.zone}</p>
                    )}
                </div>
            </fieldset>

            {/* Group 2: Route */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Route</legend>
                <div className="grid grid-cols-2 gap-3">
                    <FormField col={ORDER_COLS.find(c => c.key === 'pickup')!} value={data.pickup} error={touched.pickup ? errors.pickup : undefined} onChange={v => set('pickup', v)} />
                    <FormField col={ORDER_COLS.find(c => c.key === 'delivery')!} value={data.delivery} error={touched.delivery ? errors.delivery : undefined} onChange={v => set('delivery', v)} />
                </div>
            </fieldset>

            {/* Group 3: Quantities */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Quantities</legend>
                <div className="grid grid-cols-3 gap-3">
                    <FormField col={ORDER_COLS.find(c => c.key === 'pallets')!} value={data.pallets} error={touched.pallets ? errors.pallets : undefined} onChange={v => set('pallets', v)} />
                    <FormField col={ORDER_COLS.find(c => c.key === 'ctn_amount')!} value={data.ctn_amount} error={touched.ctn_amount ? errors.ctn_amount : undefined} onChange={v => set('ctn_amount', v)} />
                    <FormField col={ORDER_COLS.find(c => c.key === 'ctn_to_pallet_ratio')!} value={data.ctn_to_pallet_ratio} error={touched.ctn_to_pallet_ratio ? errors.ctn_to_pallet_ratio : undefined} onChange={v => set('ctn_to_pallet_ratio', v)} />
                </div>
            </fieldset>

            {/* Group 4: Classification */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Classification</legend>
                <div className="grid grid-cols-2 gap-3">
                    <FormField col={ORDER_COLS.find(c => c.key === 'priority')!} value={data.priority} error={errors.priority} onChange={v => set('priority', v)} />
                    <FormField col={ORDER_COLS.find(c => c.key === 'status')!} value={data.status} error={errors.status} onChange={v => set('status', v)} />
                </div>
            </fieldset>

            {/* Group 5: DO Document */}
            <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">DO Document</legend>
                {pendingFile ? (
                    /* State B: file staged */
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-sm text-zinc-200 truncate flex-1">{pendingFile.name}</span>
                        <span className="text-xs text-zinc-500 shrink-0">will upload on save</span>
                        <button
                            type="button"
                            onClick={() => setPendingFile(null)}
                            className="p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors shrink-0"
                            title="Cancel"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : savedUrl ? (
                    /* State C: saved attachment */
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
                        <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-sm text-zinc-200 truncate flex-1">
                            {savedUrl.split('/').pop()?.replace(/^\d+-/, '') || 'Attachment'}
                        </span>
                        <a
                            href={savedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                            onClick={e => e.stopPropagation()}
                        >
                            <Eye className="w-3.5 h-3.5" /> View
                        </a>
                        <a
                            href={savedUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                            onClick={e => e.stopPropagation()}
                        >
                            <Download className="w-3.5 h-3.5" /> Download
                        </a>
                        <button
                            type="button"
                            onClick={() => setRemoveAttachment(true)}
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors shrink-0"
                            title="Remove attachment"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    /* State A: nothing attached */
                    <label className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-dashed border-zinc-600 rounded-lg cursor-pointer hover:border-zinc-500 hover:bg-zinc-700/50 transition-colors w-fit">
                        <Paperclip className="w-4 h-4 text-zinc-400" />
                        <span className="text-sm text-zinc-400">Attach DO file</span>
                        <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setPendingFile(f);
                                e.target.value = '';
                            }}
                        />
                    </label>
                )}
            </fieldset>

            <div className="flex gap-3 pt-4 border-t border-zinc-800 mt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 flex-1">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save Order'}
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            </div>
        </form>
    );
}

// ── Driver Form ───────────────────────────────────────────────────────────────

function DriverForm({ initial, saving, onSave, onCancel }: {
    initial: Partial<Driver>;
    saving: boolean;
    onSave: (data: Partial<Driver>) => void;
    onCancel: () => void;
}) {
    const [data, setData] = useState<Partial<Driver>>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    function set(key: string, value: any) {
        setData(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
        setTouched(prev => ({ ...prev, [key]: true }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const errs = validateDriver(data);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            const t: Record<string, boolean> = {};
            Object.keys(errs).forEach(k => { t[k] = true; });
            setTouched(prev => ({ ...prev, ...t }));
            return;
        }
        onSave({
            ...data,
            phone: data.phone ? cleanPhone(data.phone) : undefined,
            max_capacity: Number(data.max_capacity),
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identity */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Driver Identity</legend>
                <div className="grid grid-cols-2 gap-3">
                    <FormField col={DRIVER_COLS.find(c => c.key === 'name')!} value={data.name} error={touched.name ? errors.name : undefined} onChange={v => set('name', v)} />
                    <FormField col={DRIVER_COLS.find(c => c.key === 'identifier')!} value={data.identifier} error={touched.identifier ? errors.identifier : undefined} onChange={v => set('identifier', v)} />
                </div>
            </fieldset>

            {/* Contact & Route */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Contact & Routing</legend>
                <div className="grid grid-cols-2 gap-3">
                    <FormField col={DRIVER_COLS.find(c => c.key === 'phone')!} value={data.phone} error={touched.phone ? errors.phone : undefined} onChange={v => set('phone', v)} />
                    <FormField col={DRIVER_COLS.find(c => c.key === 'home_region')!} value={data.home_region} error={touched.home_region ? errors.home_region : undefined} onChange={v => set('home_region', v)} />
                </div>
            </fieldset>

            {/* Capacity */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Capacity</legend>
                <div className="w-48">
                    <FormField col={DRIVER_COLS.find(c => c.key === 'max_capacity')!} value={data.max_capacity} error={touched.max_capacity ? errors.max_capacity : undefined} onChange={v => set('max_capacity', v)} />
                </div>
            </fieldset>

            <div className="flex gap-3 pt-4 border-t border-zinc-800 mt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 flex-1">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save Driver'}
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            </div>
        </form>
    );
}

// ── Reusable FormField ────────────────────────────────────────────────────────

function FormField({ col, value, error, onChange }: {
    col: ColDef;
    value: any;
    error?: string;
    onChange: (value: any) => void;
}) {
    const inputClass = `w-full px-3 py-2 bg-zinc-800 border rounded-lg text-zinc-200 text-sm focus:outline-none focus:ring-1 transition-colors ${
        error
            ? 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/30'
            : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/30'
    }`;

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">
                {col.label}
                {col.required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>

            {col.type === 'select' ? (
                <div className="relative">
                    <select
                        value={value ?? col.defaultValue ?? ''}
                        onChange={e => onChange(e.target.value)}
                        className={inputClass + ' appearance-none pr-8'}
                    >
                        {col.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>
            ) : col.type === 'date' ? (
                <input
                    type="date"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className={inputClass}
                />
            ) : col.type === 'number' ? (
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)}
                    min={col.min}
                    max={col.max}
                    step={col.step ?? 1}
                    placeholder={col.placeholder}
                    className={inputClass}
                />
            ) : col.type === 'tel' ? (
                <input
                    type="tel"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={col.placeholder}
                    className={inputClass}
                />
            ) : (
                <input
                    type="text"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={col.placeholder}
                    className={inputClass}
                />
            )}

            {error && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                </p>
            )}
            {!error && col.hint && (
                <p className="text-xs text-zinc-600">{col.hint}</p>
            )}
        </div>
    );
}
