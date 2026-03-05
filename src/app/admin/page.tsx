'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { formatDistributionMessage, formatDriverAssignmentMessage } from '@/lib/distribution';
import { formatPhoneNumber, validatePhoneNumber, formatDisplayDate } from '@/lib/utils';
import * as db from '@/lib/db-supabase';
import { useWhatsAppSender } from '@/hooks/useWhatsAppSender';
import { useMarkDelivered } from '@/hooks/useMarkDelivered';
import {
    Phone,
    Plus,
    Send,
    CheckCircle2,
    AlertCircle,
    Loader,
    WifiOff,
    Users,
    Megaphone,
    Pencil,
    X,
    Check,
    MessageSquare,
    ChevronRight,
    Clock,
    PackageCheck,
    RefreshCw,
} from 'lucide-react';

export default function AdminPage() {
    const { config, cache, dispatch, addLog, saveAdminNumbers, isLoading } = useApp();

    // WhatsApp sender hook
    const wa = useWhatsAppSender(addLog);

    // Mark delivered hook
    const { deliveredDrivers, markingDriverId, markDelivered } = useMarkDelivered(addLog);

    // Driver phone numbers (keyed by driver id)
    const [driverPhones, setDriverPhones] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editError, setEditError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Admin numbers management
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);

    // Distribution schedule
    const [distributionTime, setDistributionTime] = useState(config.distributionTime || '20:00');
    const [autoRecipients, setAutoRecipients] = useState<'admins' | 'drivers' | 'both'>(config.autoMessageRecipients || 'drivers');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [scheduleSaved, setScheduleSaved] = useState(false);

    // Holding orders count
    const [holdingCount, setHoldingCount] = useState(0);

    const assignments = cache.lastDistribution?.assignments || [];

    useEffect(() => {
        wa.checkStatus();
        loadDriverPhones();
        db.getHoldingOrders().then(h => setHoldingCount(h.length)).catch(() => {});
    }, []);

    useEffect(() => {
        if (config.distributionTime) setDistributionTime(config.distributionTime);
        if (config.autoMessageRecipients) setAutoRecipients(config.autoMessageRecipients);
    }, [config.distributionTime, config.autoMessageRecipients]);

    async function loadDriverPhones() {
        try {
            const drivers = await db.getAllDrivers();
            const phones: Record<string, string> = {};
            for (const d of drivers) {
                if (d.phone) phones[d.id] = d.phone;
            }
            setDriverPhones(phones);
        } catch {
            // non-critical
        }
    }

    // ── Driver phone editing ────────────────────────────────────────────────

    function startEdit(driverId: string) {
        setEditingId(driverId);
        setEditValue(driverPhones[driverId] || '');
        setEditError(null);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditValue('');
        setEditError(null);
    }

    async function savePhone(driverId: string) {
        const cleaned = formatPhoneNumber(editValue);
        if (!validatePhoneNumber(cleaned)) {
            setEditError('Enter a valid phone number (e.g. 60123456789)');
            return;
        }

        setSavingId(driverId);
        try {
            await db.updateDriver(driverId, { phone: cleaned });
            setDriverPhones(prev => ({ ...prev, [driverId]: cleaned }));
            setEditingId(null);
            setEditValue('');
        } catch {
            setEditError('Failed to save. Try again.');
        } finally {
            setSavingId(null);
        }
    }

    // ── Per-driver send ─────────────────────────────────────────────────────

    async function sendToDriver(driverId: string, driverName: string, phone: string, assignment: any) {
        const message = formatDriverAssignmentMessage(assignment);
        await wa.sendMessage(phone, message, driverId, `Sent assignment to ${driverName}`);
    }

    async function sendAll() {
        const eligible = assignments.filter(a => driverPhones[a.driver.id]);
        for (const assignment of eligible) {
            const phone = driverPhones[assignment.driver.id];
            const message = formatDriverAssignmentMessage(assignment);
            await wa.sendMessage(phone, message, assignment.driver.id, `Sent assignment to ${assignment.driver.name}`);
            await new Promise(r => setTimeout(r, 400));
        }
    }

    // ── Admin broadcast ─────────────────────────────────────────────────────

    async function handleBroadcast() {
        if (!cache.lastDistribution || config.adminNumbers.length === 0) return;
        const message = formatDistributionMessage(cache.lastDistribution);
        await wa.broadcast(config.adminNumbers, message);
    }

    // ── Admin number management ─────────────────────────────────────────────

    function handleAddPhone() {
        const cleaned = formatPhoneNumber(phoneInput);
        if (!validatePhoneNumber(cleaned)) {
            setPhoneError('Enter a valid phone number (10–15 digits)');
            return;
        }
        if (config.adminNumbers.includes(cleaned)) {
            setPhoneError('Number already added');
            return;
        }
        saveAdminNumbers([...config.adminNumbers, cleaned]);
        addLog('info', `Added admin number: ${cleaned}`);
        setPhoneInput('');
        setPhoneError(null);
    }

    function handleRemovePhone(phone: string) {
        saveAdminNumbers(config.adminNumbers.filter(p => p !== phone));
        addLog('info', `Removed admin number: ${phone}`);
    }

    // ── Distribution schedule ────────────────────────────────────────────────

    async function saveSchedule() {
        setIsSavingSchedule(true);
        try {
            const updatedConfig = { ...config, distributionTime, autoMessageRecipients: autoRecipients };
            await db.saveConfig(updatedConfig);
            dispatch({ type: 'SET_CONFIG', payload: updatedConfig });
            setScheduleSaved(true);
            addLog('info', `Distribution schedule set to ${distributionTime}`);
            setTimeout(() => setScheduleSaved(false), 3000);
        } catch (err: any) {
            addLog('error', 'Failed to save distribution schedule', err.message);
        } finally {
            setIsSavingSchedule(false);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    const eligibleCount = assignments.filter(a => driverPhones[a.driver.id]).length;

    function sendButtonContent(driverId: string) {
        const state = wa.sendStates[driverId];
        if (state?.status === 'sending') return <><Loader className="w-4 h-4 animate-spin" /> Sending…</>;
        if (state?.status === 'sent')    return <><Check className="w-4 h-4" /> Sent</>;
        if (state?.status === 'failed')  return <><X className="w-4 h-4" /> Failed</>;
        return <><Send className="w-4 h-4" /> Send</>;
    }

    function sendButtonClass(driverId: string) {
        const s = wa.sendStates[driverId]?.status;
        if (s === 'sent')    return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default';
        if (s === 'failed')  return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-default';
        if (s === 'sending') return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-400 cursor-wait';
        return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
                <p className="text-zinc-500 mt-1">
                    Manage driver phones and send WhatsApp assignments
                </p>
            </div>

            {/* WhatsApp status banner */}
            {wa.waChecked && !wa.waConnected && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                    <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-300">
                        WhatsApp is not connected. Go to the{' '}
                        <Link href="/whatsapp" className="underline hover:text-amber-200">
                            WhatsApp page
                        </Link>{' '}
                        to scan a QR code first.
                    </span>
                </div>
            )}

            {/* Holding orders banner */}
            {holdingCount > 0 && (
                <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                    <Clock className="w-5 h-5 text-orange-400 shrink-0" />
                    <span className="text-sm text-orange-300">
                        <strong>{holdingCount}</strong> holding order{holdingCount !== 1 ? 's' : ''} awaiting delivery details.
                    </span>
                    <Link href="/sheets-manager" className="ml-auto text-xs text-orange-400 hover:text-orange-300 underline whitespace-nowrap">
                        View in DB Manager →
                    </Link>
                </div>
            )}

            {/* ── Section 1: Driver Dispatch ── */}
            <div className="card p-6 space-y-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-400" />
                            Driver Dispatch
                        </h2>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            Send each driver their individual assignment via WhatsApp
                        </p>
                    </div>
                    {assignments.length > 0 && eligibleCount > 0 && (
                        <button
                            onClick={sendAll}
                            disabled={!wa.waConnected}
                            className="btn-primary flex items-center gap-2 text-sm shrink-0"
                        >
                            <Send className="w-4 h-4" />
                            Send All ({eligibleCount})
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-4">
                        <AlertCircle className="w-5 h-5 text-zinc-500 shrink-0" />
                        <div>
                            <p className="text-sm text-zinc-400">No distribution calculated yet.</p>
                            <Link
                                href="/distribution"
                                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-0.5"
                            >
                                Go to Distribution <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignments.map((assignment) => {
                            const driverId = assignment.driver.id;
                            const phone = driverPhones[driverId];
                            const isEditing = editingId === driverId;
                            const sendState = wa.sendStates[driverId]?.status;
                            const canSend = !!phone && wa.waConnected && sendState !== 'sending';

                            return (
                                <div
                                    key={driverId}
                                    className="border border-zinc-700 bg-zinc-800/40 rounded-xl p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        {/* Driver info */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white">{assignment.driver.name}</span>
                                                <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                    {assignment.driver.identifier}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-0.5">
                                                Zones: {assignment.zones.join(', ')} &nbsp;·&nbsp;{' '}
                                                {assignment.totalPallets} pallets · {assignment.totalOrders} orders
                                            </p>
                                        </div>

                                        {/* Phone + send */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="tel"
                                                            value={editValue}
                                                            onChange={e => { setEditValue(e.target.value); setEditError(null); }}
                                                            onKeyDown={e => { if (e.key === 'Enter') savePhone(driverId); if (e.key === 'Escape') cancelEdit(); }}
                                                            placeholder="60123456789"
                                                            className="input text-sm py-1 w-40"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => savePhone(driverId)}
                                                            disabled={savingId === driverId}
                                                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                                        >
                                                            {savingId === driverId
                                                                ? <Loader className="w-4 h-4 animate-spin" />
                                                                : <Check className="w-4 h-4" />
                                                            }
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    {editError && (
                                                        <p className="text-xs text-rose-400">{editError}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    {phone ? (
                                                        <button
                                                            onClick={() => startEdit(driverId)}
                                                            className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-700/50 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                            {phone}
                                                            <Pencil className="w-3 h-3 text-zinc-500" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEdit(driverId)}
                                                            className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-600 transition-colors"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add phone
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => sendToDriver(driverId, assignment.driver.name, phone, assignment)}
                                                        disabled={!canSend}
                                                        className={sendButtonClass(driverId)}
                                                    >
                                                        {sendButtonContent(driverId)}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Failed error message */}
                                    {wa.sendStates[driverId]?.status === 'failed' && wa.sendStates[driverId]?.error && (
                                        <p className="text-xs text-rose-400 mt-2">
                                            {wa.sendStates[driverId].error}
                                        </p>
                                    )}

                                    {/* Mark Delivered */}
                                    <div className="mt-3 pt-3 border-t border-zinc-700/50 flex justify-end">
                                        {deliveredDrivers.has(driverId) ? (
                                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                                <PackageCheck className="w-4 h-4" />
                                                Marked as Delivered
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => markDelivered(assignment, (orders) => dispatch({ type: 'SET_ORDERS', payload: orders }))}
                                                disabled={markingDriverId === driverId}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {markingDriverId === driverId
                                                    ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Marking…</>
                                                    : <><PackageCheck className="w-3.5 h-3.5" /> Mark as Delivered</>
                                                }
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Section 2: Admin Numbers ── */}
            <div className="card p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Phone className="w-5 h-5 text-zinc-400" />
                    Admin Numbers
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                    Add numbers to receive the full distribution broadcast
                </p>

                <div className="flex gap-3">
                    <input
                        type="tel"
                        value={phoneInput}
                        onChange={e => { setPhoneInput(e.target.value); setPhoneError(null); }}
                        onKeyDown={e => e.key === 'Enter' && handleAddPhone()}
                        placeholder="e.g. 60123456789 (include country code)"
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
                    <p className="text-sm text-rose-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {phoneError}
                    </p>
                )}

                {config.adminNumbers.length === 0 ? (
                    <p className="text-sm text-zinc-500">No admin numbers yet. Add one above.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {config.adminNumbers.map((phone) => (
                            <div
                                key={phone}
                                className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
                            >
                                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-zinc-200">{phone}</span>
                                <button
                                    onClick={() => handleRemovePhone(phone)}
                                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Section 3: Admin Broadcast ── */}
            <div className="card p-6 space-y-5">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-blue-400" />
                        Admin Broadcast
                    </h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        Send the full distribution report to all admin numbers
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleBroadcast}
                        disabled={
                            !cache.lastDistribution ||
                            config.adminNumbers.length === 0 ||
                            !wa.waConnected ||
                            wa.broadcastStatus === 'sending'
                        }
                        className="btn-primary flex items-center gap-2"
                    >
                        {wa.broadcastStatus === 'sending' ? (
                            <><Loader className="w-5 h-5 animate-spin" /> Sending…</>
                        ) : wa.broadcastStatus === 'sent' ? (
                            <><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Sent!</>
                        ) : (
                            <><Send className="w-5 h-5" /> Broadcast to All Admins</>
                        )}
                    </button>

                    {!cache.lastDistribution && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            No distribution calculated yet
                        </span>
                    )}
                    {config.adminNumbers.length === 0 && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Add admin numbers above first
                        </span>
                    )}
                </div>

                {wa.broadcastStatus === 'failed' && wa.broadcastError && (
                    <p className="text-sm text-rose-400 flex items-center gap-2">
                        <X className="w-4 h-4" />
                        {wa.broadcastError}
                    </p>
                )}
            </div>

            {/* ── Section 4: Distribution Schedule ── */}
            <div className="card p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-emerald-400" />
                        Distribution Schedule
                    </h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        Auto-distribute pending orders to drivers daily at a set time
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-zinc-400 shrink-0">Auto-distribute daily at:</label>
                    <input
                        type="time"
                        value={distributionTime}
                        onChange={e => setDistributionTime(e.target.value)}
                        className="input w-36"
                    />
                    <button
                        onClick={saveSchedule}
                        disabled={isSavingSchedule}
                        className="btn-primary flex items-center gap-2 text-sm"
                    >
                        {isSavingSchedule
                            ? <Loader className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />
                        }
                        {scheduleSaved ? 'Saved!' : 'Save'}
                    </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <p className="text-sm text-zinc-400 font-medium">After auto-distribution, send WhatsApp to:</p>
                    <div className="flex flex-wrap gap-4">
                        {([
                            { value: 'drivers' as const, label: 'Drivers only', desc: 'Each driver gets their assignment' },
                            { value: 'admins' as const, label: 'Admins only', desc: 'Admins get the full report' },
                            { value: 'both' as const, label: 'Both', desc: 'Drivers + admins' },
                        ]).map(option => (
                            <label
                                key={option.value}
                                className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                                    autoRecipients === option.value
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="autoRecipients"
                                    value={option.value}
                                    checked={autoRecipients === option.value}
                                    onChange={() => setAutoRecipients(option.value)}
                                    className="mt-0.5 accent-emerald-500"
                                />
                                <div>
                                    <p className={`text-sm font-medium ${autoRecipients === option.value ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                        {option.label}
                                    </p>
                                    <p className="text-xs text-zinc-500">{option.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-zinc-500">
                    Last auto-run:{' '}
                    <span className="text-zinc-300">
                        {config.lastAutoDistributionDate
                            ? formatDisplayDate(config.lastAutoDistributionDate)
                            : 'Never'
                        }
                    </span>
                </p>
            </div>
        </div>
    );
}
