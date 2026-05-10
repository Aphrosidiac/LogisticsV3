// Order operations
import { supabase, TABLES } from './supabase';
import type { Order } from '@/types';
import { getZonesByIds, getDistrictsByIds } from './db-zones';
import { generateId } from './utils';

export async function saveOrders(orders: Order[], sheetId?: string) {
  try {
    // Batch-fetch all referenced zones and districts in 2 queries (not N+1)
    const zoneIds = orders.map(o => o.zone_id).filter(Boolean) as string[];
    const districtIds = orders.map(o => o.district_id).filter(Boolean) as string[];
    const [zonesMap, districtsMap] = await Promise.all([
      getZonesByIds(zoneIds),
      getDistrictsByIds(districtIds),
    ]);

    const ordersToInsert = orders.map((order) => {
      let zoneText = order.zone;

      if (order.zone_id && order.district_id) {
        const zone = zonesMap.get(order.zone_id);
        const district = districtsMap.get(order.district_id);
        if (zone && district) {
          zoneText = `${zone.name} - ${district.name}`;
        }
      }

      return {
        id: order.id || generateId(),
        sheet_id: sheetId,
        zone: zoneText,
        zone_id: order.zone_id,
        district_id: order.district_id,
        date: order.date || new Date().toISOString().split('T')[0],
        priority: order.priority || 'standard',
        ctn_amount: order.ctn_amount,
        ctn_to_pallet_ratio: order.ctn_to_pallet_ratio,
        pallets: order.pallets,
        do_number: order.do_number,
        invoice_number: order.invoice_number || order.invoice,
        pickup: order.pickup,
        pickup_company: order.pickup_company || null,
        pickup_address: order.pickup_address || null,
        pickup_postcode: order.pickup_postcode || null,
        pickup_area: order.pickup_area || null,
        pickup_state: order.pickup_state || null,
        pickup_phone: order.pickup_phone || null,
        delivery: order.delivery,
        delivery_company: order.delivery_company || null,
        delivery_address: order.delivery_address || null,
        delivery_postcode: order.delivery_postcode || null,
        delivery_area: order.delivery_area || null,
        delivery_state: order.delivery_state || null,
        delivery_phone: order.delivery_phone || null,
        measurement_unit: order.measurement_unit || 'CTN',
        is_oversized: order.is_oversized || false,
        pallets_max: order.pallets_max || null,
        attachment_urls: order.attachment_urls || [],
        raw_data: order.rawData || {},
      };
    });

    const { error } = await supabase
      .from(TABLES.ORDERS)
      .upsert(ordersToInsert, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving orders:', error);
    throw error;
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ORDERS)
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      zone: row.zone,
      zone_id: row.zone_id,
      district_id: row.district_id,
      date: row.date,
      priority: (row.priority as 'high' | 'standard') || 'standard',
      status: (row.status as Order['status']) || 'pending',
      ctn_amount: row.ctn_amount,
      ctn_to_pallet_ratio: row.ctn_to_pallet_ratio,
      measurement_unit: (row.measurement_unit as Order['measurement_unit']) || 'CTN',
      is_oversized: row.is_oversized || false,
      pallets: row.pallets,
      pallets_max: row.pallets_max || undefined,
      do_number: row.do_number,
      invoice_number: row.invoice_number,
      invoice: row.invoice_number,
      pickup: row.pickup,
      pickup_company: row.pickup_company || undefined,
      pickup_address: row.pickup_address || undefined,
      pickup_postcode: row.pickup_postcode || undefined,
      pickup_area: row.pickup_area || undefined,
      pickup_state: row.pickup_state || undefined,
      pickup_phone: row.pickup_phone || undefined,
      delivery: row.delivery,
      delivery_company: row.delivery_company || undefined,
      delivery_address: row.delivery_address || undefined,
      delivery_postcode: row.delivery_postcode || undefined,
      delivery_area: row.delivery_area || undefined,
      delivery_state: row.delivery_state || undefined,
      delivery_phone: row.delivery_phone || undefined,
      attachment_urls: row.attachment_urls || [],
      assigned_driver_id: row.assigned_driver_id || undefined,
      pickup_verified: row.pickup_verified || false,
      pickup_verified_at: row.pickup_verified_at || undefined,
      pickup_verified_by: row.pickup_verified_by || undefined,
      delivery_photo_urls: row.delivery_photo_urls || [],
      delivered_at: row.delivered_at || undefined,
      created_at: row.created_at || undefined,
      rawData: row.raw_data || {},
    }));
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
  }
}

