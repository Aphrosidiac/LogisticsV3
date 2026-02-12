'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, QrCode, Send, CheckCircle, XCircle, Loader } from 'lucide-react';
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <MessageSquare className="w-8 h-8 text-green-600" />
                    <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integration</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Connection Card */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h2>

                        <div className="flex items-center gap-3 mb-6">
                            {isConnected ? (
                                <>
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                    <span className="text-green-700 font-medium">Connected</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-6 h-6 text-red-600" />
                                    <span className="text-red-700 font-medium">Not Connected</span>
                                </>
                            )}
                        </div>

                        {qrCode && (
                            <div className="mb-6">
                                <p className="text-sm text-gray-600 mb-3">
                                    Scan this QR code with your WhatsApp mobile app:
                                </p>
                                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                                    <Image src={qrCode} alt="WhatsApp QR Code" width={256} height={256} />
                                </div>
                            </div>
                        )}

                        {!isConnected && !qrCode && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-blue-800">
                                    Connect WhatsApp to send automated distribution messages to drivers.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            {!isConnected ? (
                                <button
                                    onClick={handleConnect}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Disconnect
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Message History Card */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Message History</h2>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {messages.length > 0 ? (
                                messages.slice(0, 10).map((msg) => (
                                    <div key={msg.id} className="border border-gray-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-900">
                                                {msg.recipient}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                msg.status === 'sent'
                                                    ? 'bg-green-100 text-green-700'
                                                    : msg.status === 'failed'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {msg.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 line-clamp-2">{msg.message}</p>
                                        {msg.sentAt && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(msg.sentAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    No messages sent yet
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> WhatsApp Web.js integration requires a server environment.
                        In this current setup, the API endpoints are created but may require additional
                        server configuration to work properly. Consider deploying to a Node.js server
                        environment for full functionality.
                    </p>
                </div>
            </div>
        </div>
    );
}
