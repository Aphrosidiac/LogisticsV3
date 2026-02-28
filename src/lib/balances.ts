// Pending Balance Tracking System for partial fulfillments
import { supabase, TABLES } from './supabase';
import type { PendingBalance, Order } from '@/types';

/**
 * Create a new pending balance record
 */
export async function createPendingBalance(
  orderId: string,
  remainingQty: number,
  scheduledDate: string,
  distributionId?: string
): Promise<{ success: boolean; balance?: PendingBalance; error?: string }> {
  try {
    // Get original order details
    const { data: order, error: orderError } = await supabase
      .from(TABLES.ORDERS)
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Original order not found' };
    }

    // Create balance record
    const balance: Omit<PendingBalance, 'created_at' | 'updated_at'> = {
      id: crypto.randomUUID(),
      original_order_id: orderId,
      zone: order.zone,
      zone_id: order.zone_id,
      district_id: order.district_id,
      pickup: order.pickup,
      delivery: order.delivery,
      do_number: order.do_number,
      original_quantity: order.pallets,
      fulfilled_quantity: order.pallets - remainingQty,
      remaining_quantity: remainingQty,
      original_date: order.date,
      scheduled_for_date: scheduledDate,
      status: 'pending',
      distribution_id: distributionId,
      raw_data: order.raw_data,
    };

    const { data, error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .insert(balance)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, balance: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all pending balances for a specific date
 */
export async function getPendingBalancesForDate(
  date: string
): Promise<PendingBalance[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .select('*')
      .eq('scheduled_for_date', date)
      .in('status', ['pending', 'scheduled'])
      .order('zone');

    if (error) {
      console.error('Error fetching balances:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching balances:', error);
    return [];
  }
}

/**
 * Get all pending balances (not fulfilled or cancelled)
 */
export async function getAllPendingBalances(): Promise<PendingBalance[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .select('*')
      .in('status', ['pending', 'scheduled'])
      .order('scheduled_for_date', { ascending: true });

    if (error) {
      console.error('Error fetching all balances:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching all balances:', error);
    return [];
  }
}

/**
 * Convert pending balances to orders for distribution
 */
export async function convertBalancesToOrders(
  balances: PendingBalance[]
): Promise<Order[]> {
  return balances.map((balance) => ({
    id: crypto.randomUUID(),
    zone: balance.zone,
    zone_id: balance.zone_id,
    district_id: balance.district_id,
    date: balance.scheduled_for_date,
    priority: 'high', // Balances get high priority
    pallets: balance.remaining_quantity,
    pickup: balance.pickup,
    delivery: balance.delivery,
    do_number: balance.do_number,
    rawData: {
      ...(balance.raw_data || {}),
      _from_balance: 'true',
      _balance_id: balance.id,
      _original_order_id: balance.original_order_id || '',
    },
  }));
}

/**
 * Mark a balance as fulfilled
 */
export async function markBalanceAsFulfilled(
  balanceId: string,
  fulfilledByOrderId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .update({
        status: 'fulfilled',
        fulfilled_by_order_id: fulfilledByOrderId,
      })
      .eq('id', balanceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark a balance as scheduled (part of distribution)
 */
export async function markBalanceAsScheduled(
  balanceId: string,
  distributionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .update({
        status: 'scheduled',
        distribution_id: distributionId,
      })
      .eq('id', balanceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a pending balance
 */
export async function cancelBalance(
  balanceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .update({ status: 'cancelled' })
      .eq('id', balanceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reschedule a pending balance to a new date.
 * Cancels the balance and creates a new order for the remaining quantity
 * on the new date so it gets picked up by distribution for that day.
 * The original order is left untouched (it was already partially fulfilled).
 */
export async function rescheduleBalance(
  balanceId: string,
  newDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch the full balance record
    const { data: balance, error: fetchError } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .select('*')
      .eq('id', balanceId)
      .single();

    if (fetchError || !balance) {
      return { success: false, error: fetchError?.message || 'Balance not found' };
    }

    // 2. Cancel the pending balance so it disappears from the list
    const { error: cancelError } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .update({ status: 'cancelled' })
      .eq('id', balanceId);

    if (cancelError) {
      return { success: false, error: cancelError.message };
    }

    // 3. Create a new order for the remaining quantity on the new date
    //    so it appears in distribution for that day
    const newOrder = {
      zone: balance.zone,
      zone_id: balance.zone_id || null,
      district_id: balance.district_id || null,
      date: newDate,
      pallets: balance.remaining_quantity,
      pickup: balance.pickup || null,
      delivery: balance.delivery || null,
      do_number: balance.do_number || null,
      priority: 'high', // Rescheduled balances get high priority
      status: 'pending',
      raw_data: {
        ...(balance.raw_data || {}),
        _rescheduled_from_balance: balanceId,
        _original_order_id: balance.original_order_id || '',
      },
    };

    const { error: orderError } = await supabase
      .from(TABLES.ORDERS)
      .insert(newOrder);

    if (orderError) {
      return { success: false, error: orderError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a balance record
 */
export async function deleteBalance(
  balanceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .delete()
      .eq('id', balanceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get balance statistics grouped by date
 */
export async function getBalanceStatistics(): Promise<
  Array<{
    date: string;
    count: number;
    totalQuantity: number;
    zones: string[];
  }>
> {
  try {
    const balances = await getAllPendingBalances();

    // Group by date
    const grouped = new Map<
      string,
      { count: number; totalQuantity: number; zones: Set<string> }
    >();

    for (const balance of balances) {
      const date = balance.scheduled_for_date;
      if (!grouped.has(date)) {
        grouped.set(date, { count: 0, totalQuantity: 0, zones: new Set() });
      }

      const group = grouped.get(date)!;
      group.count += 1;
      group.totalQuantity += balance.remaining_quantity;
      group.zones.add(balance.zone);
    }

    // Convert to array
    return Array.from(grouped.entries())
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        totalQuantity: stats.totalQuantity,
        zones: Array.from(stats.zones),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting balance statistics:', error);
    return [];
  }
}

/**
 * Batch create pending balances from distribution result
 */
export async function batchCreateBalances(
  balances: PendingBalance[],
  distributionId?: string
): Promise<{ success: boolean; created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  try {
    const balancesToInsert = balances.map((balance) => ({
      ...balance,
      distribution_id: distributionId,
    }));

    const { data, error } = await supabase
      .from(TABLES.PENDING_BALANCES)
      .insert(balancesToInsert)
      .select();

    if (error) {
      errors.push(error.message);
    } else {
      created = data?.length || 0;
    }

    return { success: errors.length === 0, created, errors };
  } catch (error: any) {
    errors.push(error.message);
    return { success: false, created, errors };
  }
}