export async function clearOrders() {
  try {
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  } catch (error) {
    console.error('Error clearing orders:', error);
    throw error;
  }
}

export async function addOrder(order: Partial<Order>): Promise<Order> {
  try {
    const id = generateId();
    const row = {
      id,
      zone: order.zone || '',
      zone_id: order.zone_id || null,
      district_id: order.district_id || null,
      date: order.date || new Date().toISOString().split('T')[0],
      priority: order.priority || 'standard',
      status: order.status || 'pending',
      ctn_amount: order.ctn_amount ?? null,
      ctn_to_pallet_ratio: order.ctn_to_pallet_ratio ?? null,
      measurement_unit: order.measurement_unit || 'CTN',
      is_oversized: order.is_oversized || false,
      pallets: order.pallets || 0,
      pallets_max: order.pallets_max || null,
      do_number: order.do_number || null,
      invoice_number: order.invoice_number || null,
      pickup: order.pickup || null,
      pickup_company: order.pickup_company || null,
      pickup_address: order.pickup_address || null,
      pickup_postcode: order.pickup_postcode || null,
      pickup_area: order.pickup_area || null,
      pickup_state: order.pickup_state || null,
      pickup_phone: order.pickup_phone || null,
      delivery: order.delivery || null,
      delivery_company: order.delivery_company || null,
      delivery_address: order.delivery_address || null,
      delivery_postcode: order.delivery_postcode || null,
      delivery_area: order.delivery_area || null,
      delivery_state: order.delivery_state || null,
      delivery_phone: order.delivery_phone || null,
      attachment_urls: [],
      raw_data: {},
    };

    const { error } = await supabase.from(TABLES.ORDERS).insert(row);
    if (error) throw error;

    return { ...order, id, rawData: {} } as Order;
  } catch (error) {
    console.error('Error adding order:', error);
    throw error;
  }
}

export async function updateOrder(id: string, updates: Partial<Order>) {
  try {
    const payload: Record<string, unknown> = {};
    if (updates.zone !== undefined) payload.zone = updates.zone;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.pallets !== undefined) payload.pallets = updates.pallets;
    if (updates.ctn_amount !== undefined) payload.ctn_amount = updates.ctn_amount ?? null;
    if (updates.ctn_to_pallet_ratio !== undefined) payload.ctn_to_pallet_ratio = updates.ctn_to_pallet_ratio ?? null;
    if (updates.measurement_unit !== undefined) payload.measurement_unit = updates.measurement_unit || 'CTN';
    if (updates.is_oversized !== undefined) payload.is_oversized = updates.is_oversized || false;
    if (updates.pallets_max !== undefined) payload.pallets_max = updates.pallets_max || null;
    if (updates.do_number !== undefined) payload.do_number = updates.do_number || null;
    if (updates.invoice_number !== undefined) payload.invoice_number = updates.invoice_number || null;
    if (updates.pickup !== undefined) payload.pickup = updates.pickup || null;
    if (updates.pickup_company !== undefined) payload.pickup_company = updates.pickup_company || null;
    if (updates.pickup_address !== undefined) payload.pickup_address = updates.pickup_address || null;
    if (updates.pickup_postcode !== undefined) payload.pickup_postcode = updates.pickup_postcode || null;
    if (updates.pickup_area !== undefined) payload.pickup_area = updates.pickup_area || null;
    if (updates.pickup_state !== undefined) payload.pickup_state = updates.pickup_state || null;
    if (updates.pickup_phone !== undefined) payload.pickup_phone = updates.pickup_phone || null;
    if (updates.delivery !== undefined) payload.delivery = updates.delivery || null;
    if (updates.delivery_company !== undefined) payload.delivery_company = updates.delivery_company || null;
    if (updates.delivery_address !== undefined) payload.delivery_address = updates.delivery_address || null;
    if (updates.delivery_postcode !== undefined) payload.delivery_postcode = updates.delivery_postcode || null;
    if (updates.delivery_area !== undefined) payload.delivery_area = updates.delivery_area || null;
    if (updates.delivery_state !== undefined) payload.delivery_state = updates.delivery_state || null;
    if (updates.delivery_phone !== undefined) payload.delivery_phone = updates.delivery_phone || null;
    if (updates.zone_id !== undefined) payload.zone_id = updates.zone_id || null;
    if (updates.district_id !== undefined) payload.district_id = updates.district_id || null;
    if (updates.attachment_urls !== undefined) payload.attachment_urls = updates.attachment_urls;

    const { error } = await supabase.from(TABLES.ORDERS).update(payload).eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating order:', error);
    throw error;
  }
}

