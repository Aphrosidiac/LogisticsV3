'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import type { FieldSchema, FieldType, TableSchema } from '@/types';
import { generateId } from '@/lib/utils';

interface SchemaBuilderProps {
    type: 'orders' | 'drivers';
    onSave: (schema: TableSchema) => void;
    onCancel: () => void;
    initialSchema?: TableSchema;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'file', label: 'File Upload' },
    { value: 'image', label: 'Image Upload' },
];

// Default required fields
const DEFAULT_ORDER_FIELDS: FieldSchema[] = [
    {
        id: 'zone',
        name: 'zone',
        label: 'Zone',
        type: 'text',
        required: true,
        isCoreField: true,
    },
    {
        id: 'date',
        name: 'date',
        label: 'Delivery Date',
        type: 'date',
        required: true,
        isCoreField: true,
    },
    {
        id: 'priority',
        name: 'priority',
        label: 'Priority',
        type: 'dropdown',
        required: false,
        isCoreField: false,
        options: ['high', 'standard'],
        defaultValue: 'standard',
    },
];

const DEFAULT_DRIVER_FIELDS: FieldSchema[] = [
    {
        id: 'name',
        name: 'name',
        label: 'Driver Name',
        type: 'text',
        required: true,
        isCoreField: true,
    },
    {
        id: 'identifier',
        name: 'identifier',
        label: 'Identifier',
        type: 'text',
        required: true,
        isCoreField: true,
    },
    {
        id: 'home_region',
        name: 'home_region',
        label: 'Home Region',
        type: 'text',
        required: false,
        isCoreField: false,
    },
    {
        id: 'max_capacity',
        name: 'max_capacity',
        label: 'Max Capacity (Pallets)',
        type: 'number',
        required: false,
        isCoreField: false,
        defaultValue: 11,
    },
];

