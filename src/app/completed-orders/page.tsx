'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  Package,
  MapPin,
  User,
  Clock,
  CheckCircle,
  FileText,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import DOViewerModal from '@/components/DOViewerModal';
import { getCompletedOrders, formatCompletedDate, type CompletedOrder } from '@/lib/completed-orders';
import * as db from '@/lib/db-supabase';
import { formatDisplayDate } from '@/lib/utils';

export default function CompletedOrdersPage() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [driverMap, setDriverMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewingDO, setViewingDO] = useState<{ url: string; filename: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [sortField, setSortField] = useState<'completed_date' | 'zone' | 'pallets'>('completed_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => { loadCompletedOrders(); }, []);
  useEffect(() => { setPage(1); }, [searchTerm, zoneFilter, driverFilter, dateStart, dateEnd, sortField, sortDir]);

  const loadCompletedOrders = async () => {
    setLoading(true);
    try {
      const [completedOrders, drivers] = await Promise.all([
        getCompletedOrders(),
        db.getAllDrivers(),
      ]);
      setOrders(completedOrders);
      setDriverMap(Object.fromEntries(drivers.map(d => [d.id, d.name])));
    } catch {
      // silently fail — empty state handled in UI
    } finally {
      setLoading(false);
    }
  };

  const uniqueZones = useMemo(() => Array.from(new Set(orders.map(o => o.zone))).sort(), [orders]);
  const uniqueDriverIds = useMemo(
    () => Array.from(new Set(orders.map(o => o.assigned_driver_id).filter(Boolean) as string[])),
    [orders]
  );

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.zone?.toLowerCase().includes(q) ||
        o.delivery?.toLowerCase().includes(q) ||
        o.do_number?.toLowerCase().includes(q) ||
        o.invoice?.toLowerCase().includes(q)
      );
    }
    if (zoneFilter) result = result.filter(o => o.zone === zoneFilter);
    if (driverFilter) result = result.filter(o => o.assigned_driver_id === driverFilter);
    if (dateStart) result = result.filter(o => o.completed_date >= dateStart);
    if (dateEnd) result = result.filter(o => o.completed_date <= dateEnd + 'T23:59:59');

    result.sort((a, b) => {
      let av: any, bv: any;
      if (sortField === 'completed_date') { av = a.completed_date; bv = b.completed_date; }
      else if (sortField === 'zone') { av = a.zone?.toLowerCase(); bv = b.zone?.toLowerCase(); }
      else { av = a.pallets; bv = b.pallets; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [orders, searchTerm, zoneFilter, driverFilter, dateStart, dateEnd, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOrders.length / pageSize));
  const pagedOrders = filteredAndSortedOrders.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    totalPallets: orders.reduce((s, o) => s + (o.pallets || 0), 0),
    uniqueZones: new Set(orders.map(o => o.zone)).size,
    uniqueDrivers: new Set(orders.map(o => o.assigned_driver_id).filter(Boolean)).size,
  }), [orders]);

  const hasFilters = !!(searchTerm || zoneFilter || driverFilter || dateStart || dateEnd);

  function clearFilters() {
    setSearchTerm(''); setZoneFilter(''); setDriverFilter(''); setDateStart(''); setDateEnd('');
  }

  function handleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const exportToCSV = () => {
    const headers = ['DO Number', 'Invoice', 'Zone', 'Pickup', 'Delivery', 'Pallets', 'Priority', 'Order Date', 'Completed Date', 'Driver'];
    const csvData = filteredAndSortedOrders.map(order => [
      order.do_number || '',
      order.invoice || '',
      order.zone,
      order.pickup || '',
      order.delivery || '',
      order.pallets.toString(),
      order.priority || 'standard',
      formatDisplayDate(order.date),
      formatCompletedDate(order.completed_date),
      order.assigned_driver_id ? (driverMap[order.assigned_driver_id] || order.assigned_driver_id) : '',
    ]);
    const csvContent = [headers, ...csvData].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `completed-orders-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Completed Orders</h1>
        <p className="text-zinc-400">View and search through past completed deliveries</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Total Completed</p>
              <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Total Pallets</p>
              <p className="text-2xl font-bold text-white">{stats.totalPallets}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Zones Served</p>
              <p className="text-2xl font-bold text-white">{stats.uniqueZones}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Active Drivers</p>
              <p className="text-2xl font-bold text-white">{stats.uniqueDrivers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by zone, delivery, DO number, or invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 border border-emerald-600 rounded-lg text-white hover:bg-emerald-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={loadCompletedOrders}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Zone</label>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">All Zones</option>
                  {uniqueZones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Driver</label>
                <select
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">All Drivers</option>
                  {uniqueDriverIds.map(id => <option key={id} value={id}>{driverMap[id] || id}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary + Sort */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-400">
          Showing {filteredAndSortedOrders.length} of {orders.length} completed orders
        </p>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Sort by:</span>
          {(['completed_date', 'zone', 'pallets'] as const).map(f => (
            <button
              key={f}
              onClick={() => handleSort(f)}
              className={`px-2 py-1 rounded ${sortField === f ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-800'}`}
            >
              {f === 'completed_date' ? 'Completed Date' : f === 'zone' ? 'Zone' : 'Pallets'}
              {sortField === f && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Order Info</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">DO Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {pagedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-400" />
                        <span className="text-white font-medium">{order.do_number || 'No DO #'}</span>
                      </div>
                      {order.invoice && <p className="text-sm text-zinc-400">Invoice: {order.invoice}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-zinc-400" />
                        <span className="text-white">{order.zone}</span>
                      </div>
                      {order.delivery && <p className="text-sm text-zinc-400">{order.delivery}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-zinc-400" />
                        <span className="text-white font-medium">{order.pallets} pallets</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        order.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {order.priority || 'standard'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-400">Order: {formatDisplayDate(order.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Completed: {formatCompletedDate(order.completed_date)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-zinc-400" />
                      <span className="text-white">
                        {order.assigned_driver_id
                          ? (driverMap[order.assigned_driver_id] || order.assigned_driver_id)
                          : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-400 font-medium">Completed</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {order.attachment_urls?.[0] ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingDO({ url: order.attachment_urls![0], filename: order.attachment_urls![0] })}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                        >
                          <Eye className="w-3 h-3" /> View DO
                        </button>
                        <a
                          href={order.attachment_urls![0]}
                          download target="_blank" rel="noopener noreferrer"
                          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedOrders.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No completed orders found</h3>
            <p className="text-zinc-400">
              {hasFilters ? 'Try adjusting your search or filters' : 'No orders have been completed yet'}
            </p>
          </div>
        )}

        {/* Pagination footer */}
        {filteredAndSortedOrders.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700 bg-zinc-800/40">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2 text-zinc-500">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredAndSortedOrders.length)} of {filteredAndSortedOrders.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-zinc-500 px-2">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewingDO && (
        <DOViewerModal
          url={viewingDO.url}
          filename={viewingDO.filename}
          onClose={() => setViewingDO(null)}
        />
      )}
    </div>
  );
}
