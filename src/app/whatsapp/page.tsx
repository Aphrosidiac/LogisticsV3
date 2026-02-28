'use client';

import { useState, useEffect, useRef } from 'react';
import {
    MessageSquare,
    QrCode,
    CheckCircle,
    XCircle,
    Loader,
    RefreshCw,
    Smartphone,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db-supabase';
import Image from 'next/image';

type ConnectionStep = 'idle' | 'starting' | 'qr' | 'connected';

export default function WhatsAppPage() {
    const { addLog } = useApp();
    const [step, setStep] = useState<ConnectionStep>('idle');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [qrRefreshCount, setQrRefreshCount] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        checkStatus();
        loadMessages();
        return () => {
            stopPolling();
            stopStatusPoll();
        };
    }, []);

    useEffect(() => {
        if (step === 'connected') {
            startStatusPoll();
        } else {
            stopStatusPoll();
        }
    }, [step]);

    function stopPolling() {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }

    function startStatusPoll() {
        stopStatusPoll();
        statusPollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                const data = await res.json();
                if (!data.connected) {
                    stopStatusPoll();
                    setStep('idle');
                    addLog('warning', 'WhatsApp disconnected unexpectedly');
                }
            } catch {
                // ignore transient network errors
            }
        }, 30_000);
    }

    function stopStatusPoll() {
        if (statusPollRef.current) {
            clearInterval(statusPollRef.current);
            statusPollRef.current = null;
        }
    }

    async function checkStatus() {
        // Simple one-shot check on page load
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            if (data.connected) {
                setStep('connected');
            } else {
                setStep('idle');
            }
        } catch { /* ignore */ }
    }

    async function loadMessages() {
        try {
            const msgs = await db.getAllWhatsAppMessages();
            setMessages(msgs);
        } catch (error: any) {
            addLog('error', 'Failed to load messages', error.message);
        }
    }

    async function handleConnect() {
        setStep('starting');
        setQrCode(null);
        stopPolling();

        // Tell worker to start (fire and forget — worker may already be initializing)
        fetch('/api/whatsapp/init', { method: 'POST' }).catch(() => {});

        // Start polling immediately — don't wait for POST response
        const timeoutId = setTimeout(() => {
            stopPolling();
            setStep(prev => {
                if (prev !== 'connected') {
                    addLog('warning', 'QR code timed out. Click Connect to try again.');
                    return 'idle';
                }
                return prev;
            });
        }, 180000);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/whatsapp/init');
                const data = await res.json();

                if (data.status === 'ready') {
                    clearTimeout(timeoutId);
                    stopPolling();
                    setStep('connected');
                    setQrCode(null);
                    addLog('success', 'WhatsApp connected successfully');
                    loadMessages();
                    return;
                }

                if (data.qrCode) {
                    setQrCode(data.qrCode);
                    setStep('qr');
                    setQrRefreshCount(c => c + 1);
                }
            } catch {
                // ignore transient errors
            }
        }, 2000);
    }

    async function handleDisconnect() {
        stopPolling();
        try {
            await fetch('/api/whatsapp/init', { method: 'DELETE' });
            setStep('idle');
            setQrCode(null);
            addLog('info', 'WhatsApp disconnected');
        } catch (error: any) {
            addLog('error', 'Failed to disconnect', error.message);
        }
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">WhatsApp Integration</h1>
                <p className="text-zinc-500 mt-1">
                    Connect your WhatsApp to send distribution reports to admins
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Connection Card */}
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white">Connection</h2>

                    {/* Status indicator */}
                    <div className="flex items-center gap-3">
                        {step === 'connected' ? (
                            <>
                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Connected</span>
                            </>
                        ) : step === 'starting' ? (
                            <>
                                <Loader className="w-6 h-6 text-zinc-400 animate-spin" />
                                <span className="text-zinc-400 font-medium">Starting WhatsApp...</span>
                            </>
                        ) : step === 'qr' ? (
                            <>
                                <Smartphone className="w-6 h-6 text-blue-400" />
                                <span className="text-blue-400 font-medium">Waiting for scan</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-6 h-6 text-zinc-500" />
                                <span className="text-zinc-500 font-medium">Not connected</span>
                            </>
                        )}
                    </div>

                    {/* QR Code */}
                    {step === 'qr' && qrCode && (
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-300 font-medium">
                                Scan with WhatsApp on your phone:
                            </p>
                            <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                                <li>Open WhatsApp on your phone</li>
                                <li>Tap Menu (⋮) → Linked Devices</li>
                                <li>Tap "Link a Device" and scan below</li>
                            </ol>
                            <div className="bg-white p-3 rounded-xl inline-block">
                                <Image
                                    src={qrCode}
                                    alt="WhatsApp QR Code"
                                    width={220}
                                    height={220}
                                    unoptimized
                                />
                            </div>
                            {qrRefreshCount > 0 && (
                                <p className="text-xs text-zinc-500">
                                    QR refreshed {qrRefreshCount} time(s)
                                </p>
                            )}
                        </div>
                    )}

                    {/* Starting state info */}
                    {step === 'starting' && (
                        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                            <p className="text-sm text-zinc-400">
                                Starting browser session... this takes about 5–10 seconds.
                            </p>
                        </div>
                    )}

                    {/* Idle info */}
                    {step === 'idle' && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <p className="text-sm text-blue-400">
                                Click Connect to generate a QR code. You'll scan it with your WhatsApp mobile app to link this device.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        {step === 'connected' ? (
                            <button
                                onClick={handleDisconnect}
                                className="btn-danger flex items-center gap-2"
                            >
                                <XCircle className="w-5 h-5" />
                                Disconnect
                            </button>
                        ) : step === 'idle' ? (
                            <button
                                onClick={handleConnect}
                                className="btn-primary flex items-center gap-2"
                            >
                                <QrCode className="w-5 h-5" />
                                Connect WhatsApp
                            </button>
                        ) : step === 'qr' ? (
                            <button
                                onClick={handleConnect}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh QR
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Message History */}
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Message History</h2>
                        <button
                            onClick={loadMessages}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {messages.length > 0 ? (
                            messages.slice(0, 15).map((msg) => (
                                <div
                                    key={msg.id}
                                    className="border border-zinc-700 bg-zinc-800/50 rounded-lg p-3"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-zinc-200">
                                            {msg.recipient}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            msg.status === 'sent'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : msg.status === 'failed'
                                                ? 'bg-rose-500/20 text-rose-400'
                                                : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {msg.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 line-clamp-2">{msg.message}</p>
                                    {msg.sentAt && (
                                        <p className="text-xs text-zinc-600 mt-1">
                                            {new Date(msg.sentAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                                <p className="text-sm text-zinc-500">No messages sent yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