export async function deleteOrder(id: string) {
  try {
    const { error } = await supabase.from(TABLES.ORDERS).delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
}

export async function updateOrdersToAssigned(
  orderDriverMap: { orderId: string; driverId: string }[]
): Promise<void> {
  if (orderDriverMap.length === 0) return;
  try {
    const now = new Date().toISOString();
    // Group by driver to minimize queries
    const byDriver = new Map<string, string[]>();
    for (const { orderId, driverId } of orderDriverMap) {
      const list = byDriver.get(driverId) || [];
      list.push(orderId);
      byDriver.set(driverId, list);
    }
    await Promise.all(
      Array.from(byDriver.entries()).map(([driverId, orderIds]) =>
        supabase
          .from(TABLES.ORDERS)
          .update({ status: 'assigned', assigned_driver_id: driverId, updated_at: now })
          .in('id', orderIds)
      )
    );
  } catch (error) {
    console.error('Error updating orders to assigned:', error);
    throw error;
  }
}

export async function getPendingOrderCountForDate(date: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(TABLES.ORDERS)
      .select('id', { count: 'exact', head: true })
      .eq('date', date)
      .eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error('Error getting pending order count:', error);
    return 0;
  }
}

export async function revertOrdersToPending(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update({ status: 'pending', assigned_driver_id: null, updated_at: now })
      .in('id', orderIds)
      .eq('status', 'assigned');
    if (error) throw error;
  } catch (error) {
    console.error('Error reverting orders to pending:', error);
    throw error;
  }
}

export async function markOrdersAsCompleted(orderIds: string[], driverId?: string): Promise<void> {
  if (orderIds.length === 0) return;
  try {
    const payload: Record<string, unknown> = {
      status: 'completed',
      updated_at: new Date().toISOString(),
    };
    if (driverId) payload.assigned_driver_id = driverId;

    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update(payload)
      .in('id', orderIds);
    if (error) throw error;
  } catch (error) {
    console.error('Error marking orders as completed:', error);
    throw error;
  }
}

export async function markOrdersAsPickedUp(
  orderIds: string[],
  verifiedBy: string
): Promise<void> {
  if (orderIds.length === 0) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update({
        status: 'picked_up',
        pickup_verified: true,
        pickup_verified_at: now,
        pickup_verified_by: verifiedBy,
        updated_at: now,
      })
      .in('id', orderIds);
    if (error) throw error;
  } catch (error) {
    console.error('Error marking orders as picked up:', error);
    throw error;
  }
}

export async function markOrdersAsNotCollected(orderIds: string[], verifiedBy?: string): Promise<void> {
  if (orderIds.length === 0) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update({
        pickup_verified: false,
        pickup_verified_at: now,
        pickup_verified_by: verifiedBy || null,
        updated_at: now,
      })
      .in('id', orderIds);
    if (error) throw error;
  } catch (error) {
    console.error('Error marking orders as not collected:', error);
    throw error;
  }
}

