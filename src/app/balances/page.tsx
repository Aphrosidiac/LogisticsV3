'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Package,
  MapPin,
  Truck,
  X,
  Clock,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getAllPendingBalances,
  getBalanceStatistics,
  cancelBalance,
  rescheduleBalance,
} from '@/lib/balances';
import type { PendingBalance } from '@/types';
import Modal from '@/components/Modal';

function formatDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Convert YYYY-MM-DD to DD/MM/YYYY
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function BalancesPage() {
  const [balances, setBalances] = useState<PendingBalance[]>([]);
  const [statistics, setStatistics] = useState<
    Array<{ date: string; count: number; totalQuantity: number; zones: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedBalance, setSelectedBalance] = useState<PendingBalance | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newScheduledDate, setNewScheduledDate] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    setLoading(true);
    try {
      const [balancesData, statsData] = await Promise.all([
        getAllPendingBalances(),
        getBalanceStatistics(),
      ]);
      setBalances(balancesData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBalance = async (balanceId: string) => {
    setActionLoading(true);
    const result = await cancelBalance(balanceId);
    setActionLoading(false);
    setConfirmCancelId(null);
    if (result.success) {
      showToast('success', 'Balance cancelled');
      loadBalances();
    } else {
      showToast('error', result.error || 'Failed to cancel balance');
    }
  };

  const handleReschedule = async () => {
    if (!selectedBalance || !newScheduledDate) return;
    setActionLoading(true);
    const result = await rescheduleBalance(selectedBalance.id, newScheduledDate);
    setActionLoading(false);
    if (result.success) {
      // Remove balance immediately from local state — it's now cancelled
      setBalances(prev => prev.filter(b => b.id !== selectedBalance.id));
      showToast('success', 'Balance rescheduled — order returned to distribution');
      setShowRescheduleModal(false);
      setSelectedBalance(null);
      setNewScheduledDate('');
      loadBalances();
    } else {
      showToast('error', result.error || 'Failed to reschedule balance');
    }
  };

  const openRescheduleModal = (balance: PendingBalance) => {
    setSelectedBalance(balance);
    setNewScheduledDate('');
    setShowRescheduleModal(true);
  };

  // Group balances by scheduled date
  const balancesByDate = balances.reduce((acc, balance) => {
    const date = balance.scheduled_for_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(balance);
    return acc;
  }, {} as Record<string, PendingBalance[]>);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'fulfilled':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'cancelled':
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/20 border border-red-500/40 text-red-300'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Pending Balances
          </h1>
          <p className="text-zinc-500">
            Track partial fulfillments and schedule next-day deliveries
          </p>
        </div>
        <button
          onClick={loadBalances}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Pending</p>
              <p className="text-3xl font-bold text-white">{balances.length}</p>
            </div>
            <div className="bg-orange-500/20 rounded-full p-3">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Quantity</p>
              <p className="text-3xl font-bold text-white">
                {balances.reduce((sum, b) => sum + b.remaining_quantity, 0)}
              </p>
            </div>
            <div className="bg-blue-500/20 rounded-full p-3">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-400">Scheduled Dates</p>
              <p className="text-3xl font-bold text-white">
                {Object.keys(balancesByDate).length}
              </p>
            </div>
            <div className="bg-emerald-500/20 rounded-full p-3">
              <Calendar className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Date Statistics */}
      {statistics.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Scheduled Dates Overview</h2>
          <div className="space-y-4">
            {statistics.map((stat) => (
              <div
                key={stat.date}
                className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <span className="font-medium text-white">{formatDate(stat.date)}</span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">
                    Zones: {stat.zones.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-white">
                    {stat.totalQuantity} pallets
                  </p>
                  <p className="text-sm text-zinc-400">{stat.count} balances</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balances by Date */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-zinc-400">Loading balances...</p>
          </div>
        </div>
      ) : balances.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Pending Balances
          </h3>
          <p className="text-zinc-400">
            All orders have been fully distributed
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(balancesByDate)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, dateBalances]) => (
              <div key={date} className="card overflow-hidden">
                <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-semibold text-white">{formatDate(date)}</h3>
                    </div>
                    <span className="text-sm text-zinc-400">
                      {dateBalances.length} balance{dateBalances.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-zinc-700">
                  {dateBalances.map((balance) => (
                    <div key={balance.id} className="p-6 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-semibold text-lg text-white">
                              Zone {balance.zone}
                            </span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                balance.status
                              )}`}
                            >
                              {balance.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500">Remaining Quantity</p>
                              <p className="font-medium text-zinc-200">
                                {balance.remaining_quantity} / {balance.original_quantity}{' '}
                                pallets
                              </p>
                            </div>

                            <div>
                              <p className="text-zinc-500">Original Date</p>
                              <p className="font-medium text-zinc-200">{formatDate(balance.original_date)}</p>
                            </div>

                            {balance.pickup && (
                              <div>
                                <p className="text-zinc-500">Pickup</p>
                                <p className="font-medium text-zinc-200 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {balance.pickup}
                                </p>
                              </div>
                            )}

                            {balance.delivery && (
                              <div>
                                <p className="text-zinc-500">Delivery</p>
                                <p className="font-medium text-zinc-200 flex items-center gap-1">
                                  <Truck className="w-3 h-3" />
                                  {balance.delivery}
                                </p>
                              </div>
                            )}

                            {balance.do_number && (
                              <div>
                                <p className="text-zinc-500">DO Number</p>
                                <p className="font-medium text-zinc-200">{balance.do_number}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4 flex-shrink-0">
                          <button
                            onClick={() => openRescheduleModal(balance)}
                            className="btn-primary text-sm"
                          >
                            Reschedule
                          </button>
                          {confirmCancelId === balance.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-zinc-400 mr-1">Confirm?</span>
                              <button
                                onClick={() => handleCancelBalance(balance.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmCancelId(null)}
                                className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCancelId(balance.id)}
                              className="btn-danger text-sm"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedBalance && (
        <Modal
          isOpen={showRescheduleModal}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedBalance(null);
          }}
          title="Reschedule Balance"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-zinc-400 mb-2">Balance Details</p>
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 space-y-1">
                <p className="font-medium text-white">Zone {selectedBalance.zone}</p>
                <p className="text-sm text-zinc-400">
                  {selectedBalance.remaining_quantity} pallets
                </p>
                <p className="text-sm text-zinc-500">
                  Currently scheduled: <span className="text-zinc-300">{formatDate(selectedBalance.scheduled_for_date)}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                New Scheduled Date
              </label>
              <input
                type="date"
                value={newScheduledDate}
                onChange={(e) => setNewScheduledDate(e.target.value)}
                className="input w-full"
              />
              {newScheduledDate && newScheduledDate === selectedBalance.scheduled_for_date && (
                <p className="text-xs text-amber-400 mt-1.5">Date is the same as current — pick a different date to reschedule.</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedBalance(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={actionLoading || !newScheduledDate}
                className="btn-primary disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Reschedule'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
