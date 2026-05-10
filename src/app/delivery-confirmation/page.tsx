'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Calendar,
  Truck,
  Package,
  Upload,
  Check,
  RefreshCw,
  Image,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import * as db from '@/lib/db-supabase';
import { uploadDeliveryPhoto, deleteDeliveryPhoto } from '@/lib/storage';
import type { Order, Driver } from '@/types';
import { getLocalDate } from '@/lib/utils';

interface DriverGroup {
  driver: Driver;
  orders: Order[];
}

export default function DeliveryConfirmationPage() {
  const [date, setDate] = useState(getLocalDate());
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingOrder, setUploadingOrder] = useState<string | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
  const [uploadedPhotos, setUploadedPhotos] = useState<Map<string, string[]>>(new Map());

  useEffect(() => { loadData(); }, [date]);

  async function loadData() {
    setLoading(true);
    try {
      const [ordersData, driversData] = await Promise.all([
        db.getOrdersForDeliveryPage(date),
        db.getAllDrivers(),
      ]);
      setOrders(ordersData);
      setDrivers(driversData);

      // Pre-fill already uploaded photos
      const existing = new Map<string, string[]>();
      for (const o of ordersData) {
        if (o.delivery_photo_urls && o.delivery_photo_urls.length > 0) {
          existing.set(o.id, o.delivery_photo_urls);
        }
      }
      setUploadedPhotos(existing);

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

  function toggleDriverExpand(driverId: string) {
    setExpandedDrivers(prev => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  }

  async function handlePhotoUpload(orderId: string, file: File) {
    setUploadingOrder(orderId);
    try {
      const result = await uploadDeliveryPhoto(orderId, file);
      if (result.success && result.url) {
        const currentPhotos = uploadedPhotos.get(orderId) || [];
        const newPhotos = [...currentPhotos, result.url];
        setUploadedPhotos(prev => new Map(prev).set(orderId, newPhotos));

        // Save to DB and mark as delivered
        await db.markOrderAsDelivered(orderId, newPhotos);

        // Update local state
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, delivery_photo_urls: newPhotos, status: 'completed' as const, delivered_at: new Date().toISOString() } : o
        ));
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingOrder(null);
    }
  }

  async function removePhoto(orderId: string, photoUrl: string) {
    const current = uploadedPhotos.get(orderId) || [];
    const updated = current.filter(u => u !== photoUrl);
    setUploadedPhotos(prev => new Map(prev).set(orderId, updated));

    try {
      await deleteDeliveryPhoto(photoUrl);
      await db.updateDeliveryPhotos(orderId, updated);

      setOrders(prev => prev.map(o =>
        o.id === orderId ? {
          ...o,
          delivery_photo_urls: updated,
          status: updated.length === 0 ? 'picked_up' as const : o.status,
          delivered_at: updated.length === 0 ? undefined : o.delivered_at,
        } : o
      ));
    } catch (err) {
      console.error('Failed to persist photo removal:', err);
      setUploadedPhotos(prev => new Map(prev).set(orderId, current));
    }
  }

  const totalOrders = orders.length;
  const deliveredCount = orders.filter(o => o.status === 'completed' || (uploadedPhotos.get(o.id)?.length ?? 0) > 0).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <Camera className="w-7 h-7 text-emerald-400" />
              Delivery Confirmation
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Upload proof of delivery photos for completed orders</p>
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
            <span className="text-emerald-400">{deliveredCount} delivered</span>
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
            <p className="text-zinc-500">No assigned/picked-up orders for this date</p>
          </div>
        )}

        {/* Driver Groups */}
        {!loading && driverGroups.map(group => {
          const isExpanded = expandedDrivers.has(group.driver.id);

          return (
            <div key={group.driver.id} className="mb-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Driver Header */}
              <button
                onClick={() => toggleDriverExpand(group.driver.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  <div className="text-left">
                    <span className="font-semibold text-zinc-100">{group.driver.name}</span>
                    {group.driver.identifier && <span className="text-xs text-zinc-500 ml-2">({group.driver.identifier})</span>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    {group.orders.length} orders
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-zinc-800 px-5 py-3 space-y-3">
                  {group.orders.map(order => {
                    const photos = uploadedPhotos.get(order.id) || [];
                    const hasPhotos = photos.length > 0;
                    const isUploading = uploadingOrder === order.id;
                    const isDelivered = order.status === 'completed';
                    const unitLabel = (order.measurement_unit || 'CTN').toLowerCase();
                    const qty = order.ctn_amount ? `${order.pallets}p + ${order.ctn_amount}${unitLabel}` : `${order.pallets} pallet${order.pallets > 1 ? 's' : ''}`;

                    return (
                      <div
                        key={order.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isDelivered ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-700/50'
                        }`}
                      >
                        {/* Order Info */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-zinc-200">{order.do_number || 'No DO'}</span>
                            <span className="text-xs text-zinc-500">{order.delivery_company || order.delivery || 'N/A'}</span>
                            <span className="text-xs text-zinc-600">{qty}</span>
                            {order.is_oversized && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">PANJANG</span>}
                          </div>
                          {isDelivered && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <Check className="w-3 h-3" /> Delivered
                            </span>
                          )}
                        </div>

                        {/* Photos */}
                        {hasPhotos && (
                          <div className="flex gap-2 mb-3 flex-wrap">
                            {photos.map((url, i) => (
                              <div key={i} className="relative group">
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`POD ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-zinc-700 hover:border-emerald-500/50 transition-colors" />
                                </a>
                                <button
                                  onClick={() => removePhoto(order.id, url)}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-zinc-400" />
                                </button>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ExternalLink className="w-3 h-3 text-white drop-shadow" />
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload Button */}
                        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                          isUploading ? 'bg-zinc-700 text-zinc-500' : 'bg-zinc-800 border border-dashed border-zinc-600 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400'
                        }`}>
                          {isUploading ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                          ) : hasPhotos ? (
                            <><Image className="w-4 h-4" /> Add another photo</>
                          ) : (
                            <><Upload className="w-4 h-4" /> Upload delivery photo</>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={isUploading}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handlePhotoUpload(order.id, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
