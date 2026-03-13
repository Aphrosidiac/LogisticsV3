'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { formatDistributionMessage } from '@/lib/distribution';
import { formatPhoneNumber, validatePhoneNumber, formatDisplayDate } from '@/lib/utils';
import * as db from '@/lib/db-supabase';
import { useWhatsAppSender } from '@/hooks/useWhatsAppSender';
import {
    Phone,
    Plus,
    Send,
    CheckCircle2,
    AlertCircle,
    Loader,
    WifiOff,
    Megaphone,
    X,
    Check,
    MessageSquare,
    Clock,
    RefreshCw,
    Pause,
    Play,
} from 'lucide-react';

export default function AdminPage() {
    const { config, cache, dispatch, addLog, saveAdminNumbers } = useApp();

    // WhatsApp sender hook
    const wa = useWhatsAppSender(addLog);

    // Admin numbers management
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);

    // Distribution schedule
    const [distributionTime, setDistributionTime] = useState(config.distributionTime || '20:00');
    const [autoRecipients, setAutoRecipients] = useState<'admins' | 'drivers' | 'both'>(config.autoMessageRecipients || 'drivers');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [scheduleSaved, setScheduleSaved] = useState(false);

    // Distribution pause toggle
    const [isTogglingPause, setIsTogglingPause] = useState(false);

    // Reset distribution timer
    const [isResetting, setIsResetting] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    useEffect(() => {
        wa.checkStatus();
    }, []);

    useEffect(() => {
        if (config.distributionTime) setDistributionTime(config.distributionTime);
        if (config.autoMessageRecipients) setAutoRecipients(config.autoMessageRecipients);
    }, [config.distributionTime, config.autoMessageRecipients]);

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

    // ── Reset distribution timer ─────────────────────────────────────────────

    async function resetDistributionTimer() {
        setIsResetting(true);
        try {
            const res = await fetch('/api/cron/reset-distribution', { method: 'POST' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            dispatch({ type: 'SET_CONFIG', payload: { ...config, lastAutoDistributionDate: undefined } });
            addLog('info', 'Distribution timer reset — cron will run again today');
            setResetDone(true);
            setTimeout(() => setResetDone(false), 3000);
        } catch (err: any) {
            addLog('error', 'Failed to reset distribution timer', err.message);
        } finally {
            setIsResetting(false);
        }
    }

    // ── Toggle distribution pause ───────────────────────────────────────────

    async function toggleDistributionPause() {
        setIsTogglingPause(true);
        try {
            const newPaused = !config.distributionPaused;
            const updatedConfig = { ...config, distributionPaused: newPaused };
            await db.saveConfig(updatedConfig);
            dispatch({ type: 'SET_CONFIG', payload: updatedConfig });
            addLog('info', newPaused ? 'Auto-distribution paused' : 'Auto-distribution resumed');
        } catch (err: any) {
            addLog('error', 'Failed to toggle distribution pause', err.message);
        } finally {
            setIsTogglingPause(false);
        }
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

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
                <p className="text-zinc-500 mt-1">
                    Manage WhatsApp, distribution schedule, and admin settings
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

            {/* ── Section 1: Admin Numbers ── */}
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
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-400" />
                            Distribution Schedule
                        </h2>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            Auto-distribute pending orders to drivers daily at a set time
                        </p>
                    </div>
                    <button
                        onClick={toggleDistributionPause}
                        disabled={isTogglingPause}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-wait ${
                            config.distributionPaused
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                    >
                        {isTogglingPause ? (
                            <Loader className="w-4 h-4 animate-spin" />
                        ) : config.distributionPaused ? (
                            <Play className="w-4 h-4" />
                        ) : (
                            <Pause className="w-4 h-4" />
                        )}
                        {config.distributionPaused ? 'Resume' : 'Pause'}
                    </button>
                </div>

                {config.distributionPaused && (
                    <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                        <Pause className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-sm text-rose-300">Auto-distribution is paused. Orders will not be distributed automatically until resumed.</span>
                    </div>
                )}

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

            {/* ── Section 5: Reset Distribution Timer ── */}
            <div className="card p-6 space-y-4 border border-rose-500/20">
                <div>
                    <h2 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-rose-400" />
                        Reset Distribution Timer
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        If auto-distribution already ran today and you need to run it again, use this to allow it.
                    </p>
                </div>
                <button
                    onClick={resetDistributionTimer}
                    disabled={isResetting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isResetting ? (
                        <><Loader className="w-4 h-4 animate-spin" /> Resetting…</>
                    ) : resetDone ? (
                        <><Check className="w-4 h-4" /> Reset!</>
                    ) : (
                        <><RefreshCw className="w-4 h-4" /> Reset Distribution Timer</>
                    )}
                </button>
            </div>
        </div>
    );
}
