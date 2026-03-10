'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Building2,
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Check,
    RefreshCw,
    MapPin,
    Calendar,
    ImageIcon,
    Upload,
    Eye,
    Download,
    Phone,
    User,
    Package,
    FileText,
    Paperclip,
} from 'lucide-react';
import * as db from '@/lib/db-supabase';
import { uploadClientAttachment, deleteAttachment } from '@/lib/storage';
import { formatDisplayDate } from '@/lib/utils';
import DOViewerModal from '@/components/DOViewerModal';
import type { Client } from '@/types';

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Client> } | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [viewClient, setViewClient] = useState<Client | null>(null);
    const [viewAttachment, setViewAttachment] = useState<{ url: string; filename: string } | null>(null);

    useEffect(() => { loadClients(); }, []);

    async function loadClients() {
        setLoading(true);
        try {
            const data = await db.getAllClients();
            setClients(data);
        } catch {
            // non-critical
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        if (!search.trim()) return clients;
        const q = search.toLowerCase();
        return clients.filter(c =>
            c.company_name.toLowerCase().includes(q) ||
            (c.contact_person?.toLowerCase().includes(q)) ||
            (c.phone?.toLowerCase().includes(q)) ||
            (c.item_type?.toLowerCase().includes(q)) ||
            c.delivery_locations.some(l => l.toLowerCase().includes(q)) ||
            (c.notes?.toLowerCase().includes(q))
        );
    }, [clients, search]);

    async function handleSave(data: Partial<Client>) {
        setSaving(true);
        try {
            if (modal?.mode === 'add') {
                const created = await db.addClient(data);
                setClients(prev => [...prev, created].sort((a, b) => a.company_name.localeCompare(b.company_name)));
            } else if (modal?.mode === 'edit' && data.id) {
                await db.updateClient(data.id, data);
                setClients(prev => prev.map(c => c.id === data.id ? { ...c, ...data } as Client : c));
            }
            setModal(null);
        } catch {
            // error handled silently
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            await db.deleteClient(id);
            setClients(prev => prev.filter(c => c.id !== id));
        } catch {
            // error handled silently
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    }

    function openAttachment(url: string) {
        const parts = url.split('/');
        const filename = parts[parts.length - 1] || 'attachment';
        setViewAttachment({ url, filename });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-1.5">Reference</p>
                <h1 className="text-3xl font-bold text-white tracking-tight">Clients</h1>
                <p className="text-zinc-500 mt-1 text-sm">
                    Client directory with delivery locations for quick reference when creating orders
                </p>
            </div>

            {/* Search + Add */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 placeholder:text-zinc-600"
                    />
                </div>
                <button
                    onClick={() => setModal({ mode: 'add', data: { delivery_locations: [] } })}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-sm shadow-emerald-900/50"
                >
                    <Plus className="w-4 h-4" /> Add Client
                </button>
            </div>

            {/* Client Cards */}
            <div>
                {filtered.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Building2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500">{clients.length === 0 ? 'No clients yet.' : 'No matching clients.'}</p>
                        {clients.length === 0 && (
                            <p className="text-zinc-600 text-xs mt-1">Add your first client to keep track of their delivery locations.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((client, i) => (
                            <div
                                key={client.id}
                                onClick={() => setViewClient(client)}
                                className="card px-4 py-3 cursor-pointer hover:bg-zinc-800/60 transition-colors border-l-[3px] border-l-emerald-500/50 group"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Number */}
                                    <span className="text-[10px] text-zinc-600 font-mono w-5 shrink-0">{i + 1}</span>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-zinc-200 truncate">{client.company_name}</span>
                                            {client.item_type && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded shrink-0">
                                                    {client.item_type}
                                                </span>
                                            )}
                                            {(client.attachment_urls || []).length > 0 && (
                                                <Paperclip className="w-3 h-3 text-zinc-500 shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                            {client.contact_person && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {client.contact_person}
                                                </span>
                                            )}
                                            {client.phone && (
                                                <span className="flex items-center gap-1 font-mono">
                                                    <Phone className="w-3 h-3" />
                                                    {client.phone}
                                                </span>
                                            )}
                                            {client.date && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDisplayDate(client.date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delivery locations count */}
                                    {client.delivery_locations.length > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/70 shrink-0">
                                            <MapPin className="w-3 h-3" />
                                            {client.delivery_locations.length}
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        {confirmDeleteId === client.id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleDelete(client.id)}
                                                    disabled={deletingId === client.id}
                                                    className="px-2 py-1 text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md hover:bg-rose-500/25 transition-colors"
                                                >
                                                    {deletingId === client.id ? '...' : 'Delete'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="px-2 py-1 text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setModal({ mode: 'edit', data: { ...client } })}
                                                    className="p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(client.id)}
                                                    className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* View Client Detail Modal */}
            {viewClient && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 modal-backdrop backdrop-blur-sm" onClick={() => setViewClient(null)} />
                    <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-fadeIn">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-white truncate">{viewClient.company_name}</h3>
                                {viewClient.item_type && (
                                    <span className="text-xs text-zinc-500">{viewClient.item_type}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => { setViewClient(null); setModal({ mode: 'edit', data: { ...viewClient } }); }}
                                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setViewClient(null)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Contact & Phone */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Contact Person</label>
                                    <p className="text-sm text-zinc-300 mt-0.5">{viewClient.contact_person || <span className="text-zinc-600">—</span>}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Phone</label>
                                    <p className="text-sm text-zinc-300 mt-0.5 font-mono">{viewClient.phone || <span className="text-zinc-600">—</span>}</p>
                                </div>
                            </div>

                            {/* Date */}
                            {viewClient.date && (
                                <div>
                                    <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Date</label>
                                    <p className="text-sm text-zinc-300 mt-0.5 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                        {formatDisplayDate(viewClient.date)}
                                    </p>
                                </div>
                            )}

                            {/* Delivery Locations */}
                            <div>
                                <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Delivery Locations</label>
                                {viewClient.delivery_locations.length === 0 ? (
                                    <p className="text-sm text-zinc-600 mt-1">—</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {viewClient.delivery_locations.map((loc, j) => (
                                            <span key={j} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                                                <MapPin className="w-2.5 h-2.5" />
                                                {loc}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Attachment */}
                            {(viewClient.attachment_urls || []).length > 0 && (
                                <div>
                                    <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Attachment</label>
                                    <div className="mt-1.5 space-y-2">
                                        {(viewClient.attachment_urls || []).map((url, j) => (
                                            <div key={j} className="flex items-center gap-3 p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                                                <img src={url} alt="Attachment" className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openAttachment(url)} />
                                                <div className="flex-1 min-w-0">
                                                    <button
                                                        onClick={() => openAttachment(url)}
                                                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                                                    >
                                                        View image
                                                    </button>
                                                </div>
                                                <a href={url} download target="_blank" rel="noopener noreferrer" className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors" title="Download">
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {viewClient.notes && (
                                <div>
                                    <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Notes</label>
                                    <p className="text-sm text-zinc-400 mt-0.5 whitespace-pre-wrap">{viewClient.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit/Add Client Modal */}
            {modal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 modal-backdrop backdrop-blur-sm" onClick={() => setModal(null)} />
                    {/* Modal card */}
                    <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-fadeIn">
                        {/* Sticky header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
                            <h3 className="text-lg font-semibold text-white">
                                {modal.mode === 'add' ? 'Add Client' : 'Edit Client'}
                            </h3>
                            <button onClick={() => setModal(null)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Scrollable body */}
                        <div className="p-6 overflow-y-auto">
                            <ClientForm
                                initial={modal.data}
                                saving={saving}
                                onSave={handleSave}
                                onCancel={() => setModal(null)}
                                onViewAttachment={openAttachment}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Attachment Viewer Modal */}
            {viewAttachment && (
                <DOViewerModal
                    url={viewAttachment.url}
                    filename={viewAttachment.filename}
                    onClose={() => setViewAttachment(null)}
                />
            )}
        </div>
    );
}

// ── Client Form ──────────────────────────────────────────────────────────────

function ClientForm({ initial, saving, onSave, onCancel, onViewAttachment }: {
    initial: Partial<Client>;
    saving: boolean;
    onSave: (data: Partial<Client>) => void;
    onCancel: () => void;
    onViewAttachment: (url: string) => void;
}) {
    const [data, setData] = useState<Partial<Client>>({
        ...initial,
        delivery_locations: initial.delivery_locations || [],
        attachment_urls: initial.attachment_urls || [],
    });
    const [error, setError] = useState('');
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    function set(key: keyof Client, value: any) {
        setData(prev => ({ ...prev, [key]: value }));
        if (error) setError('');
    }

    function addLocation() {
        setData(prev => ({
            ...prev,
            delivery_locations: [...(prev.delivery_locations || []), ''],
        }));
    }

    function updateLocation(index: number, value: string) {
        setData(prev => {
            const locs = [...(prev.delivery_locations || [])];
            locs[index] = value;
            return { ...prev, delivery_locations: locs };
        });
    }

    function removeLocation(index: number) {
        setData(prev => ({
            ...prev,
            delivery_locations: (prev.delivery_locations || []).filter((_, i) => i !== index),
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!data.company_name?.trim()) {
            setError('Company name is required');
            return;
        }
        const cleanedLocations = (data.delivery_locations || []).filter(l => l.trim());
        let attachmentUrls = [...(data.attachment_urls || [])];

        if (stagedFile) {
            setUploading(true);
            const clientId = data.id || 'temp-' + Date.now();
            const result = await uploadClientAttachment(clientId, stagedFile);
            setUploading(false);
            if (result.success && result.url) {
                attachmentUrls.push(result.url);
            } else {
                setError(result.error || 'Upload failed');
                return;
            }
        }

        onSave({ ...data, delivery_locations: cleanedLocations, attachment_urls: attachmentUrls });
    }

    async function handleRemoveAttachment(url: string) {
        await deleteAttachment(url);
        setData(prev => ({
            ...prev,
            attachment_urls: (prev.attachment_urls || []).filter(u => u !== url),
        }));
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company Name */}
            <div>
                <label className="text-xs font-medium text-zinc-300">
                    Company Name <span className="text-rose-400">*</span>
                </label>
                <input
                    type="text"
                    value={data.company_name || ''}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="e.g. ABC Logistics Sdn Bhd"
                    className={`w-full mt-1 px-3 py-2 bg-zinc-800 border rounded-lg text-zinc-200 text-sm focus:outline-none focus:ring-1 transition-colors ${error ? 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/30' : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/30'}`}
                />
                {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
            </div>

            {/* Contact + Phone */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-zinc-300">Contact Person</label>
                    <input
                        type="text"
                        value={data.contact_person || ''}
                        onChange={e => set('contact_person', e.target.value)}
                        placeholder="e.g. Ahmad"
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-zinc-300">Phone</label>
                    <input
                        type="tel"
                        value={data.phone || ''}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="e.g. 60123456789"
                        className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                </div>
            </div>

            {/* Item Type */}
            <div>
                <label className="text-xs font-medium text-zinc-300">Item Type</label>
                <input
                    type="text"
                    value={data.item_type || ''}
                    onChange={e => set('item_type', e.target.value)}
                    placeholder="e.g. Frozen goods, Dry goods, Electronics"
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
            </div>

            {/* Delivery Locations */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300">Delivery Locations</label>
                    <button
                        type="button"
                        onClick={addLocation}
                        className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Add Location
                    </button>
                </div>
                {(data.delivery_locations || []).length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No locations added. Click &quot;Add Location&quot; above.</p>
                ) : (
                    <div className="space-y-2">
                        {(data.delivery_locations || []).map((loc, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <input
                                    type="text"
                                    value={loc}
                                    onChange={e => updateLocation(i, e.target.value)}
                                    placeholder={`Location ${i + 1}`}
                                    className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                                    autoFocus={loc === ''}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeLocation(i)}
                                    className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Date */}
            <div>
                <label className="text-xs font-medium text-zinc-300">Date</label>
                <input
                    type="date"
                    value={data.date || ''}
                    onChange={e => set('date', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
            </div>

            {/* Attachment */}
            <div>
                <label className="text-xs font-medium text-zinc-300">Image Attachment</label>
                {/* Existing attachments */}
                {(data.attachment_urls || []).length > 0 && (
                    <div className="mt-2 space-y-2">
                        {(data.attachment_urls || []).map((url, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                                <img
                                    src={url}
                                    alt="Attachment"
                                    className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => onViewAttachment(url)}
                                />
                                <button
                                    type="button"
                                    onClick={() => onViewAttachment(url)}
                                    className="text-xs text-emerald-400 hover:text-emerald-300 truncate flex-1 text-left transition-colors"
                                >
                                    View image
                                </button>
                                <button type="button" onClick={() => handleRemoveAttachment(url)} className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {/* Stage new file */}
                {stagedFile ? (
                    <div className="mt-2 flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                        <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs text-emerald-300 truncate flex-1">{stagedFile.name}</span>
                        <button type="button" onClick={() => setStagedFile(null)} className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <label className="mt-2 flex items-center gap-2 p-3 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors">
                        <Upload className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-500">Click to upload image (JPG, PNG, WebP — max 10MB)</span>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={e => { if (e.target.files?.[0]) setStagedFile(e.target.files[0]); }}
                        />
                    </label>
                )}
            </div>

            {/* Notes */}
            <div>
                <label className="text-xs font-medium text-zinc-300">Notes</label>
                <textarea
                    value={data.notes || ''}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 resize-none"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800 mt-2">
                <button
                    type="submit"
                    disabled={saving || uploading}
                    className="btn-primary flex items-center gap-2 flex-1"
                    style={{ backgroundColor: (saving || uploading) ? undefined : 'rgb(5 150 105)' }}
                >
                    {(saving || uploading) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Client'}
                </button>
                <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            </div>
        </form>
    );
}
