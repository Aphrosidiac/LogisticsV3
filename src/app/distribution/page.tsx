'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDistribution, getTomorrowDate, formatDistributionMessage } from '@/lib/distribution';
import { getPendingBalancesForDate, convertBalancesToOrders, batchCreateBalances } from '@/lib/balances';
import DriverListItem from '@/components/DriverListItem';
import type { DriverAssignment } from '@/types';
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
    const { cache, dispatch, addLog, config, isLoading } = useApp();
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState(getTomorrowDate());
    const [balanceCount, setBalanceCount] = useState(0);
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [pendingCount, setPendingCount] = useState<number | null>(null);

    const hasData = cache.orders.length > 0 && cache.drivers.length > 0;
    const distribution = cache.lastDistribution;

    const today = new Date().toISOString().split('T')[0];
    const overdueOrders = cache.orders.filter(
        (o) => (!o.status || o.status === 'pending') && o.date < today
    );

    useEffect(() => {
        loadBalancesForDate();
    }, [targetDate]);

    const loadBalancesForDate = async () => {
        setLoadingBalances(true);
        try {
            const [balances, count] = await Promise.all([
                getPendingBalancesForDate(targetDate),
                db.getPendingOrderCountForDate(targetDate),
            ]);
            setBalanceCount(balances.length);
            setPendingCount(count);

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

            const balances = await getPendingBalancesForDate(targetDate);
            const pendingOrders = cache.orders.filter(o => !o.status || o.status === 'pending');
            let ordersToDistribute = pendingOrders;

            if (balances.length > 0) {
                const balanceOrders = await convertBalancesToOrders(balances);
                ordersToDistribute = [...balanceOrders, ...pendingOrders];
                addLog('info', `Merged ${balances.length} pending balance(s) with ${pendingOrders.length} pending order(s)`);
            }

            const activeDrivers = cache.drivers.filter(d => d.is_active !== false);
            const result = calculateDistribution(ordersToDistribute, activeDrivers, targetDate);
            const distributionId = await db.saveDistribution(result);

            const orderDriverMap = result.assignments.flatMap(a =>
                a.orders.map(o => ({ orderId: o.id, driverId: a.driver.id }))
            );
            if (orderDriverMap.length > 0) {
                await db.updateOrdersToAssigned(orderDriverMap);
                const updatedOrders = await db.getAllOrders();
                dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            }

            if (result.pendingBalances && result.pendingBalances.length > 0) {
                const balanceResult = await batchCreateBalances(result.pendingBalances, distributionId);
                if (balanceResult.success) {
                    addLog('success', `Created ${balanceResult.created} pending balance(s) for next day`);
                } else {
                    addLog('warning', `Balance creation had errors: ${balanceResult.errors.join(', ')}`);
                }
            }

            dispatch({ type: 'SET_DISTRIBUTION', payload: result });
            await loadBalancesForDate();

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

    const handleMarkDelivered = async (assignment: DriverAssignment) => {
        const orderIds = assignment.orders.map(o => o.id).filter(Boolean);
        if (orderIds.length === 0) return;
        try {
            await db.markOrdersAsCompleted(orderIds, assignment.driver.id);
            const updatedOrders = await db.getAllOrders();
            dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            addLog('success', `Marked ${orderIds.length} order(s) as delivered for ${assignment.driver.name}`);
        } catch (err: any) {
            addLog('error', `Failed to mark delivered for ${assignment.driver.name}`, err.message);
            throw err;
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
            addLog('info', 'Sending distribution report via WhatsApp...');
            const message = formatDistributionMessage(distribution);

            let successCount = 0;
            let failCount = 0;

            for (const recipient of config.adminNumbers) {
                try {
                    await db.addWhatsAppMessage(recipient, message);
                    const response = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient, message }),
                    });
                    if (response.ok) successCount++;
                    else failCount++;
                } catch {
                    failCount++;
                }
            }

            if (successCount > 0) addLog('success', `Distribution report sent to ${successCount} admin number(s)`);
            if (failCount > 0) addLog('warning', `Failed to send to ${failCount} number(s)`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send messages';
            setError(message);
            addLog('error', 'WhatsApp sending failed', message);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span className="text-xs text-zinc-400 uppercase tracking-widest font-medium">Operations</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Route Distribution</h1>
                    <p className="text-sm text-zinc-400 mt-0.5">Assign delivery orders to drivers by date</p>
                    {config.distributionTime && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span className="text-xs text-emerald-400">
                                Auto-runs daily at {config.distributionTime}
                            </span>
                        </div>
                    )}
                </div>

                {hasData && (
                    <button
                        onClick={handleCalculate}
                        disabled={isCalculating}
                        className="btn-primary flex items-center gap-2 shrink-0"
                    >
                        {isCalculating ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Calculating...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                {distribution ? 'Recalculate' : 'Run Distribution'}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* ── Date + context strip ── */}
            {hasData && (
                <div className="flex flex-wrap items-stretch border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
                    {/* Date picker */}
                    <div className="flex items-center gap-3 px-5 py-4 flex-1 min-w-[200px]">
                        <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Target date</p>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="bg-transparent text-white text-sm font-medium focus:outline-none focus:text-emerald-400 transition-colors cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="w-px bg-zinc-800 self-stretch" />

                    {/* Pending orders */}
                    <div className="flex items-center gap-3 px-5 py-4">
                        <Package className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-0.5">Pending orders</p>
                            {pendingCount === null || loadingBalances ? (
                                <div className="h-4 w-16 rounded bg-zinc-800 animate-pulse" />
                            ) : (
                                <p className={`text-sm font-semibold tabular-nums ${pendingCount > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {pendingCount} order{pendingCount !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="w-px bg-zinc-800 self-stretch" />

                    {/* Balances */}
                    <div className="flex items-center gap-3 px-5 py-4">
                        <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-0.5">Pending balances</p>
                            {loadingBalances ? (
                                <div className="h-4 w-16 rounded bg-zinc-800 animate-pulse" />
                            ) : balanceCount > 0 ? (
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-amber-400 tabular-nums">
                                        {balanceCount} balance{balanceCount !== 1 ? 's' : ''}
                                    </p>
                                    <span className="text-xs text-amber-400">high priority</span>
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-400">None</p>
                            )}
                        </div>
                    </div>

                    {balanceCount > 0 && (
                        <>
                            <div className="w-px bg-zinc-800 self-stretch" />
                            <div className="flex items-center px-5 py-4">
                                <Link
                                    href="/balances"
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                    View balances
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Overdue warning ── */}
            {hasData && overdueOrders.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-300">
                            {overdueOrders.length} overdue pending order{overdueOrders.length !== 1 ? 's' : ''} from past dates
                        </p>
                        <p className="text-xs text-amber-200/80 mt-0.5">
                            Select an earlier date above to distribute them.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="alert-error flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── No data empty state ── */}
            {!hasData && (
                <div className="card p-12 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <Package className="w-7 h-7 text-zinc-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">No Data Available</h2>
                    <p className="text-zinc-400 text-sm mb-6">
                        Import orders and drivers before calculating distribution
                    </p>
                    <Link href="/sheets-manager" className="btn-primary inline-flex items-center gap-2">
                        Manage Data
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* ── Has data, no distribution yet ── */}
            {hasData && !distribution && (
                <div className="card p-10 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Truck className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-1.5">Ready to Run</h2>
                    <p className="text-sm text-zinc-400 mb-0.5">
                        {cache.orders.length} orders · {cache.drivers.length} drivers loaded
                    </p>
                    {balanceCount > 0 && (
                        <p className="text-xs text-amber-400 mt-1">
                            + {balanceCount} pending balance{balanceCount !== 1 ? 's' : ''} will be included
                        </p>
                    )}
                    <p className="text-xs text-zinc-400 mt-2">
                        Target: {targetDate.split('-').reverse().join('/')}
                    </p>
                </div>
            )}

            {/* ── Distribution results ── */}
            {distribution && (
                <>
                    {/* Stats scoreboard */}
                    <div className="flex items-stretch border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 divide-x divide-zinc-800">
                        {[
                            { label: 'Orders', value: distribution.summary?.totalOrders || 0, color: 'text-emerald-400', icon: Package },
                            { label: 'Pallets', value: distribution.summary?.totalPallets || 0, color: 'text-purple-400', icon: Boxes },
                            { label: 'Zones', value: distribution.summary?.totalZones || 0, color: 'text-orange-400', icon: MapPin },
                            { label: 'Drivers', value: distribution.summary?.assignedDrivers || 0, color: 'text-blue-400', icon: Users },
                            ...(distribution.summary?.balancesCreated !== undefined
                                ? [{ label: 'Balances', value: distribution.summary.balancesCreated, color: 'text-amber-400', icon: Clock }]
                                : []),
                        ].map(({ label, value, color, icon: Icon }) => (
                            <div key={label} className="flex-1 px-4 py-4 text-center">
                                <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                    <Icon className="w-3 h-3 text-zinc-500" />
                                    <p className="text-xs text-zinc-400 uppercase tracking-wider">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Distribution metadata strip */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            <span>Date:</span>
                            <span className="text-zinc-200">
                                {(() => {
                                    const d = distribution.targetDate || targetDate;
                                    const [y, m, day] = d.split('-');
                                    return `${day}/${m}/${y}`;
                                })()}
                            </span>
                        </div>
                        <span className="text-zinc-600">·</span>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span>Calculated:</span>
                            <span className="text-zinc-300">{new Date(distribution.timestamp).toLocaleString()}</span>
                        </div>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-400">Capacity-Constrained Priority Routing</span>
                    </div>

                    {/* Pending balances alert */}
                    {distribution.pendingBalances && distribution.pendingBalances.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-amber-300 mb-1">
                                        {distribution.pendingBalances.length} Pending Balance{distribution.pendingBalances.length !== 1 ? 's' : ''} Created
                                    </h3>
                                    <p className="text-xs text-zinc-300 mb-3">
                                        Orders that exceeded driver capacity — scheduled for the next day.
                                    </p>
                                    <div className="space-y-1.5">
                                        {distribution.pendingBalances.map((balance, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm text-zinc-300">
                                                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                                <span>Zone {balance.zone}:</span>
                                                <span className="text-amber-300 font-medium">{balance.remaining_quantity} pallets</span>
                                                {balance.do_number && (
                                                    <span className="text-zinc-400">· DO: {balance.do_number}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Link
                                        href="/balances"
                                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-3 transition-colors"
                                    >
                                        Manage pending balances
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Driver assignments */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                                    Driver Assignments
                                </h2>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                                    {distribution.assignments?.length || 0}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {config.adminNumbers.length === 0 && (
                                    <span className="text-xs text-amber-400">No admin numbers configured</span>
                                )}
                                <button
                                    onClick={handleSendWhatsApp}
                                    disabled={isSending || config.adminNumbers.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isSending ? (
                                        <>
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare className="w-3 h-3" />
                                            Send via WhatsApp
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {(() => {
                            const completedOrderIds = new Set(
                                cache.orders.filter(o => o.status === 'completed').map(o => o.id)
                            );
                            const pendingAssignments = (distribution.assignments || []).filter(
                                a => !a.orders.every(o => completedOrderIds.has(o.id))
                            );
                            const deliveredAssignments = (distribution.assignments || []).filter(
                                a => a.orders.length > 0 && a.orders.every(o => completedOrderIds.has(o.id))
                            );
                            return (
                                <div className="space-y-3">
                                    {pendingAssignments.map((assignment, index) => (
                                        <DriverListItem
                                            key={assignment.driver.id}
                                            assignment={assignment}
                                            index={index}
                                            onMarkDelivered={handleMarkDelivered}
                                            initialDelivered={false}
                                        />
                                    ))}
                                    {deliveredAssignments.length > 0 && (distribution.targetDate ?? '') >= today && (
                                        <div className="border border-zinc-800 rounded-xl px-4 py-3">
                                            <p className="text-xs text-zinc-500 flex items-center gap-2">
                                                <span className="text-emerald-400">✓</span>
                                                {deliveredAssignments.length} driver{deliveredAssignments.length !== 1 ? 's' : ''} marked as delivered:{' '}
                                                {deliveredAssignments.map(a => a.driver.name).join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Unassigned drivers */}
                    {distribution.unassignedDrivers?.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                                    Unassigned Drivers
                                </h2>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                                    {distribution.unassignedDrivers.length}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(distribution.unassignedDrivers || []).map((driver) => (
                                    <div
                                        key={driver.id}
                                        className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg"
                                    >
                                        <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                                            {driver.identifier.charAt(0)}
                                        </div>
                                        <span className="text-sm text-zinc-200">{driver.name}</span>
                                        <span className="text-xs text-zinc-400">{driver.identifier}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Admin settings footer link */}
                    <div className="flex items-center justify-between py-3 px-4 border border-zinc-800/50 rounded-xl bg-zinc-900/20">
                        <p className="text-xs text-zinc-400">Configure admin numbers and WhatsApp connection</p>
                        <Link
                            href="/admin"
                            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
                        >
                            Admin Settings
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
