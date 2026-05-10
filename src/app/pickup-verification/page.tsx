'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Calendar,
  Truck,
  Package,
  Check,
  X,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as db from '@/lib/db-supabase';
import { formatPickupVerificationMessage } from '@/lib/distribution';
import { sendWhatsAppMessage, getWhatsAppState } from '@/lib/whatsapp-client';
import type { Order, Driver } from '@/types';
import { getLocalDate } from '@/lib/utils';

interface DriverGroup {
  driver: Driver;
  orders: Order[];
}

export default function PickupVerificationPage() {
  const [date, setDate] = useState(getLocalDate());
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
  const [waConnected, setWaConnected] = useState(false);

  useEffect(() => { loadData(); }, [date]);

  async function loadData() {
    setLoading(true);
    try {
      const [ordersData, driversData, waState] = await Promise.all([
        db.getAssignedOrdersForDate(date),
        db.getAllDrivers(),
        getWhatsAppState().catch(() => ({ connected: false })),
      ]);
      setOrders(ordersData);
      setDrivers(driversData);
      setWaConnected(waState.connected);

      // Pre-check already verified orders
      const alreadyVerified = new Set<string>();
      for (const o of ordersData) {
        if (o.pickup_verified) alreadyVerified.add(o.id);
      }
      setVerifiedIds(alreadyVerified);

      // Expand all drivers by default
      const driverIds = new Set(ordersData.map(o => o.assigned_driver_id).filter(Boolean) as string[]);
      setExpandedDrivers(driverIds);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  const driverMap = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);

  const driverGroups: DriverGroup[] = useMemo(() => {
    const groups = new Map<string, Order[]>();
    for (const order of orders) {
      const driverId = order.assigned_driver_id || 'unassigned';
      if (!groups.has(driverId)) groups.set(driverId, []);
      groups.get(driverId)!.push(order);
    }
    return Array.from(groups.entries()).map(([driverId, driverOrders]) => ({
      driver: driverMap[driverId] || { id: driverId, name: 'Unknown Driver', identifier: '' },
      orders: driverOrders,
    })).sort((a, b) => a.driver.name.localeCompare(b.driver.name));
  }, [orders, driverMap]);

  function toggleOrder(orderId: string) {
    setVerifiedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAllForDriver(driverOrders: Order[]) {
    const allChecked = driverOrders.every(o => verifiedIds.has(o.id));
    setVerifiedIds(prev => {
      const next = new Set(prev);
      for (const o of driverOrders) {
        if (allChecked) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  function toggleDriverExpand(driverId: string) {
    setExpandedDrivers(prev => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  }

  async function handleVerify(group: DriverGroup) {
    setSaving(group.driver.id);
    try {
      const collectedIds = group.orders.filter(o => verifiedIds.has(o.id)).map(o => o.id);
      const notCollectedIds = group.orders.filter(o => !verifiedIds.has(o.id)).map(o => o.id);

      // Mark collected orders as picked_up
      if (collectedIds.length > 0) {
        await db.markOrdersAsPickedUp(collectedIds, 'admin');
      }

      // Mark not-collected orders
      if (notCollectedIds.length > 0) {
        await db.markOrdersAsNotCollected(notCollectedIds, 'admin');
      }

      // Send WhatsApp verification message
      if (waConnected) {
        const verifiedMap = new Map<string, boolean>();
        for (const o of group.orders) {
          verifiedMap.set(o.id, verifiedIds.has(o.id));
        }
        const message = formatPickupVerificationMessage(date, group.orders, verifiedMap);

        // Send to admin numbers
        const config = await db.getConfig();
        const adminNumbers = config.adminNumbers || [];
        for (const phone of adminNumbers) {
          await sendWhatsAppMessage(phone, message);
        }
      }

      await loadData();
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      setSaving(null);
    }
  }

  const totalOrders = orders.length;
  const verifiedCount = orders.filter(o => o.pickup_verified || o.status === 'picked_up').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <ClipboardCheck className="w-7 h-7 text-cyan-400" />
              Pickup Verification
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Mark orders as collected after driver pickup</p>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Date Picker + Stats */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-zinc-200 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>{totalOrders} orders</span>
            <span className="text-cyan-400">{verifiedCount} verified</span>
            {waConnected && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> WhatsApp</span>}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading orders...
          </div>
        )}

        {/* Empty State */}
        {!loading && driverGroups.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No assigned orders for this date</p>
          </div>
        )}

        {/* Driver Groups */}
        {!loading && driverGroups.map(group => {
          const isExpanded = expandedDrivers.has(group.driver.id);
          const allChecked = group.orders.every(o => verifiedIds.has(o.id));
          const someChecked = group.orders.some(o => verifiedIds.has(o.id));
          const isSaving = saving === group.driver.id;
          const allAlreadyVerified = group.orders.every(o => o.status === 'picked_up');

          // Group orders by delivery_company
          const byCompany = new Map<string, Order[]>();
          for (const o of group.orders) {
            const company = o.delivery_company || o.delivery || 'Unknown';
            if (!byCompany.has(company)) byCompany.set(company, []);
            byCompany.get(company)!.push(o);
          }

          return (
            <div key={group.driver.id} className="mb-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Driver Header */}
              <button
                onClick={() => toggleDriverExpand(group.driver.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <div className="text-left">
                    <span className="font-semibold text-zinc-100">{group.driver.name}</span>
                    {group.driver.identifier && <span className="text-xs text-zinc-500 ml-2">({group.driver.identifier})</span>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    {group.orders.length} orders
                  </span>
                  {allAlreadyVerified && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                      Verified
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-zinc-800">
                  {/* Select All */}
                  <div className="px-5 py-2 flex items-center justify-between bg-zinc-800/30">
                    <button
                      onClick={() => toggleAllForDriver(group.orders)}
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        allChecked ? 'bg-cyan-500 border-cyan-500' : someChecked ? 'bg-zinc-700 border-zinc-600' : 'border-zinc-600'
                      }`}>
                        {allChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {allChecked ? 'Unselect all' : 'Select all'}
                    </button>
                  </div>

                  {/* Orders grouped by delivery company */}
                  <div className="px-5 py-3 space-y-4">
                    {Array.from(byCompany.entries()).map(([company, companyOrders]) => (
                      <div key={company}>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{company}</h4>
                        <div className="space-y-1.5">
                          {companyOrders.map(order => {
                            const isChecked = verifiedIds.has(order.id);
                            const unitLabel = (order.measurement_unit || 'CTN').toLowerCase();
                            const qty = order.ctn_amount ? `${order.pallets}p + ${order.ctn_amount}${unitLabel}` : `${order.pallets} pallet${order.pallets > 1 ? 's' : ''}`;

                            return (
                              <button
                                key={order.id}
                                onClick={() => toggleOrder(order.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                                  isChecked ? 'bg-cyan-500/5 border border-cyan-500/20' : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-600'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-zinc-200 font-mono">{order.do_number || 'No DO'}</span>
                                    {order.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25">HIGH</span>}
                                    {order.is_oversized && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">PANJANG</span>}
                                  </div>
                                  <p className="text-xs text-zinc-500 truncate">{qty} &middot; {order.zone}</p>
                                </div>
                                {isChecked ? (
                                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-zinc-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Verify Button */}
                  <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleVerify(group)}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {isSaving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {isSaving ? 'Saving...' : 'Verify Pickup'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
