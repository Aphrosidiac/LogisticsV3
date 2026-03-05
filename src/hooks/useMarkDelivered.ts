'use client';

import { useState, useCallback } from 'react';
import * as db from '@/lib/db-supabase';
import type { DriverAssignment } from '@/types';

interface UseMarkDeliveredResult {
  deliveredDrivers: Set<string>;
  markingDriverId: string | null;
  markDelivered: (assignment: DriverAssignment, onOrdersUpdated?: (orders: any[]) => void) => Promise<void>;
}

export function useMarkDelivered(
  addLog?: (type: 'info' | 'success' | 'error' | 'warning', message: string, details?: string) => void
): UseMarkDeliveredResult {
  const [deliveredDrivers, setDeliveredDrivers] = useState<Set<string>>(new Set());
  const [markingDriverId, setMarkingDriverId] = useState<string | null>(null);

  const markDelivered = useCallback(async (
    assignment: DriverAssignment,
    onOrdersUpdated?: (orders: any[]) => void,
  ) => {
    const driverId = assignment.driver.id;
    const orderIds = assignment.orders.map(o => o.id).filter(Boolean);
    if (orderIds.length === 0) return;

    setMarkingDriverId(driverId);
    try {
      await db.markOrdersAsCompleted(orderIds, driverId);
      const updatedOrders = await db.getAllOrders();
      onOrdersUpdated?.(updatedOrders);
      setDeliveredDrivers(prev => new Set([...prev, driverId]));
      addLog?.('success', `Marked ${orderIds.length} order(s) as completed for ${assignment.driver.name}`);
    } catch (err: any) {
      addLog?.('error', `Failed to mark delivered for ${assignment.driver.name}`, err.message);
    } finally {
      setMarkingDriverId(null);
    }
  }, [addLog]);

  return { deliveredDrivers, markingDriverId, markDelivered };
}
