'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, QrCode, Send, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db';
import Image from 'next/image';

export default function WhatsAppPage() {
    const { addLog } = useApp();
    const [isConnected, setIsConnected] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);

    useEffect(() => {
        checkStatus();
        loadMessages();
    }, []);

    async function checkStatus() {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setIsConnected(data.connected);
        } catch (error) {
            console.error('Failed to check WhatsApp status:', error);
        }
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
        setIsLoading(true);
        try {
            const res = await fetch('/api/whatsapp/init');
            const data = await res.json();

            if (data.qrCode) {
                setQrCode(data.qrCode);
                addLog('info', 'Scan QR code with WhatsApp');

                // Poll for connection
                const interval = setInterval(async () => {
                    const status = await fetch('/api/whatsapp/init');
                    const statusData = await status.json();
                    if (statusData.status === 'ready') {
                        setIsConnected(true);
                        setQrCode(null);
                        clearInterval(interval);
                        addLog('success', 'WhatsApp connected successfully');
                    }
                }, 2000);

                setTimeout(() => clearInterval(interval), 60000);
            } else if (data.status === 'ready') {
                setIsConnected(true);
                addLog('success', 'WhatsApp is already connected');
            }
        } catch (error: any) {
            addLog('error', 'Failed to connect WhatsApp', error.message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDisconnect() {
        try {
            await fetch('/api/whatsapp/init', { method: 'DELETE' });
            setIsConnected(false);
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
                    Connect WhatsApp to send automated distribution messages
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Connection Card */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Connection Status</h2>

                    <div className="flex items-center gap-3 mb-6">
                        {isConnected ? (
                            <>
                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Connected</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-6 h-6 text-rose-400" />
                                <span className="text-rose-400 font-medium">Not Connected</span>
                            </>
                        )}
                    </div>

                    {qrCode && (
                        <div className="mb-6">
                            <p className="text-sm text-zinc-400 mb-3">
                                Scan this QR code with your WhatsApp mobile app:
                            </p>
                            <div className="bg-white p-4 rounded-lg border-2 border-zinc-700 inline-block">
                                <Image src={qrCode} alt="WhatsApp QR Code" width={256} height={256} />
                            </div>
                        </div>
                    )}

                    {!isConnected && !qrCode && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-400">
                                Connect WhatsApp to send automated distribution messages to drivers.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {!isConnected ? (
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="btn-primary flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <Loader className="w-5 h-5 animate-spin" />
                                ) : (
                                    <QrCode className="w-5 h-5" />
                                )}
                                Connect WhatsApp
                            </button>
                        ) : (
                            <button
                                onClick={handleDisconnect}
                                className="btn-danger flex items-center gap-2"
                            >
                                <XCircle className="w-5 h-5" />
                                Disconnect
                            </button>
                        )}
                    </div>
                </div>

                {/* Message History Card */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Message History</h2>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {messages.length > 0 ? (
                            messages.slice(0, 10).map((msg) => (
                                <div key={msg.id} className="border border-zinc-700 bg-zinc-800/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-zinc-200">
                                            {msg.recipient}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded ${
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
                                        <p className="text-xs text-zinc-500 mt-1">
                                            {new Date(msg.sentAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-zinc-500 text-center py-8">
                                No messages sent yet
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Note */}
            <div className="alert-warning flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-400/80">
                    <strong className="text-yellow-400">Note:</strong> WhatsApp Web.js integration requires a server environment.
                    In this current setup, the API endpoints are created but may require additional
                    server configuration to work properly. Consider deploying to a Node.js server
                    environment for full functionality.
                </div>
            </div>
        </div>
    );
}