export async function getAssignedOrdersForDate(date: string): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ORDERS)
      .select('*')
      .eq('date', date)
      .in('status', ['assigned', 'picked_up'])
      .order('assigned_driver_id');
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      zone: row.zone,
      zone_id: row.zone_id,
      district_id: row.district_id,
      date: row.date,
      priority: (row.priority as 'high' | 'standard') || 'standard',
      status: (row.status as Order['status']) || 'pending',
      ctn_amount: row.ctn_amount,
      ctn_to_pallet_ratio: row.ctn_to_pallet_ratio,
      measurement_unit: (row.measurement_unit as Order['measurement_unit']) || 'CTN',
      is_oversized: row.is_oversized || false,
      pallets: row.pallets,
      pallets_max: row.pallets_max || undefined,
      do_number: row.do_number,
      invoice_number: row.invoice_number,
      pickup: row.pickup,
      pickup_company: row.pickup_company || undefined,
      delivery: row.delivery,
      delivery_company: row.delivery_company || undefined,
      attachment_urls: row.attachment_urls || [],
      assigned_driver_id: row.assigned_driver_id || undefined,
      pickup_verified: row.pickup_verified || false,
      pickup_verified_at: row.pickup_verified_at || undefined,
      pickup_verified_by: row.pickup_verified_by || undefined,
      delivery_photo_urls: row.delivery_photo_urls || [],
      delivered_at: row.delivered_at || undefined,
      created_at: row.created_at || undefined,
      rawData: row.raw_data || {},
    }));
  } catch (error) {
    console.error('Error getting assigned orders for date:', error);
    return [];
  }
}

export async function getOrdersForDeliveryPage(date: string): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ORDERS)
      .select('*')
      .eq('date', date)
      .in('status', ['assigned', 'picked_up', 'completed'])
      .order('assigned_driver_id');
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      zone: row.zone,
      zone_id: row.zone_id,
      district_id: row.district_id,
      date: row.date,
      priority: (row.priority as 'high' | 'standard') || 'standard',
      status: (row.status as Order['status']) || 'pending',
      ctn_amount: row.ctn_amount,
      ctn_to_pallet_ratio: row.ctn_to_pallet_ratio,
      measurement_unit: (row.measurement_unit as Order['measurement_unit']) || 'CTN',
      is_oversized: row.is_oversized || false,
      pallets: row.pallets,
      pallets_max: row.pallets_max || undefined,
      do_number: row.do_number,
      invoice_number: row.invoice_number,
      pickup: row.pickup,
      pickup_company: row.pickup_company || undefined,
      delivery: row.delivery,
      delivery_company: row.delivery_company || undefined,
      attachment_urls: row.attachment_urls || [],
      assigned_driver_id: row.assigned_driver_id || undefined,
      pickup_verified: row.pickup_verified || false,
      pickup_verified_at: row.pickup_verified_at || undefined,
      pickup_verified_by: row.pickup_verified_by || undefined,
      delivery_photo_urls: row.delivery_photo_urls || [],
      delivered_at: row.delivered_at || undefined,
      created_at: row.created_at || undefined,
      rawData: row.raw_data || {},
    }));
  } catch (error) {
    console.error('Error getting orders for delivery page:', error);
    return [];
  }
}

export async function updateDeliveryPhotos(
  orderId: string,
  photoUrls: string[]
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      delivery_photo_urls: photoUrls,
      updated_at: now,
    };
    if (photoUrls.length === 0) {
      payload.status = 'picked_up';
      payload.delivered_at = null;
    }
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update(payload)
      .eq('id', orderId);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating delivery photos:', error);
    throw error;
  }
}

export async function markOrderAsDelivered(
  orderId: string,
  photoUrls: string[]
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLES.ORDERS)
      .update({
        status: 'completed',
        delivery_photo_urls: photoUrls,
        delivered_at: now,
        updated_at: now,
      })
      .eq('id', orderId);
    if (error) throw error;
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    throw error;
  }
}