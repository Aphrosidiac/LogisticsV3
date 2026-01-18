'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { fetchGoogleSheet } from '@/lib/sheets';
import {
    FileSpreadsheet,
    Download,
    Check,
    AlertCircle,
    Loader2,
    ExternalLink,
} from 'lucide-react';

export default function SheetsPage() {
    const { config, cache, dispatch, addLog } = useApp();
    const [url, setUrl] = useState(config.sheetsUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleFetch = async () => {
        if (!url.trim()) {
            setError('Please enter a Google Sheets URL');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            addLog('info', 'Fetching data from Google Sheets...', url);

            const { orders, drivers } = await fetchGoogleSheet(url);

            dispatch({ type: 'SET_ORDERS', payload: orders });
            dispatch({ type: 'SET_DRIVERS', payload: drivers });
            dispatch({ type: 'SET_SHEETS_URL', payload: url });

            const message = `Successfully fetched ${orders.length} orders and ${drivers.length} drivers`;
            setSuccess(message);
            addLog('success', message);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch data';
            setError(message);
            addLog('error', 'Failed to fetch data from Google Sheets', message);
        } finally {
            setIsLoading(false);
        }
    };

    const preview = cache.orders.slice(0, 50);
    const zones = [...new Set(cache.orders.map((o) => o.zone))].sort();

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Google Sheets</h1>
                <p className="text-zinc-500 mt-1">
                    Import orders and driver data from your Google Sheet
                </p>
            </div>

            {/* URL Input */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Sheet URL</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                            Enter your public Google Sheets URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            className="input"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleFetch}
                            disabled={isLoading || !url.trim()}
                            className="btn-primary flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Fetch Data
                                </>
                            )}
                        </button>

                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary flex items-center gap-2"
                            >
                                <ExternalLink className="w-5 h-5" />
                                Open Sheet
                            </a>
                        )}
                    </div>

                    {/* Status Messages */}
                    {error && (
                        <div className="alert-error flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="alert-success flex items-center gap-3">
                            <Check className="w-5 h-5 flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Sheet Requirements */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Sheet Requirements</h2>
                <div className="space-y-3 text-sm text-zinc-400">
                    <p>Your Google Sheet must be <strong className="text-zinc-200">publicly accessible</strong> and contain:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong className="text-zinc-200">Sheet 1 (Orders)</strong>: Columns with <code className="bg-zinc-800 px-1 rounded">PALLETS</code> and <code className="bg-zinc-800 px-1 rounded">ZONE</code></li>
                        <li>Optional columns: <code className="bg-zinc-800 px-1 rounded">DATE</code>, <code className="bg-zinc-800 px-1 rounded">PICKUP</code>, <code className="bg-zinc-800 px-1 rounded">DELIVERY</code>, <code className="bg-zinc-800 px-1 rounded">INVOICE</code></li>
                        <li><strong className="text-zinc-200">Sheet 2 (Drivers)</strong>: Columns with <code className="bg-zinc-800 px-1 rounded">NAME</code> and <code className="bg-zinc-800 px-1 rounded">IDENTIFIER</code></li>
                    </ul>
                </div>
            </div>

            {/* Data Preview */}
            {cache.orders.length > 0 && (
                <>
                    {/* Zone Summary */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Zone Summary</h2>
                        <div className="flex flex-wrap gap-2">
                            {zones.map((zone) => {
                                const zoneOrders = cache.orders.filter((o) => o.zone === zone);
                                const zonePallets = zoneOrders.reduce((sum, o) => sum + o.pallets, 0);
                                return (
                                    <div
                                        key={zone}
                                        className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                                    >
                                        <span className="font-medium text-orange-400">Zone {zone}</span>
                                        <span className="text-zinc-400 ml-2">
                                            {zoneOrders.length} orders • {zonePallets} pallets
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Orders Preview</h2>
                            <span className="text-sm text-zinc-500">
                                Showing {preview.length} of {cache.orders.length} orders
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="px-4 py-3 text-left text-zinc-400 font-medium">Zone</th>
                                        <th className="px-4 py-3 text-left text-zinc-400 font-medium">Pickup</th>
                                        <th className="px-4 py-3 text-left text-zinc-400 font-medium">Delivery</th>
                                        <th className="px-4 py-3 text-right text-zinc-400 font-medium">Pallets</th>
                                        <th className="px-4 py-3 text-left text-zinc-400 font-medium">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((order) => (
                                        <tr key={order.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                                                    {order.zone}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-300">{order.pickup || '-'}</td>
                                            <td className="px-4 py-3 text-zinc-300">{order.delivery || '-'}</td>
                                            <td className="px-4 py-3 text-right text-purple-400 font-medium">{order.pallets}</td>
                                            <td className="px-4 py-3 text-zinc-500">{order.invoice || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Drivers Table */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Drivers ({cache.drivers.length})</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {cache.drivers.map((driver) => (
                                <div
                                    key={driver.id}
                                    className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg"
                                >
                                    <p className="font-medium text-zinc-200">{driver.name}</p>
                                    <p className="text-xs text-zinc-500">{driver.identifier}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
