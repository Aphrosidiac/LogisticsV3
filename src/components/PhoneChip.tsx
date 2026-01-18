'use client';

import { X } from 'lucide-react';

interface PhoneChipProps {
    phone: string;
    onRemove: (phone: string) => void;
}

export default function PhoneChip({ phone, onRemove }: PhoneChipProps) {
    // Format phone for display
    const displayPhone = phone.length > 10
        ? `+${phone.slice(0, -10)} ${phone.slice(-10, -7)} ${phone.slice(-7, -4)} ${phone.slice(-4)}`
        : phone;

    return (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full group hover:border-zinc-600 transition-colors">
            <span className="text-sm text-zinc-300">{displayPhone}</span>
            <button
                onClick={() => onRemove(phone)}
                className="p-1 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Remove number"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
