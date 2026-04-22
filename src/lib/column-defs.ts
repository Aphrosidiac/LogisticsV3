// Shared column definitions for orders and drivers tables

export interface ColDef {
    key: string;
    label: string;
    shortLabel?: string;
    type: 'text' | 'number' | 'date' | 'select' | 'tel';
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: string | number | boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
    hint?: string;
}

export const ORDER_COLS: ColDef[] = [
    {
        key: 'do_number', label: 'DO Number', type: 'text',
        placeholder: 'e.g. DO-2025-001', hint: 'Delivery order reference number',
    },
    {
        key: 'invoice_number', label: 'Invoice Number / Company Name', shortLabel: 'Inv# / Company', type: 'text',
        placeholder: 'e.g. INV-001 or TRUSPACK',
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
        min: 0, step: 1, placeholder: '—',
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

export const DRIVER_COLS: ColDef[] = [
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

// Style maps
export const PRIORITY_STYLE: Record<string, string> = {
    high: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    standard: 'bg-zinc-800 text-zinc-500 border border-zinc-700/80',
};

export const STATUS_STYLE: Record<string, string> = {
    pending:     'bg-amber-500/10 text-amber-400 border border-amber-500/25',
    assigned:    'bg-blue-500/10 text-blue-300 border border-blue-500/25',
    in_progress: 'bg-purple-500/10 text-purple-400 border border-purple-500/25',
    completed:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    cancelled:   'bg-zinc-700/40 text-zinc-500 border border-zinc-700/60',
};

export const STATUS_ROW_ACCENT: Record<string, string> = {
    pending:     'border-l-[3px] border-l-amber-500/50',
    assigned:    'border-l-[3px] border-l-blue-500/50',
    in_progress: 'border-l-[3px] border-l-purple-500/50',
    completed:   'border-l-[3px] border-l-emerald-500/50',
    cancelled:   'border-l-[3px] border-l-zinc-600/40',
};
