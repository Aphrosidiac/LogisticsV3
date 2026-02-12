'use client';

import { useApp } from '@/context/AppContext';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import {
  Package,
  Truck,
  Boxes,
  MapPin,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function Dashboard() {
  const { cache, config, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = {
    orders: cache.orders.length,
    drivers: cache.drivers.length,
    pallets: cache.orders.reduce((sum, o) => sum + o.pallets, 0),
    zones: new Set(cache.orders.map((o) => o.zone)).size,
  };

  const hasData = cache.orders.length > 0;
  const hasDistribution = cache.lastDistribution !== null;
  const hasAdmins = config.adminNumbers.length > 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-500 mt-1">
          Overview of your logistics distribution system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={stats.orders}
          icon={Package}
          color="emerald"
          subtitle={cache.lastFetch ? `Last fetched: ${new Date(cache.lastFetch).toLocaleTimeString()}` : 'No data'}
        />
        <StatCard
          title="Active Drivers"
          value={stats.drivers}
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Total Pallets"
          value={stats.pallets}
          icon={Boxes}
          color="purple"
        />
        <StatCard
          title="Zones"
          value={stats.zones}
          icon={MapPin}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/sheets-manager"
            className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              </div>
              <span className="font-medium text-zinc-200">Database Manager</span>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/distribution"
            className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Truck className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="font-medium text-zinc-200">Calculate Distribution</span>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/admin"
            className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Boxes className="w-5 h-5 text-purple-400" />
              </div>
              <span className="font-medium text-zinc-200">Send Notification</span>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </div>

      {/* Status Checklist */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {hasData ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-zinc-500" />
            )}
            <span className={hasData ? 'text-zinc-200' : 'text-zinc-500'}>
              Data imported from Google Sheets
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasDistribution ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-zinc-500" />
            )}
            <span className={hasDistribution ? 'text-zinc-200' : 'text-zinc-500'}>
              Distribution calculated
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasAdmins ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-zinc-500" />
            )}
            <span className={hasAdmins ? 'text-zinc-200' : 'text-zinc-500'}>
              Admin numbers configured ({config.adminNumbers.length})
            </span>
          </div>
        </div>
      </div>

      {/* Last Distribution */}
      {hasDistribution && cache.lastDistribution && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Last Distribution</h2>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Clock className="w-4 h-4" />
              {new Date(cache.lastDistribution.timestamp).toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-400">
                {cache.lastDistribution.summary.totalOrders}
              </p>
              <p className="text-sm text-zinc-500">Orders</p>
            </div>
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <p className="text-2xl font-bold text-purple-400">
                {cache.lastDistribution.summary.totalPallets}
              </p>
              <p className="text-sm text-zinc-500">Pallets</p>
            </div>
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <p className="text-2xl font-bold text-orange-400">
                {cache.lastDistribution.summary.totalZones}
              </p>
              <p className="text-sm text-zinc-500">Zones</p>
            </div>
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <p className="text-2xl font-bold text-blue-400">
                {cache.lastDistribution.summary.assignedDrivers}
              </p>
              <p className="text-sm text-zinc-500">Drivers Assigned</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
