'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDistribution, getTomorrowDate, formatDistributionMessage } from '@/lib/distribution';
import { getLocalDate } from '@/lib/utils';
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
    PackageCheck,
    SkipForward,
    RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import * as db from '@/lib/db-supabase';
import { formatDisplayDate } from '@/lib/utils';
import { useWhatsAppSender } from '@/hooks/useWhatsAppSender';
import { formatDriverAssignmentMessage } from '@/lib/distribution';

export default function DistributionPage() {
    const { cache, dispatch, addLog, config, isLoading } = useApp();
    const wa = useWhatsAppSender(addLog);
    const [driverPhones, setDriverPhones] = useState<Record<string, string>>({});
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [confirmMarkAll, setConfirmMarkAll] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [isCancelRedistributing, setIsCancelRedistributing] = useState(false);
    const [confirmCancelRedistribute, setConfirmCancelRedistribute] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState(() => {
        const distDate = cache.lastDistribution?.targetDate;
        const tomorrow = getTomorrowDate();
        // Only use the cached distribution's date if it's tomorrow or later
        return distDate && distDate >= tomorrow ? distDate : tomorrow;
    });
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const [loadingPending, setLoadingPending] = useState(false);

    const hasData = cache.orders.length > 0 && cache.drivers.length > 0;
    const distribution = cache.lastDistribution;

    const today = getLocalDate();
    const overdueOrders = cache.orders.filter(
        (o) => (!o.status || o.status === 'pending') && o.date < today
    );

    useEffect(() => {
        wa.checkStatus();
        loadDriverPhones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadPendingCount();
        // Load existing distribution for the selected date
        loadDistributionForDate(targetDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetDate]);

    async function loadDistributionForDate(date: string) {
        try {
            const dist = await db.getDistributionByDate(date);
            if (dist) {
                dispatch({ type: 'SET_DISTRIBUTION', payload: dist });
            } else if (distribution?.targetDate !== date) {
                // No distribution for this date — clear the view
                dispatch({ type: 'SET_DISTRIBUTION', payload: null });
            }
        } catch {
            // non-critical
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

    const loadPendingCount = async () => {
        setLoadingPending(true);
        try {
            const count = await db.getPendingOrderCountForDate(targetDate);
            setPendingCount(count);
        } catch (error) {
            console.error('Error loading pending count:', error);
        } finally {
            setLoadingPending(false);
        }
    };

    const handleCalculate = async () => {
        if (!hasData) return;

        if (config.distributionPaused) {
            setError('Distribution is currently paused. Go to Admin Settings to resume.');
            return;
        }

        setIsCalculating(true);
        setError(null);

        try {
            addLog('info', `Calculating distribution for ${targetDate}...`);

            const pendingOrders = cache.orders.filter(o => !o.status || o.status === 'pending');
            const activeDrivers = cache.drivers.filter(d => d.is_active !== false);
            const result = calculateDistribution(pendingOrders, activeDrivers, targetDate);

            // Check if there's an existing distribution for this date — merge if so
            const existing = await db.getDistributionByDate(targetDate);
            let finalResult: typeof result & { id?: string };
            let distributionId: string;

            if (existing?.id) {
                // Merge new assignments into existing distribution
                const mergedAssignments = [...existing.assignments];

                for (const newAssignment of result.assignments) {
                    const existingIdx = mergedAssignments.findIndex(
                        a => a.driver.id === newAssignment.driver.id
                    );

                    if (existingIdx >= 0) {
                        // Same driver — append new orders, merge zones, update totals
                        const ea = mergedAssignments[existingIdx];
                        ea.orders = [...ea.orders, ...newAssignment.orders];
                        ea.totalOrders = ea.orders.length;
                        ea.totalPallets += newAssignment.totalPallets;
                        for (const z of newAssignment.zones) {
                            if (!ea.zones.includes(z)) ea.zones.push(z);
                        }
                    } else {
                        // New driver entry
                        mergedAssignments.push(newAssignment);
                    }
                }

                // Recalculate summary from merged data
                const allZones = new Set<string>();
                let totalOrders = 0;
                let totalPallets = 0;
                for (const a of mergedAssignments) {
                    totalOrders += a.totalOrders;
                    totalPallets += a.totalPallets;
                    a.zones.forEach(z => allZones.add(z));
                }

                // Unassigned = drivers not in any assignment
                const assignedDriverIds = new Set(mergedAssignments.map(a => a.driver.id));
                const unassignedDrivers = activeDrivers.filter(d => !assignedDriverIds.has(d.id));

                finalResult = {
                    id: existing.id,
                    assignments: mergedAssignments.sort((a, b) => a.driver.name.localeCompare(b.driver.name)),
                    unassignedDrivers,
                    skippedOrders: result.skippedOrders,
                    summary: {
                        totalOrders,
                        totalPallets,
                        totalZones: allZones.size,
                        assignedDrivers: mergedAssignments.length,
                        skippedOrders: result.skippedOrders?.length || 0,
                    },
                    timestamp: new Date().toISOString(),
                    targetDate,
                };

                await db.updateDistribution(existing.id, finalResult);
                distributionId = existing.id;
                addLog('info', `Merged with existing distribution for ${targetDate}`);
            } else {
                // First distribution for this date
                distributionId = await db.saveDistribution(result);
                finalResult = { ...result, id: distributionId };
            }

            // Mark newly assigned orders
            const orderDriverMap = result.assignments.flatMap(a =>
                a.orders.map(o => ({ orderId: o.id, driverId: a.driver.id }))
            );
            if (orderDriverMap.length > 0) {
                await db.updateOrdersToAssigned(orderDriverMap);
                const updatedOrders = await db.getAllOrders();
                dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            }

            dispatch({ type: 'SET_DISTRIBUTION', payload: finalResult });
            await loadPendingCount();

            addLog(
                'success',
                `Distribution calculated: ${finalResult.summary.assignedDrivers} drivers assigned to ${finalResult.summary.totalZones} zones (${finalResult.summary.totalOrders} total orders)`
            );

            if (result.summary.skippedOrders && result.summary.skippedOrders > 0) {
                addLog('warning', `${result.summary.skippedOrders} order(s) could not be assigned — no driver had enough capacity`);
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
        try {
            // Mark orders as completed in DB (best-effort — IDs may not exist for balance orders)
            const orderIds = assignment.orders.map(o => o.id).filter(Boolean);
            if (orderIds.length > 0) {
                await db.markOrdersAsCompleted(orderIds, assignment.driver.id);
                const updatedOrders = await db.getAllOrders();
                dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            }

            // Persist isDelivered on the assignment itself so it survives refresh
            if (distribution?.id) {
                const updatedAssignments = distribution.assignments.map(a =>
                    a.driver.id === assignment.driver.id ? { ...a, isDelivered: true } : a
                );
                await db.updateDistributionAssignments(distribution.id, updatedAssignments);
                dispatch({
                    type: 'SET_DISTRIBUTION',
                    payload: { ...distribution, assignments: updatedAssignments },
                });
            }

            addLog('success', `Marked ${assignment.driver.name}'s orders as delivered`);
        } catch (err: unknown) {
            addLog('error', `Failed to mark delivered for ${assignment.driver.name}`, (err as Error).message);
            throw err;
        }
    };

    const handleMarkAllDelivered = async () => {
        if (!distribution?.id) return;
        setIsMarkingAll(true);
        setConfirmMarkAll(false);
        try {
            const pending = distribution.assignments.filter(a => !a.isDelivered);
            const allOrderIds = pending.flatMap(a => a.orders.map(o => o.id).filter(Boolean));
            if (allOrderIds.length > 0) {
                await db.markOrdersAsCompleted(allOrderIds);
                const updatedOrders = await db.getAllOrders();
                dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            }
            const updatedAssignments = distribution.assignments.map(a => ({ ...a, isDelivered: true }));
            await db.updateDistributionAssignments(distribution.id, updatedAssignments);
            dispatch({ type: 'SET_DISTRIBUTION', payload: { ...distribution, assignments: updatedAssignments } });
            addLog('success', `Marked all ${pending.length} driver assignment(s) as delivered`);
        } catch (err: unknown) {
            addLog('error', 'Failed to mark all as delivered', (err as Error).message);
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleCancelRedistribute = async () => {
        setIsCancelRedistributing(true);
        setConfirmCancelRedistribute(false);
        setError(null);

        try {
            addLog('info', `Cancelling and redistributing for ${targetDate}...`);

            const response = await fetch('/api/distribution/cancel-redistribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetDate }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to cancel and redistribute');
            }

            if (data.redistributed && data.result) {
                dispatch({ type: 'SET_DISTRIBUTION', payload: data.result });
                addLog('success', `Redistribution complete: ${data.result.summary.assignedDrivers} drivers, ${data.result.summary.totalOrders} orders`);
            } else {
                dispatch({ type: 'SET_DISTRIBUTION', payload: null });
                addLog('warning', `Distribution cancelled. ${data.message || 'No pending orders to redistribute.'}`);
            }

            const updatedOrders = await db.getAllOrders();
            dispatch({ type: 'SET_ORDERS', payload: updatedOrders });
            await loadPendingCount();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Cancel & redistribute failed';
            setError(message);
            addLog('error', 'Cancel & redistribute failed', message);
        } finally {
            setIsCancelRedistributing(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!distribution) return;

        const recipients = config.autoMessageRecipients || 'admins';
        const sendToDrivers = recipients === 'drivers' || recipients === 'both';
        const sendToAdmins = recipients === 'admins' || recipients === 'both';

        if (sendToAdmins && config.adminNumbers.length === 0) {
            addLog('warning', 'No admin numbers configured. Please add them in Admin Settings.');
        }

        setIsSending(true);
        setError(null);

        try {
            let driverSuccess = 0, driverFail = 0;
            let adminSuccess = 0, adminFail = 0;

            // Send to drivers
            if (sendToDrivers) {
                for (const assignment of distribution.assignments) {
                    const phone = driverPhones[assignment.driver.id];
                    if (!phone) continue;
                    try {
                        const message = formatDriverAssignmentMessage(assignment);
                        await db.addWhatsAppMessage(phone, message, distribution.id);
                        const response = await fetch('/api/whatsapp/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipient: phone, message }),
                        });
                        if (response.ok) driverSuccess++;
                        else driverFail++;
                    } catch {
                        driverFail++;
                    }
                }
            }

            // Send admin report
            if (sendToAdmins && config.adminNumbers.length > 0) {
                const adminMessage = formatDistributionMessage(distribution);
                for (const recipient of config.adminNumbers) {
                    try {
                        await db.addWhatsAppMessage(recipient, adminMessage, distribution.id);
                        const response = await fetch('/api/whatsapp/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipient, message: adminMessage }),
                        });
                        if (response.ok) adminSuccess++;
                        else adminFail++;
                    } catch {
                        adminFail++;
                    }
                }

                // Send skipped orders alert separately if any
                if (distribution.skippedOrders && distribution.skippedOrders.length > 0) {
                    const { formatSkippedOrdersMessage } = await import('@/lib/distribution');
                    const skippedMsg = formatSkippedOrdersMessage(distribution.skippedOrders);
                    for (const recipient of config.adminNumbers) {
                        try {
                            await fetch('/api/whatsapp/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recipient, message: skippedMsg }),
                            });
                        } catch { /* non-critical */ }
                    }
                }
            }

            if (driverSuccess > 0) addLog('success', `Assignment sent to ${driverSuccess} driver(s)`);
            if (driverFail > 0) addLog('warning', `Failed to send to ${driverFail} driver(s) — check phone numbers`);
            if (adminSuccess > 0) addLog('success', `Distribution report sent to ${adminSuccess} admin(s)`);
            if (adminFail > 0) addLog('warning', `Failed to send to ${adminFail} admin number(s)`);
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
                    {config.distributionPaused ? (
                        <div className="flex items-center gap-1.5 mt-2">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span className="text-xs text-rose-400">
                                Distribution is paused — <Link href="/admin" className="underline hover:text-rose-300">resume in Admin Settings</Link>
                            </span>
                        </div>
                    ) : config.distributionTime && (
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
                        disabled={isCalculating || config.distributionPaused}
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
                <div className="flex flex-wrap items-stretch border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 divide-x divide-zinc-800">
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

                    {/* Pending orders */}
                    <div className="flex items-center gap-3 px-5 py-4">
                        <Package className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-0.5">Pending orders</p>
                            {pendingCount === null || loadingPending ? (
                                <div className="h-4 w-16 rounded bg-zinc-800 animate-pulse" />
                            ) : (
                                <p className={`text-sm font-semibold tabular-nums ${pendingCount > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {pendingCount} order{pendingCount !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
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
                    <p className="text-xs text-zinc-400 mt-2">
                        Target: {formatDisplayDate(targetDate)}
                    </p>
                </div>
            )}

            {/* ── Distribution results ── */}
            {distribution && (
                <>
                    {/* Stats scoreboard */}
                    <div className="flex items-stretch border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 divide-x divide-zinc-800">
                        {[
                            { label: 'Orders', value: distribution.summary?.totalOrders || 0, color: 'text-emerald-400', icon: Package },
                            { label: 'Pallets', value: distribution.summary?.totalPallets || 0, color: 'text-purple-400', icon: Boxes },
                            { label: 'Zones', value: distribution.summary?.totalZones || 0, color: 'text-orange-400', icon: MapPin },
                            { label: 'Drivers', value: distribution.summary?.assignedDrivers || 0, color: 'text-blue-400', icon: Users },
                            ...(distribution.summary?.skippedOrders
                                ? [{ label: 'Skipped', value: distribution.summary.skippedOrders, color: 'text-amber-400', icon: SkipForward }]
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
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            <span>Date:</span>
                            <span className="text-zinc-200">
                                {formatDisplayDate(distribution.targetDate || targetDate)}
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

                        <span className="ml-auto" />
                        {isCancelRedistributing ? (
                            <span className="flex items-center gap-1.5 text-amber-400">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Redistributing...
                            </span>
                        ) : confirmCancelRedistribute ? (
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400">Cancel current &amp; redo?</span>
                                <button
                                    onClick={handleCancelRedistribute}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setConfirmCancelRedistribute(false)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                                >
                                    No
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmCancelRedistribute(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Cancel &amp; Redistribute
                            </button>
                        )}
                    </div>

                    {/* Skipped orders alert */}
                    {distribution.skippedOrders && distribution.skippedOrders.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <SkipForward className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-amber-300 mb-1">
                                        {distribution.skippedOrders.length} Order{distribution.skippedOrders.length !== 1 ? 's' : ''} Could Not Be Assigned
                                    </h3>
                                    <p className="text-xs text-zinc-400 mb-3">
                                        No driver had enough capacity for these orders. They remain pending and require manual action.
                                    </p>
                                    <div className="space-y-1.5">
                                        {distribution.skippedOrders.map((order, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm text-zinc-300">
                                                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                                <span className="text-zinc-400">Zone {order.zone}:</span>
                                                <span>{order.pickup || ''}{order.pickup && order.delivery ? ' → ' : ''}{order.delivery || ''}</span>
                                                <span className="text-amber-300 font-medium">({order.pallets}p)</span>
                                                {order.do_number && (
                                                    <span className="text-zinc-500">DO: {order.do_number}</span>
                                                )}
                                                {order.priority === 'high' && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">HIGH</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Zone Summary */}
                    {(() => {
                        const zoneSummary = new Map<string, { orders: number; pallets: number }>();
                        for (const a of distribution.assignments || []) {
                            for (const order of a.orders) {
                                const zone = order.zone || 'Unknown';
                                const existing = zoneSummary.get(zone) || { orders: 0, pallets: 0 };
                                existing.orders += 1;
                                existing.pallets += order.pallets || 0;
                                if (order.ctn_amount && order.ctn_to_pallet_ratio && order.ctn_to_pallet_ratio > 0) {
                                    existing.pallets += Math.ceil(order.ctn_amount / order.ctn_to_pallet_ratio);
                                }
                                zoneSummary.set(zone, existing);
                            }
                        }
                        // Also include skipped orders
                        for (const order of distribution.skippedOrders || []) {
                            const zone = order.zone || 'Unknown';
                            const existing = zoneSummary.get(zone) || { orders: 0, pallets: 0 };
                            existing.orders += 1;
                            existing.pallets += order.pallets || 0;
                            if (order.ctn_amount && order.ctn_to_pallet_ratio && order.ctn_to_pallet_ratio > 0) {
                                existing.pallets += Math.ceil(order.ctn_amount / order.ctn_to_pallet_ratio);
                            }
                            zoneSummary.set(zone, existing);
                        }
                        const sorted = Array.from(zoneSummary.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                        if (sorted.length === 0) return null;
                        return (
                            <div className="card">
                                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-orange-400" />
                                    <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Zone Summary</h2>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">{sorted.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 p-4">
                                    {sorted.map(([zone, stats]) => (
                                        <div key={zone} className="px-4 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg">
                                            <p className="text-sm font-semibold text-white">{zone}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-zinc-400">
                                                    <span className="text-emerald-400 font-medium">{stats.orders}</span> order{stats.orders !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-xs text-zinc-400">
                                                    <span className="text-purple-400 font-medium">{stats.pallets}</span> pallet{stats.pallets !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

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
                                {/* Mark All Delivered */}
                                {distribution.assignments.some(a => !a.isDelivered) && (
                                    confirmMarkAll ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-400">Mark all as delivered?</span>
                                            <button
                                                onClick={handleMarkAllDelivered}
                                                disabled={isMarkingAll}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                            >
                                                {isMarkingAll ? <><RefreshCw className="w-3 h-3 animate-spin" /> Marking…</> : 'Confirm'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmMarkAll(false)}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmMarkAll(true)}
                                            disabled={isMarkingAll}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                                        >
                                            <PackageCheck className="w-3 h-3" />
                                            Mark All Delivered
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={handleSendWhatsApp}
                                    disabled={isSending}
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
                            const pendingAssignments = (distribution.assignments || []).filter(a => !a.isDelivered);
                            const deliveredAssignments = (distribution.assignments || []).filter(a => a.isDelivered);
                            return (
                                <div className="space-y-3">
                                    {pendingAssignments.map((assignment, index) => (
                                        <DriverListItem
                                            key={assignment.driver.id}
                                            assignment={assignment}
                                            index={index}
                                            onMarkDelivered={handleMarkDelivered}
                                            initialDelivered={false}
                                            phone={driverPhones[assignment.driver.id]}
                                            sendState={wa.sendStates[assignment.driver.id]}
                                            onSend={() => {
                                                const phone = driverPhones[assignment.driver.id];
                                                const message = formatDriverAssignmentMessage(assignment);
                                                wa.sendMessage(phone, message, assignment.driver.id, `Sent assignment to ${assignment.driver.name}`);
                                            }}
                                        />
                                    ))}
                                    {deliveredAssignments.length > 0 && (
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
                    <div className="flex items-center justify-between py-3 px-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
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
