'use client';

import type { FieldSchema } from '@/types';
import { useApp } from '@/context/AppContext';
import ZoneDistrictSelector from './ZoneDistrictSelector';

interface DynamicFieldProps {
    field: FieldSchema;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (value: any) => void;
    disabled?: boolean;
}

export default function DynamicField({ field, value, onChange, disabled }: DynamicFieldProps) {
    const { cache } = useApp();
    const commonClasses = 'w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed';

    // Special handling for zone field - use ZoneDistrictSelector
    const isZoneField = field.name?.toLowerCase() === 'zone' ||
        field.id?.toLowerCase() === 'zone' ||
        field.label?.toLowerCase() === 'zone';

    if (isZoneField) {
        // Parse the stored JSON string back to an object for the selector
        let parsedValue = value;
        if (typeof value === 'string' && value) {
            try {
                parsedValue = JSON.parse(value);
            } catch {
                parsedValue = value;
            }
        }

        return (
            <ZoneDistrictSelector
                value={parsedValue}
                onChange={(zoneData) => {
                    if (!zoneData) {
                        onChange('');
                        return;
                    }
                    // Look up zone and district names for display
                    const zones = cache.zones || [];
                    const zone = zones.find(z => z.id === zoneData.zone_id);
                    const district = zone?.districts?.find((d: { id: string; name?: string }) => d.id === zoneData.district_id);
                    // Store as JSON string with both IDs and names
                    onChange(JSON.stringify({
                        zone_id: zoneData.zone_id,
                        district_id: zoneData.district_id,
                        zone_name: zone?.name || '',
                        district_name: district?.name || '',
                    }));
                }}
                zones={cache.zones || []}
                required={field.required}
                disabled={disabled}
                className="min-w-[300px]"
            />
        );
    }

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

        case 'file':
        case 'image': {
            // Display uploaded files as links
            if (Array.isArray(value) && value.length > 0) {
                return (
                    <div className="space-y-1">
                        {value.map((url: string, index: number) => {
                            const fileName = url.split('/').pop() || `file-${index + 1}`;
                            return (
                                <a
                                    key={index}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-sm text-blue-400 hover:text-blue-300 underline truncate"
                                >
                                    {fileName}
                                </a>
                            );
                        })}
                    </div>
                );
            }
            return (
                <span className="text-xs text-zinc-500">No files uploaded</span>
            );
        }

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