export default function SchemaBuilder({ type, onSave, onCancel, initialSchema }: SchemaBuilderProps) {
    const defaultFields = type === 'orders' ? DEFAULT_ORDER_FIELDS : DEFAULT_DRIVER_FIELDS;

    const [name, setName] = useState(initialSchema?.name || '');
    const [fields, setFields] = useState<FieldSchema[]>(
        initialSchema?.fields || [
            ...defaultFields,
            // Add a default unit field for orders
            ...(type === 'orders'
                ? [{
                      id: 'quantity',
                      name: 'quantity',
                      label: 'Quantity',
                      type: 'number' as FieldType,
                      required: true,
                      isUnitField: true,
                  }]
                : []),
        ]
    );
    const [unitName, setUnitName] = useState(initialSchema?.unitName || 'pallets');
    const [dropdownOptions, setDropdownOptions] = useState<Record<string, string>>({});

    const addField = () => {
        const newField: FieldSchema = {
            id: generateId(),
            name: '',
            label: '',
            type: 'text',
            required: false,
        };
        setFields([...fields, newField]);
    };

    const updateField = (id: string, updates: Partial<FieldSchema>) => {
        setFields(fields.map(field => (field.id === id ? { ...field, ...updates } : field)));
    };

    const deleteField = (id: string) => {
        setFields(fields.filter(field => field.id !== id));
    };

    const setUnitField = (id: string) => {
        setFields(
            fields.map(field => ({
                ...field,
                isUnitField: field.id === id,
            }))
        );
    };

    const handleSave = () => {
        // Validation
        if (!name.trim()) {
            alert('Please enter a table name');
            return;
        }

        for (const field of fields) {
            if (!field.name.trim() || !field.label.trim()) {
                alert('All fields must have a name and label');
                return;
            }
            if (field.type === 'dropdown' && (!field.options || field.options.length === 0)) {
                alert(`Dropdown field "${field.label}" must have at least one option`);
                return;
            }
        }

        if (type === 'orders') {
            const hasUnitField = fields.some(f => f.isUnitField);
            if (!hasUnitField) {
                alert('Orders must have a unit field for distribution calculation');
                return;
            }
        }

        const schema: TableSchema = {
            id: initialSchema?.id || generateId(),
            name: name.trim(),
            type,
            fields,
            unitFieldId: fields.find(f => f.isUnitField)?.id,
            unitName: type === 'orders' ? unitName : undefined,
            createdAt: initialSchema?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        onSave(schema);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-zinc-800 shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-zinc-800 p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Configure {type === 'orders' ? 'Orders' : 'Drivers'} Table
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        Define the fields and structure for your {type} database
                    </p>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Table Name */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Table Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`e.g., "Orders ${new Date().getFullYear()}" or "Delivery Drivers"`}
                            className="input w-full"
                        />
                    </div>

                    {/* Unit Name (Orders only) */}
                    {type === 'orders' && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Unit Name (for distribution) *
                            </label>
                            <input
                                type="text"
                                value={unitName}
                                onChange={(e) => setUnitName(e.target.value)}
                                placeholder='e.g., "pallets", "boxes", "kg", "tons"'
                                className="input w-full"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                This will be used in distribution reports (e.g., "50 pallets")
                            </p>
                        </div>
                    )}

                    {/* Fields */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-sm font-medium text-zinc-300">
                                Fields *
                            </label>
                            <button
                                onClick={addField}
                                className="btn-secondary flex items-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Field
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="bg-zinc-800/70 border border-zinc-700 rounded-lg p-3 hover:border-zinc-600 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        {!field.isCoreField && (
                                            <GripVertical className="w-4 h-4 text-zinc-600 mt-2 flex-shrink-0" />
                                        )}

                                        <div className="flex-1 space-y-2.5">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                {/* Field Name */}
                                                <div>
                                                    <label className="block text-xs text-zinc-400 mb-1">
                                                        Field Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={field.name}
                                                        onChange={(e) =>
                                                            updateField(field.id, {
                                                                name: e.target.value
                                                                    .toLowerCase()
                                                                    .replace(/\s+/g, '_'),
                                                            })
                                                        }
                                                        placeholder="zone, customer"
                                                        disabled={field.isCoreField}
                                                        className="input w-full text-sm"
                                                    />
                                                </div>

                                                {/* Label */}
                                                <div>
                                                    <label className="block text-xs text-zinc-400 mb-1">
                                                        Display Label *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) =>
                                                            updateField(field.id, { label: e.target.value })
                                                        }
                                                        placeholder="Zone, Customer"
                                                        disabled={field.isCoreField}
                                                        className="input w-full text-sm"
                                                    />
                                                </div>

                                                {/* Type */}
                                                <div>
                                                    <label className="block text-xs text-zinc-400 mb-1">
                                                        Type *
                                                    </label>
                                                    <select
                                                        value={field.type}
                                                        onChange={(e) =>
                                                            updateField(field.id, {
                                                                type: e.target.value as FieldType,
                                                            })
                                                        }
                                                        className="input w-full text-sm"
                                                    >
                                                        {FIELD_TYPES.map((type) => (
                                                            <option key={type.value} value={type.value}>
                                                                {type.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Dropdown Options */}
                                            {field.type === 'dropdown' && (
                                                <div>
                                                    <label className="block text-xs text-zinc-400 mb-1">
                                                        Options (comma-separated) *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={field.options?.join(', ') || ''}
                                                        onChange={(e) => {
                                                            const options = e.target.value
                                                                .split(',')
                                                                .map((o) => o.trim())
                                                                .filter(Boolean);
                                                            updateField(field.id, { options });
                                                        }}
                                                        placeholder="High, Medium, Low"
                                                        className="input w-full text-sm"
                                                    />
                                                </div>
                                            )}

                                            {/* Checkboxes */}
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required}
                                                        onChange={(e) =>
                                                            updateField(field.id, { required: e.target.checked })
                                                        }
                                                        disabled={field.isCoreField}
                                                        className="rounded"
                                                    />
                                                    <span className="text-zinc-400">Required</span>
                                                </label>

                                                {type === 'orders' && field.type === 'number' && (
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            checked={field.isUnitField}
                                                            onChange={() => setUnitField(field.id)}
                                                            name="unitField"
                                                            className="rounded-full"
                                                        />
                                                        <span className="text-emerald-400 font-medium">
                                                            Unit Field (for distribution)
                                                        </span>
                                                    </label>
                                                )}

                                                {field.isCoreField && (
                                                    <span className="text-xs text-blue-400 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Core Field (required for distribution)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {!field.isCoreField && (
                                            <button
                                                onClick={() => deleteField(field.id)}
                                                className="text-rose-400 hover:text-rose-300 p-2 mt-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-sm text-blue-400">
                            <strong>Tip:</strong> Core fields (like Zone and Driver Name) cannot be removed as
                            they're required for distribution calculation. You can add any custom fields you
                            need for your workflow.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-zinc-800 p-6 flex gap-3 justify-end bg-zinc-900/95 backdrop-blur">
                    <button onClick={onCancel} className="btn-secondary px-6">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary px-6">
                        {initialSchema ? 'Update Schema' : 'Create Table'}
                    </button>
                </div>
            </div>
        </div>
    );
}
