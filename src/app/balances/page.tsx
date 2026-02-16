'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Package,
  MapPin,
  Truck,
  AlertCircle,
  X,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  getAllPendingBalances,
  getBalanceStatistics,
  cancelBalance,
  rescheduleBalance,
} from '@/lib/balances';
import type { PendingBalance } from '@/types';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';

export default function BalancesPage() {
  const router = useRouter();
  const [balances, setBalances] = useState<PendingBalance[]>([]);
  const [statistics, setStatistics] = useState<
    Array<{ date: string; count: number; totalQuantity: number; zones: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedBalance, setSelectedBalance] = useState<PendingBalance | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newScheduledDate, setNewScheduledDate] = useState('');

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
    if (!confirm('Are you sure you want to cancel this balance?')) return;

    const result = await cancelBalance(balanceId);
    if (result.success) {
      alert('Balance cancelled successfully');
      loadBalances();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleReschedule = async () => {
    if (!selectedBalance || !newScheduledDate) return;

    const result = await rescheduleBalance(selectedBalance.id, newScheduledDate);
    if (result.success) {
      alert('Balance rescheduled successfully');
      setShowRescheduleModal(false);
      setSelectedBalance(null);
      setNewScheduledDate('');
      loadBalances();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const openRescheduleModal = (balance: PendingBalance) => {
    setSelectedBalance(balance);
    setNewScheduledDate(balance.scheduled_for_date);
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
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Pending Balances
            </h1>
            <p className="text-gray-600">
              Track partial fulfillments and schedule next-day deliveries
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Pending</p>
                  <p className="text-3xl font-bold text-gray-900">{balances.length}</p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {balances.reduce((sum, b) => sum + b.remaining_quantity, 0)}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scheduled Dates</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Object.keys(balancesByDate).length}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Date Statistics */}
          {statistics.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-8 p-6">
              <h2 className="text-lg font-semibold mb-4">Scheduled Dates Overview</h2>
              <div className="space-y-4">
                {statistics.map((stat) => (
                  <div
                    key={stat.date}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{stat.date}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Zones: {stat.zones.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {stat.totalQuantity} pallets
                      </p>
                      <p className="text-sm text-gray-600">{stat.count} balances</p>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading balances...</p>
              </div>
            </div>
          ) : balances.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Pending Balances
              </h3>
              <p className="text-gray-600">
                All orders have been fully distributed
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(balancesByDate)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, dateBalances]) => (
                  <div key={date} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-gray-100 px-6 py-4 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-gray-600" />
                          <h3 className="text-lg font-semibold">{date}</h3>
                        </div>
                        <span className="text-sm text-gray-600">
                          {dateBalances.length} balance{dateBalances.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y">
                      {dateBalances.map((balance) => (
                        <div key={balance.id} className="p-6 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="font-semibold text-lg">
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
                                  <p className="text-gray-600">Remaining Quantity</p>
                                  <p className="font-medium">
                                    {balance.remaining_quantity} / {balance.original_quantity}{' '}
                                    pallets
                                  </p>
                                </div>

                                <div>
                                  <p className="text-gray-600">Original Date</p>
                                  <p className="font-medium">{balance.original_date}</p>
                                </div>

                                {balance.pickup && (
                                  <div>
                                    <p className="text-gray-600">Pickup</p>
                                    <p className="font-medium flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {balance.pickup}
                                    </p>
                                  </div>
                                )}

                                {balance.delivery && (
                                  <div>
                                    <p className="text-gray-600">Delivery</p>
                                    <p className="font-medium flex items-center gap-1">
                                      <Truck className="w-3 h-3" />
                                      {balance.delivery}
                                    </p>
                                  </div>
                                )}

                                {balance.do_number && (
                                  <div>
                                    <p className="text-gray-600">DO Number</p>
                                    <p className="font-medium">{balance.do_number}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => openRescheduleModal(balance)}
                                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelBalance(balance.id)}
                                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

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
              <p className="text-sm text-gray-600 mb-2">Balance Details</p>
              <div className="bg-gray-50 p-4 rounded">
                <p className="font-medium">Zone {selectedBalance.zone}</p>
                <p className="text-sm text-gray-600">
                  {selectedBalance.remaining_quantity} pallets
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Scheduled Date
              </label>
              <input
                type="date"
                value={newScheduledDate}
                onChange={(e) => setNewScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedBalance(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reschedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
