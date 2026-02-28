'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { formatDistributionMessage, formatDriverAssignmentMessage } from '@/lib/distribution';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/utils';
import * as db from '@/lib/db-supabase';
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
import type { DriverAssignment } from '@/types';

type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

interface DriverDispatchState {
    status: SendStatus;
    error?: string;
}

export default function AdminPage() {
    const { config, cache, dispatch, addLog, saveAdminNumbers, isLoading } = useApp();

    // WhatsApp connection
    const [waConnected, setWaConnected] = useState(false);
    const [waChecked, setWaChecked] = useState(false);

    // Driver phone numbers (keyed by driver id)
    const [driverPhones, setDriverPhones] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editError, setEditError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Per-driver send status
    const [sendStates, setSendStates] = useState<Record<string, DriverDispatchState>>({});

    // Admin broadcast
    const [broadcastStatus, setBroadcastStatus] = useState<SendStatus>('idle');
    const [broadcastError, setBroadcastError] = useState<string | null>(null);

    // Admin numbers management
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);

    // Distribution schedule
    const [distributionTime, setDistributionTime] = useState(config.distributionTime || '20:00');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [scheduleSaved, setScheduleSaved] = useState(false);

    // Mark delivered
    const [deliveredDrivers, setDeliveredDrivers] = useState<Set<string>>(new Set());
    const [markingDriverId, setMarkingDriverId] = useState<string | null>(null);

    const assignments = cache.lastDistribution?.assignments || [];

    useEffect(() => {
        checkWaStatus();
        loadDriverPhones();
    }, []);

    useEffect(() => {
        if (config.distributionTime) {
            setDistributionTime(config.distributionTime);
        }
    }, [config.distributionTime]);

    async function checkWaStatus() {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setWaConnected(data.connected);
        } catch {
            setWaConnected(false);
        } finally {
            setWaChecked(true);
        }
    }

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

    function startEdit(assignment: DriverAssignment) {
        setEditingId(assignment.driver.id);
        setEditValue(driverPhones[assignment.driver.id] || '');
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
        } catch (err: any) {
            setEditError('Failed to save. Try again.');
        } finally {
            setSavingId(null);
        }
    }

    // ── Per-driver send ─────────────────────────────────────────────────────

    async function sendToDriver(assignment: DriverAssignment) {
        const phone = driverPhones[assignment.driver.id];
        if (!phone) return;

        const driverId = assignment.driver.id;
        setSendStates(prev => ({ ...prev, [driverId]: { status: 'sending' } }));

        try {
            const message = formatDriverAssignmentMessage(assignment);
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: phone, message }),
            });
            const data = await res.json();

            if (data.status === 'success') {
                setSendStates(prev => ({ ...prev, [driverId]: { status: 'sent' } }));
                addLog('success', `Sent assignment to ${assignment.driver.name}`);
                await db.addWhatsAppMessage(phone, message);
            } else {
                setSendStates(prev => ({ ...prev, [driverId]: { status: 'failed', error: data.message } }));
                addLog('error', `Failed to send to ${assignment.driver.name}`, data.message);
            }
        } catch (err: any) {
            setSendStates(prev => ({ ...prev, [driverId]: { status: 'failed', error: err.message } }));
        }
    }

    async function sendAll() {
        const eligible = assignments.filter(a => driverPhones[a.driver.id]);
        for (const assignment of eligible) {
            await sendToDriver(assignment);
            await new Promise(r => setTimeout(r, 400));
        }
    }

    // ── Admin broadcast ─────────────────────────────────────────────────────

    async function handleBroadcast() {
        if (!cache.lastDistribution || config.adminNumbers.length === 0) return;
        setBroadcastStatus('sending');
        setBroadcastError(null);

        try {
            const message = formatDistributionMessage(cache.lastDistribution);
            for (const recipient of config.adminNumbers) {
                const res = await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient, message }),
                });
                const data = await res.json();
                if (data.status === 'success') {
                    await db.addWhatsAppMessage(recipient, message);
                }
            }
            setBroadcastStatus('sent');
            addLog('success', `Broadcast sent to ${config.adminNumbers.length} admin(s)`);
            setTimeout(() => setBroadcastStatus('idle'), 4000);
        } catch (err: any) {
            setBroadcastStatus('failed');
            setBroadcastError(err.message);
            addLog('error', 'Broadcast failed', err.message);
        }
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
            const updatedConfig = { ...config, distributionTime };
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

    // ── Mark Delivered ──────────────────────────────────────────────────────

    async function markDelivered(assignment: DriverAssignment) {
        const driverId = assignment.driver.id;
        const orderIds = assignment.orders.map((o) => o.id).filter(Boolean);
        if (orderIds.length === 0) return;

        setMarkingDriverId(driverId);
        try {
            await db.markOrdersAsCompleted(orderIds, driverId);
            const updatedOrders = await db.getAllOrders();
            dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            setDeliveredDrivers((prev) => new Set([...prev, driverId]));
            addLog('success', `Marked ${orderIds.length} order(s) as completed for ${assignment.driver.name}`);
        } catch (err: any) {
            addLog('error', `Failed to mark delivered for ${assignment.driver.name}`, err.message);
        } finally {
            setMarkingDriverId(null);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    const eligibleCount = assignments.filter(a => driverPhones[a.driver.id]).length;

    function sendButtonContent(driverId: string) {
        const state = sendStates[driverId];
        if (state?.status === 'sending') return <><Loader className="w-4 h-4 animate-spin" /> Sending…</>;
        if (state?.status === 'sent')    return <><Check className="w-4 h-4" /> Sent</>;
        if (state?.status === 'failed')  return <><X className="w-4 h-4" /> Failed</>;
        return <><Send className="w-4 h-4" /> Send</>;
    }

    function sendButtonClass(driverId: string) {
        const s = sendStates[driverId]?.status;
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
            {waChecked && !waConnected && (
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
                            disabled={!waConnected}
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
                            const sendState = sendStates[driverId]?.status;
                            const canSend = !!phone && waConnected && sendState !== 'sending';

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
                                                <>
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
                                                </>
                                            ) : (
                                                <>
                                                    {phone ? (
                                                        <button
                                                            onClick={() => startEdit(assignment)}
                                                            className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-700/50 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                            {phone}
                                                            <Pencil className="w-3 h-3 text-zinc-500" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEdit(assignment)}
                                                            className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-600 transition-colors"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Add phone
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => sendToDriver(assignment)}
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
                                    {sendStates[driverId]?.status === 'failed' && sendStates[driverId]?.error && (
                                        <p className="text-xs text-rose-400 mt-2">
                                            {sendStates[driverId].error}
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
                                                onClick={() => markDelivered(assignment)}
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
                            !waConnected ||
                            broadcastStatus === 'sending'
                        }
                        className="btn-primary flex items-center gap-2"
                    >
                        {broadcastStatus === 'sending' ? (
                            <><Loader className="w-5 h-5 animate-spin" /> Sending…</>
                        ) : broadcastStatus === 'sent' ? (
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

                {broadcastStatus === 'failed' && broadcastError && (
                    <p className="text-sm text-rose-400 flex items-center gap-2">
                        <X className="w-4 h-4" />
                        {broadcastError}
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

                <p className="text-sm text-zinc-500">
                    Last auto-run:{' '}
                    <span className="text-zinc-300">
                        {config.lastAutoDistributionDate
                            ? (() => {
                                const [y, m, d] = config.lastAutoDistributionDate.split('-');
                                return `${d}/${m}/${y}`;
                            })()
                            : 'Never'
                        }
                    </span>
                </p>

                <div className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    Run <code className="text-zinc-300 bg-zinc-700 px-1 rounded">npm run cron</code> in a separate terminal alongside{' '}
                    <code className="text-zinc-300 bg-zinc-700 px-1 rounded">npm run dev</code> to enable auto-distribution.
                </div>
            </div>
        </div>
    );
}
