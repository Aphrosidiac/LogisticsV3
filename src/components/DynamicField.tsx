'use client';

import type { FieldSchema } from '@/types';

interface DynamicFieldProps {
    field: FieldSchema;
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
}

export default function DynamicField({ field, value, onChange, disabled }: DynamicFieldProps) {
    const commonClasses = 'w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed';

    switch (field.type) {
        case 'text':
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={field.label}
                    className={commonClasses}
                />
            );

        case 'number':
            return (
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
                    disabled={disabled}
                    placeholder={field.label}
                    className={commonClasses}
                    step="any"
                />
            );

        case 'date':
            return (
                <input
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={commonClasses}
                />
            );

        case 'dropdown':
            return (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={commonClasses}
                >
                    <option value="">Select {field.label}</option>
                    {field.options?.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            );

        case 'checkbox':
            return (
                <input
                    type="checkbox"
                    checked={value || false}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50"
                />
            );

        default:
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={commonClasses}
                />
            );
    }
}
