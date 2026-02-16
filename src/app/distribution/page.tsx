'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDistribution, getTomorrowDate } from '@/lib/distribution';
import { getPendingBalancesForDate, convertBalancesToOrders, batchCreateBalances } from '@/lib/balances';
import DriverCard from '@/components/DriverCard';
import StatCard from '@/components/StatCard';
import {
    Truck,
    RefreshCw,
    AlertCircle,
    Package,
    Boxes,
    MapPin,
    Users,
    ArrowRight,
    MessageSquare,
    Calendar,
    Clock,
} from 'lucide-react';
import Link from 'next/link';
import * as db from '@/lib/db-supabase';

export default function DistributionPage() {
    const { cache, dispatch, addLog, config } = useApp();
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState(getTomorrowDate());
    const [balanceCount, setBalanceCount] = useState(0);
    const [loadingBalances, setLoadingBalances] = useState(false);

    const hasData = cache.orders.length > 0 && cache.drivers.length > 0;
    const distribution = cache.lastDistribution;

    // Load balances when date changes
    useEffect(() => {
        loadBalancesForDate();
    }, [targetDate]);

    const loadBalancesForDate = async () => {
        setLoadingBalances(true);
        try {
            const balances = await getPendingBalancesForDate(targetDate);
            setBalanceCount(balances.length);

            if (balances.length > 0) {
                addLog('info', `Found ${balances.length} pending balance(s) for ${targetDate}`);
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        } finally {
            setLoadingBalances(false);
        }
    };

    const handleCalculate = async () => {
        if (!hasData) return;

        setIsCalculating(true);
        setError(null);

        try {
            addLog('info', `Calculating distribution for ${targetDate}...`);

            // Load pending balances for this date
            const balances = await getPendingBalancesForDate(targetDate);
            let ordersToDistribute = cache.orders;

            // Convert balances to high-priority orders
            if (balances.length > 0) {
                const balanceOrders = await convertBalancesToOrders(balances);
                ordersToDistribute = [...balanceOrders, ...cache.orders];
                addLog('info', `Merged ${balances.length} pending balance(s) with ${cache.orders.length} regular order(s)`);
            }

            // Calculate distribution with target date
            const result = calculateDistribution(ordersToDistribute, cache.drivers, targetDate);

            // Save distribution to database
            const distributionId = await db.saveDistribution(result);

            // Save pending balances to database
            if (result.pendingBalances && result.pendingBalances.length > 0) {
                const balanceResult = await batchCreateBalances(result.pendingBalances, distributionId);

                if (balanceResult.success) {
                    addLog('success', `Created ${balanceResult.created} pending balance(s) for next day`);
                } else {
                    addLog('warning', `Balance creation had errors: ${balanceResult.errors.join(', ')}`);
                }
            }

            dispatch({ type: 'SET_DISTRIBUTION', payload: result });

            addLog(
                'success',
                `Distribution calculated: ${result.summary.assignedDrivers} drivers assigned to ${result.summary.totalZones} zones`
            );

            if (result.summary.balancesCreated && result.summary.balancesCreated > 0) {
                addLog('info', `${result.summary.balancesCreated} order(s) created pending balances for next day`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to calculate distribution';
            setError(message);
            addLog('error', 'Distribution calculation failed', message);
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!distribution || config.adminNumbers.length === 0) {
            addLog('warning', 'No admin numbers configured. Please add them in Admin Settings.');
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            addLog('info', 'Sending WhatsApp messages...');

            let successCount = 0;
            let failCount = 0;

            for (const assignment of distribution.assignments) {
                const recipient = config.adminNumbers[0];

                const message = `*Driver Assignment*\n\n` +
                    `Driver: ${assignment.driver.name} (${assignment.driver.identifier})\n` +
                    `Zones: ${assignment.zones.join(', ')}\n` +
                    `Orders: ${assignment.totalOrders}\n` +
                    `Pallets: ${assignment.totalPallets}\n\n` +
                    `Orders:\n${assignment.orders.map(o =>
                        `- Zone ${o.zone}: ${o.pallets} pallets`
                    ).join('\n')}`;

                try {
                    await db.addWhatsAppMessage(recipient, message);

                    const response = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient, message }),
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (err) {
                    failCount++;
                }
            }

            if (successCount > 0) {
                addLog('success', `Sent ${successCount} WhatsApp messages`);
            }
            if (failCount > 0) {
                addLog('warning', `Failed to send ${failCount} messages`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send messages';
            setError(message);
            addLog('error', 'WhatsApp sending failed', message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Distribution</h1>
                    <p className="text-zinc-500 mt-1">
                        Calculate and view order distribution across drivers
                    </p>
                </div>

                {hasData && (
                    <button
                        onClick={handleCalculate}
                        disabled={isCalculating}
                        className="btn-primary flex items-center gap-2"
                    >
                        {isCalculating ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Calculating...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-5 h-5" />
                                {distribution ? 'Recalculate' : 'Calculate Distribution'}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Date Picker & Balance Info */}
            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date Picker */}
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-zinc-300 mb-3">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Target Delivery Date
                        </label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-zinc-500 mt-2">
                            Only orders for this date will be included in distribution
                        </p>
                    </div>

                    {/* Pending Balances Info */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-zinc-300">
                                <Clock className="w-4 h-4 inline mr-2" />
                                Pending Balances
                            </label>
                            {loadingBalances && (
                                <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
                            )}
                        </div>

                        {balanceCount > 0 ? (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <p className="text-yellow-400 font-medium">
                                    {balanceCount} pending balance(s) found
                                </p>
                                <p className="text-sm text-zinc-400 mt-1">
                                    These will be automatically included as high-priority orders
                                </p>
                                <Link
                                    href="/balances"
                                    className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                >
                                    View all balances →
                                </Link>
                            </div>
                        ) : (
                            <div className="text-zinc-400 text-sm">
                                No pending balances for this date
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="alert-error flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* No Data State */}
            {!hasData && (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
                        <Package className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
                    <p className="text-zinc-500 mb-6">
                        Import orders and drivers before calculating distribution
                    </p>
                    <Link href="/sheets-manager" className="btn-primary inline-flex items-center gap-2">
                        Manage Data
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* Distribution Results */}
            {distribution && (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <StatCard
                            title="Total Orders"
                            value={distribution.summary.totalOrders}
                            icon={Package}
                            color="emerald"
                        />
                        <StatCard
                            title="Total Pallets"
                            value={distribution.summary.totalPallets}
                            icon={Boxes}
                            color="purple"
                        />
                        <StatCard
                            title="Zones Covered"
                            value={distribution.summary.totalZones}
                            icon={MapPin}
                            color="orange"
                        />
                        <StatCard
                            title="Drivers Assigned"
                            value={distribution.summary.assignedDrivers}
                            icon={Users}
                            color="blue"
                        />
                        {distribution.summary.balancesCreated !== undefined && (
                            <StatCard
                                title="Pending Balances"
                                value={distribution.summary.balancesCreated}
                                icon={Clock}
                                color="yellow"
                            />
                        )}
                    </div>

                    {/* Distribution Info */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Distribution Info</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-zinc-400">
                            <div>
                                <span className="text-zinc-500">Target Date:</span>{' '}
                                <span className="text-zinc-200">
                                    {distribution.targetDate || targetDate}
                                </span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Calculated at:</span>{' '}
                                <span className="text-zinc-200">
                                    {new Date(distribution.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Algorithm:</span>{' '}
                                <span className="text-zinc-200">Capacity-Constrained Priority Routing</span>
                            </div>
                        </div>
                    </div>

                    {/* Pending Balances Alert */}
                    {distribution.pendingBalances && distribution.pendingBalances.length > 0 && (
                        <div className="card p-6 bg-yellow-500/10 border-yellow-500/30">
                            <div className="flex items-start gap-4">
                                <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                                        {distribution.pendingBalances.length} Pending Balance(s) Created
                                    </h3>
                                    <p className="text-zinc-300 text-sm mb-3">
                                        Some orders exceeded driver capacity and have been scheduled for the next day.
                                    </p>
                                    <div className="space-y-2">
                                        {distribution.pendingBalances.map((balance, idx) => (
                                            <div key={idx} className="text-sm text-zinc-400">
                                                • Zone {balance.zone}: {balance.remaining_quantity} pallets
                                                {balance.do_number && ` (DO: ${balance.do_number})`}
                                            </div>
                                        ))}
                                    </div>
                                    <Link
                                        href="/balances"
                                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-4"
                                    >
                                        Manage pending balances
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Driver Assignments */}
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-4">Driver Assignments</h2>
                        <div className="space-y-4">
                            {distribution.assignments.map((assignment) => (
                                <DriverCard key={assignment.driver.id} assignment={assignment} />
                            ))}
                        </div>
                    </div>

                    {/* Unassigned Drivers */}
                    {distribution.unassignedDrivers.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-400" />
                                Unassigned Drivers ({distribution.unassignedDrivers.length})
                            </h2>
                            <div className="flex flex-wrap gap-3">
                                {distribution.unassignedDrivers.map((driver) => (
                                    <div
                                        key={driver.id}
                                        className="px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg"
                                    >
                                        <span className="text-zinc-300">{driver.name}</span>
                                        <span className="text-zinc-500 ml-2">({driver.identifier})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Action */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Send via WhatsApp</h3>
                                    <p className="text-zinc-400 text-sm">
                                        Automatically send assignments to drivers
                                    </p>
                                </div>
                                <button
                                    onClick={handleSendWhatsApp}
                                    disabled={isSending || config.adminNumbers.length === 0}
                                    className="btn-primary flex items-center justify-center gap-2 w-full disabled:opacity-50"
                                >
                                    {isSending ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare className="w-5 h-5" />
                                            Send Messages
                                        </>
                                    )}
                                </button>
                                {config.adminNumbers.length === 0 && (
                                    <p className="text-xs text-yellow-400">
                                        ⚠️ Configure admin numbers in settings first
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="card p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Admin Settings</h3>
                                    <p className="text-zinc-400 text-sm">
                                        Configure numbers and WhatsApp connection
                                    </p>
                                </div>
                                <Link href="/admin" className="btn-primary flex items-center justify-center gap-2 w-full">
                                    Go to Settings
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Has data but no distribution yet */}
            {hasData && !distribution && (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                        <Truck className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Ready to Calculate</h2>
                    <p className="text-zinc-500 mb-2">
                        {cache.orders.length} orders and {cache.drivers.length} drivers loaded
                    </p>
                    {balanceCount > 0 && (
                        <p className="text-sm text-yellow-400 mb-2">
                            + {balanceCount} pending balance(s) will be included
                        </p>
                    )}
                    <p className="text-sm text-zinc-600 mb-6">
                        Click the button above to calculate distribution for {targetDate}
                    </p>
                </div>
            )}
        </div>
    );
}
