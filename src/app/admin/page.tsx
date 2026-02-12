'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDistributionMessage } from '@/lib/distribution';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/utils';
import * as db from '@/lib/db';
import PhoneChip from '@/components/PhoneChip';
import Modal from '@/components/Modal';
import SchemaBuilder from '@/components/SchemaBuilder';
import type { TableSchema } from '@/types';
import {
    Settings,
    Phone,
    Plus,
    Send,
    Copy,
    ExternalLink,
    Check,
    AlertCircle,
    CheckCircle2,
    MessageSquare,
    Database,
    Edit,
    FileText,
} from 'lucide-react';

export default function AdminPage() {
    const { config, cache, dispatch, addLog } = useApp();
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [copied, setCopied] = useState(false);
    const [schemas, setSchemas] = useState<{ orders?: TableSchema; drivers?: TableSchema }>({});
    const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);
    const [editingSchemaType, setEditingSchemaType] = useState<'orders' | 'drivers' | null>(null);

    useEffect(() => {
        loadSchemas();
    }, []);

    async function loadSchemas() {
        try {
            const ordersSchema = await db.getSchema('orders');
            const driversSchema = await db.getSchema('drivers');
            setSchemas({
                orders: ordersSchema || undefined,
                drivers: driversSchema || undefined,
            });
        } catch (error: any) {
            addLog('error', 'Failed to load schemas', error.message);
        }
    }

    async function handleSaveSchema(schema: TableSchema) {
        try {
            await db.saveSchema(schema.type, schema);
            addLog('success', `Saved ${schema.type} schema`);
            await loadSchemas();
            setShowSchemaBuilder(false);
            setEditingSchemaType(null);
        } catch (error: any) {
            addLog('error', 'Failed to save schema', error.message);
        }
    }

    function handleEditSchema(type: 'orders' | 'drivers') {
        setEditingSchemaType(type);
        setShowSchemaBuilder(true);
    }

    const handleAddPhone = () => {
        const cleaned = formatPhoneNumber(phoneInput);

        if (!validatePhoneNumber(cleaned)) {
            setPhoneError('Please enter a valid phone number (10-15 digits)');
            return;
        }

        if (config.adminNumbers.includes(cleaned)) {
            setPhoneError('This number is already added');
            return;
        }

        dispatch({
            type: 'SET_ADMIN_NUMBERS',
            payload: [...config.adminNumbers, cleaned],
        });

        addLog('info', `Added admin number: ${cleaned}`);
        setPhoneInput('');
        setPhoneError(null);
    };

    const handleRemovePhone = (phone: string) => {
        dispatch({
            type: 'SET_ADMIN_NUMBERS',
            payload: config.adminNumbers.filter((p) => p !== phone),
        });
        addLog('info', `Removed admin number: ${phone}`);
    };

    const getDistributionMessage = () => {
        if (!cache.lastDistribution) return '';
        return formatDistributionMessage(cache.lastDistribution);
    };

    const handleCopyMessage = async () => {
        const message = getDistributionMessage();
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            addLog('success', 'Distribution report copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addLog('error', 'Failed to copy to clipboard');
        }
    };

    const handleShareWhatsApp = (phone?: string) => {
        const message = encodeURIComponent(getDistributionMessage());
        const url = phone
            ? `https://wa.me/${phone}?text=${message}`
            : `https://wa.me/?text=${message}`;
        window.open(url, '_blank');
        addLog('info', phone ? `Opened WhatsApp for ${phone}` : 'Opened WhatsApp share');
    };

    const canSend = cache.lastDistribution && config.adminNumbers.length > 0;

    // Requirements check
    const requirements = [
        {
            label: 'Distribution calculated',
            met: !!cache.lastDistribution,
        },
        {
            label: 'Admin numbers added',
            met: config.adminNumbers.length > 0,
        },
    ];

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
                <p className="text-zinc-500 mt-1">
                    Manage database schemas, admin phone numbers, and distribution notifications
                </p>
            </div>

            {/* Database Schemas */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    Database Schemas
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                    Configure the structure and fields for your orders and drivers databases
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Orders Schema */}
                    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Orders Schema
                                </h3>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {schemas.orders ? 'Configured' : 'Not configured'}
                                </p>
                            </div>
                            {schemas.orders ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-zinc-500" />
                            )}
                        </div>

                        {schemas.orders ? (
                            <div className="space-y-2 mb-3">
                                <div className="text-xs text-zinc-400">
                                    <span className="font-medium">Fields:</span>{' '}
                                    {schemas.orders.fields.length}
                                </div>
                                <div className="text-xs text-zinc-400">
                                    <span className="font-medium">Unit:</span>{' '}
                                    {schemas.orders.unitName || 'pallets'}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {schemas.orders.fields.slice(0, 4).map((field) => (
                                        <span
                                            key={field.id}
                                            className="px-2 py-0.5 bg-zinc-700/50 text-zinc-300 rounded text-xs"
                                        >
                                            {field.label}
                                        </span>
                                    ))}
                                    {schemas.orders.fields.length > 4 && (
                                        <span className="px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded text-xs">
                                            +{schemas.orders.fields.length - 4} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-500 mb-3">
                                Schema not configured yet. Create your first orders database to set it up.
                            </p>
                        )}

                        <button
                            onClick={() => handleEditSchema('orders')}
                            disabled={!schemas.orders}
                            className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            {schemas.orders ? 'Edit Schema' : 'Not Available'}
                        </button>
                    </div>

                    {/* Drivers Schema */}
                    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    Drivers Schema
                                </h3>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {schemas.drivers ? 'Configured' : 'Not configured'}
                                </p>
                            </div>
                            {schemas.drivers ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-zinc-500" />
                            )}
                        </div>

                        {schemas.drivers ? (
                            <div className="space-y-2 mb-3">
                                <div className="text-xs text-zinc-400">
                                    <span className="font-medium">Fields:</span>{' '}
                                    {schemas.drivers.fields.length}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {schemas.drivers.fields.slice(0, 4).map((field) => (
                                        <span
                                            key={field.id}
                                            className="px-2 py-0.5 bg-zinc-700/50 text-zinc-300 rounded text-xs"
                                        >
                                            {field.label}
                                        </span>
                                    ))}
                                    {schemas.drivers.fields.length > 4 && (
                                        <span className="px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded text-xs">
                                            +{schemas.drivers.fields.length - 4} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-500 mb-3">
                                Schema not configured yet. Create your first drivers database to set it up.
                            </p>
                        )}

                        <button
                            onClick={() => handleEditSchema('drivers')}
                            disabled={!schemas.drivers}
                            className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
                        >
                            <Edit className="w-4 h-4" />
                            {schemas.drivers ? 'Edit Schema' : 'Not Available'}
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-400">
                        <strong>Note:</strong> Schemas are created when you make your first database of each
                        type. Go to Database Manager to create and configure your schemas.
                    </p>
                </div>
            </div>

            {/* Phone Numbers */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-400" />
                    Admin Phone Numbers
                </h2>

                {/* Add Phone Input */}
                <div className="flex gap-3 mb-4">
                    <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => {
                            setPhoneInput(e.target.value);
                            setPhoneError(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPhone()}
                        placeholder="e.g., 60123456789 (include country code)"
                        className="input flex-1"
                    />
                    <button
                        onClick={handleAddPhone}
                        disabled={!phoneInput.trim()}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add
                    </button>
                </div>

                {phoneError && (
                    <p className="text-sm text-rose-400 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {phoneError}
                    </p>
                )}

                {/* Phone Chips */}
                {config.adminNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {config.adminNumbers.map((phone) => (
                            <PhoneChip key={phone} phone={phone} onRemove={handleRemovePhone} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500">No admin numbers added yet</p>
                )}
            </div>

            {/* Requirements */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Requirements</h2>
                <div className="space-y-3">
                    {requirements.map((req) => (
                        <div key={req.label} className="flex items-center gap-3">
                            {req.met ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-zinc-500" />
                            )}
                            <span className={req.met ? 'text-zinc-200' : 'text-zinc-500'}>
                                {req.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Send Notification */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    Send Notification
                </h2>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        disabled={!cache.lastDistribution}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <MessageSquare className="w-5 h-5" />
                        Preview Message
                    </button>

                    <button
                        onClick={handleCopyMessage}
                        disabled={!cache.lastDistribution}
                        className="btn-secondary flex items-center gap-2"
                    >
                        {copied ? (
                            <>
                                <Check className="w-5 h-5 text-emerald-400" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5" />
                                Copy to Clipboard
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => handleShareWhatsApp()}
                        disabled={!cache.lastDistribution}
                        className="btn-primary flex items-center gap-2"
                    >
                        <ExternalLink className="w-5 h-5" />
                        Open WhatsApp
                    </button>
                </div>

                {/* Quick Send to Specific Numbers */}
                {canSend && (
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">
                            Send directly to admin numbers:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {config.adminNumbers.map((phone) => (
                                <button
                                    key={phone}
                                    onClick={() => handleShareWhatsApp(phone)}
                                    className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    {phone}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Message Preview Modal */}
            <Modal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                title="Message Preview"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="btn-secondary"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                handleCopyMessage();
                                setShowPreview(false);
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Copy className="w-5 h-5" />
                            Copy Message
                        </button>
                    </>
                }
            >
                <pre className="bg-zinc-800 p-4 rounded-xl text-sm text-zinc-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                    {getDistributionMessage() || 'No distribution available'}
                </pre>
            </Modal>

            {/* Schema Builder Modal */}
            {showSchemaBuilder && editingSchemaType && (
                <SchemaBuilder
                    type={editingSchemaType}
                    onSave={handleSaveSchema}
                    onCancel={() => {
                        setShowSchemaBuilder(false);
                        setEditingSchemaType(null);
                    }}
                    initialSchema={schemas[editingSchemaType]}
                />
            )}
        </div>
    );
}
