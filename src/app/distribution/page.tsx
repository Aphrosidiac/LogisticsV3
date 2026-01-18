'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { calculateDistribution } from '@/lib/distribution';
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
} from 'lucide-react';
import Link from 'next/link';

export default function DistributionPage() {
    const { cache, dispatch, addLog } = useApp();
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasData = cache.orders.length > 0 && cache.drivers.length > 0;
    const distribution = cache.lastDistribution;

    const handleCalculate = () => {
        if (!hasData) return;

        setIsCalculating(true);
        setError(null);

        try {
            addLog('info', 'Calculating distribution...');

            const result = calculateDistribution(cache.orders, cache.drivers);

            dispatch({ type: 'SET_DISTRIBUTION', payload: result });

            addLog(
                'success',
                `Distribution calculated: ${result.summary.assignedDrivers} drivers assigned to ${result.summary.totalZones} zones`
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to calculate distribution';
            setError(message);
            addLog('error', 'Distribution calculation failed', message);
        } finally {
            setIsCalculating(false);
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
                        Import orders from Google Sheets before calculating distribution
                    </p>
                    <Link href="/sheets" className="btn-primary inline-flex items-center gap-2">
                        Import Data
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* Distribution Results */}
            {distribution && (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    </div>

                    {/* Distribution Info */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Distribution Info</h2>
                        <div className="flex items-center gap-6 text-sm text-zinc-400">
                            <div>
                                <span className="text-zinc-500">Calculated at:</span>{' '}
                                <span className="text-zinc-200">
                                    {new Date(distribution.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Algorithm:</span>{' '}
                                <span className="text-zinc-200">Zone-Based Pallet Balancing</span>
                            </div>
                        </div>
                    </div>

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
                    <div className="card p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Ready to Notify?</h3>
                                <p className="text-zinc-400 text-sm">
                                    Share this distribution with your admin team
                                </p>
                            </div>
                            <Link href="/admin" className="btn-primary flex items-center gap-2">
                                Go to Admin Settings
                                <ArrowRight className="w-4 h-4" />
                            </Link>
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
                    <p className="text-sm text-zinc-600 mb-6">
                        Click the button above to calculate zone-based distribution
                    </p>
                </div>
            )}
        </div>
    );
}
