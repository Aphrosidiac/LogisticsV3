// Supabase database wrapper - mirrors API of db.ts for easy migration
import { supabase, TABLES } from './supabase';
import type { Order, Driver, AppConfig, LogEntry, DistributionResult, MessageTemplate, Sheet } from '@/types';
import { getZone, getDistrict } from './db-zones';
import { generateId } from './utils';

// ============================================================================
// Config Operations
// ============================================================================

export async function getConfig(): Promise<AppConfig> {
  try {
    const { data, error } = await supabase
      .from(TABLES.APP_CONFIG)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return default config if none exists
      return {
        id: 'main',
        adminNumbers: [],
        manualDrivers: [],
        whatsappConnected: false,
        messageTemplates: [
          {
            id: generateId(),
            name: 'Default',
            content: 'Hello {driver},\n\nYour delivery assignment:\n{zones}\nTotal: {pallets} pallets\n\nThank you!',
          },
        ],
        schemas: {
          orders: undefined,
          drivers: undefined,
        },
      };
    }

    return {
      id: data.id,
      adminNumbers: data.admin_numbers || [],
      manualDrivers: data.manual_drivers || [],
      whatsappConnected: data.whatsapp_connected || false,
      messageTemplates: data.message_templates || [],
      passwordHash: data.password_hash,
      schemas: data.schemas || {},
      distributionTime: data.distribution_time || '20:00',
      lastAutoDistributionDate: data.last_auto_distribution_date || undefined,
    };
  } catch (error) {
    console.error('Error getting config:', error);
    throw error;
  }
}

export async function saveConfig(config: Partial<AppConfig>) {
  try {
    const current = await getConfig();
    const updated = { ...current, ...config };

    // Check if config exists
    const { data: existing } = await supabase
      .from(TABLES.APP_CONFIG)
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from(TABLES.APP_CONFIG)
        .update({
          admin_numbers: updated.adminNumbers,
          manual_drivers: updated.manualDrivers,
          whatsapp_connected: updated.whatsappConnected,
          message_templates: updated.messageTemplates,
          password_hash: updated.passwordHash,
          schemas: updated.schemas,
          distribution_time: updated.distributionTime || '20:00',
          last_auto_distribution_date: updated.lastAutoDistributionDate || null,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabase
        .from(TABLES.APP_CONFIG)
        .insert({
          admin_numbers: updated.adminNumbers,
          manual_drivers: updated.manualDrivers,
          whatsapp_connected: updated.whatsappConnected,
          message_templates: updated.messageTemplates,
          password_hash: updated.passwordHash,
          schemas: updated.schemas,
          distribution_time: updated.distributionTime || '20:00',
          last_auto_distribution_date: updated.lastAutoDistributionDate || null,
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

// ============================================================================
// Schema Operations
// ============================================================================

export async function saveSchema(type: 'orders' | 'drivers', schema: any) {
  try {
    const config = await getConfig();
    await saveConfig({
      schemas: {
        ...config.schemas,
        [type]: schema,
      },
    });
  } catch (error) {
    console.error('Error saving schema:', error);
    throw error;
  }
}

export async function getSchema(type: 'orders' | 'drivers') {
  try {
    const config = await getConfig();
    return config.schemas?.[type] || null;
  } catch (error) {
    console.error('Error getting schema:', error);
    return null;
  }
}

// ============================================================================
// Sheet Operations
// ============================================================================

export async function createSheet(
  name: string,
  type: 'orders' | 'drivers',
  headers: string[],
  data: Record<string, any>[] = []
) {
  try {
    const sheet = {
      id: generateId(),
      name,
      type,
      headers,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from(TABLES.SHEETS)
      .insert(sheet)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error('Error creating sheet:', error);
    throw error;
  }
}

export async function getAllSheets(): Promise<Sheet[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.SHEETS)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all sheets:', error);
    return [];
  }
}

export async function getSheetsByType(type: 'orders' | 'drivers'): Promise<Sheet[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.SHEETS)
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting sheets by type:', error);
    return [];
  }
}

export async function getSheet(id: string) {
  try {
    const { data, error } = await supabase
      .from(TABLES.SHEETS)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting sheet:', error);
    return null;
  }
}

export async function updateSheet(id: string, updates: Partial<Sheet>) {
  try {
    const { error } = await supabase
      .from(TABLES.SHEETS)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating sheet:', error);
    throw error;
  }
}

export async function deleteSheet(id: string) {
  try {
    const { error } = await supabase
      .from(TABLES.SHEETS)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting sheet:', error);
    throw error;
  }
}

// ============================================================================
// Order Operations
// ============================================================================

export async function saveOrders(orders: Order[], sheetId?: string) {
  try {
    // Process orders to populate legacy zone text if zone_id and district_id are provided
    const ordersToInsert = await Promise.all(
      orders.map(async (order) => {
        let zoneText = order.zone;

        // If zone_id and district_id are provided, populate legacy zone text
        if (order.zone_id && order.district_id) {
          const [zone, district] = await Promise.all([
            getZone(order.zone_id),
            getDistrict(order.district_id),
          ]);
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
          delivery: order.delivery,
          attachment_urls: order.attachment_urls || [],
          raw_data: order.rawData || {},
        };
      })
    );

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
      pallets: row.pallets,
      do_number: row.do_number,
      invoice_number: row.invoice_number,
      invoice: row.invoice_number,
      pickup: row.pickup,
      delivery: row.delivery,
      attachment_urls: row.attachment_urls || [],
      assigned_driver_id: row.assigned_driver_id || undefined,
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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

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
      pallets: order.pallets || 0,
      do_number: order.do_number || null,
      invoice_number: order.invoice_number || null,
      pickup: order.pickup || null,
      delivery: order.delivery || null,
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
    const payload: Record<string, any> = {};
    if (updates.zone !== undefined) payload.zone = updates.zone;
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.pallets !== undefined) payload.pallets = updates.pallets;
    if (updates.ctn_amount !== undefined) payload.ctn_amount = updates.ctn_amount ?? null;
    if (updates.ctn_to_pallet_ratio !== undefined) payload.ctn_to_pallet_ratio = updates.ctn_to_pallet_ratio ?? null;
    if (updates.do_number !== undefined) payload.do_number = updates.do_number || null;
    if (updates.invoice_number !== undefined) payload.invoice_number = updates.invoice_number || null;
    if (updates.pickup !== undefined) payload.pickup = updates.pickup || null;
    if (updates.delivery !== undefined) payload.delivery = updates.delivery || null;
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
    await Promise.all(
      orderDriverMap.map(({ orderId, driverId }) =>
        supabase
          .from(TABLES.ORDERS)
          .update({ status: 'assigned', assigned_driver_id: driverId, updated_at: now })
          .eq('id', orderId)
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

export async function setLastAutoDistributionDate(date: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from(TABLES.APP_CONFIG)
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { error } = await supabase
        .from(TABLES.APP_CONFIG)
        .update({ last_auto_distribution_date: date })
        .eq('id', existing.id);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error setting last auto distribution date:', error);
    throw error;
  }
}

// ============================================================================
// Driver Operations
// ============================================================================

export async function saveDrivers(drivers: Driver[], sheetId?: string) {
  try {
    const driversToInsert = drivers.map((driver) => ({
      id: driver.id || generateId(),
      name: driver.name,
      identifier: driver.identifier,
      home_region: driver.home_region || null,
      max_capacity: driver.max_capacity || 11,
      phone: driver.phone || null,
      raw_data: {},
    }));

    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .upsert(driversToInsert, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving drivers:', error);
    throw error;
  }
}

export async function getAllDrivers(): Promise<Driver[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DRIVERS)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      home_region: row.home_region,
      max_capacity: row.max_capacity,
      phone: row.phone || row.raw_data?.phone || undefined, // phone column with raw_data fallback
      is_active: row.is_active !== false, // default true if column missing
    }));
  } catch (error) {
    console.error('Error getting all drivers:', error);
    return [];
  }
}

export async function addDriver(driver: Driver) {
  try {
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .insert({
        id: driver.id || generateId(),
        name: driver.name,
        identifier: driver.identifier,
        home_region: driver.home_region || null,
        max_capacity: driver.max_capacity || 11,
        phone: driver.phone || null,
        is_active: driver.is_active !== false,
        raw_data: {},
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding driver:', error);
    throw error;
  }
}

export async function updateDriver(id: string, updates: Partial<Driver>) {
  try {
    const updatePayload: Record<string, any> = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.identifier !== undefined) updatePayload.identifier = updates.identifier;
    if (updates.home_region !== undefined) updatePayload.home_region = updates.home_region || null;
    if (updates.max_capacity !== undefined) updatePayload.max_capacity = updates.max_capacity;
    if (updates.phone !== undefined) updatePayload.phone = updates.phone || null;
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
}

export async function deleteDriver(id: string) {
  try {
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
}

export async function setDriverActive(id: string, is_active: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .update({ is_active })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error setting driver active state:', error);
    throw error;
  }
}

export async function getActiveDrivers(): Promise<Driver[]> {
  const all = await getAllDrivers();
  return all.filter(d => d.is_active !== false);
}

export async function clearDrivers() {
  try {
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
  } catch (error) {
    console.error('Error clearing drivers:', error);
    throw error;
  }
}

// ============================================================================
// Distribution Operations
// ============================================================================

export async function saveDistribution(distribution: DistributionResult) {
  try {
    const id = generateId();
    const { error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .insert({
        id,
        assignments: distribution.assignments,
        summary: distribution.summary,
        target_date: distribution.targetDate || new Date().toISOString().split('T')[0],
        timestamp: distribution.timestamp,
      });

    if (error) throw error;
    return id;
  } catch (error) {
    console.error('Error saving distribution:', error);
    throw error;
  }
}

export async function getAllDistributions() {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all distributions:', error);
    return [];
  }
}

export async function getDistribution(id: string) {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting distribution:', error);
    return null;
  }
}

export async function getLatestDistribution(): Promise<DistributionResult | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return {
      assignments: data.assignments || [],
      unassignedDrivers: data.unassigned_drivers || [],
      pendingBalances: data.pending_balances || [],
      summary: data.summary,
      timestamp: data.timestamp,
      targetDate: data.target_date,
    };
  } catch (error) {
    console.error('Error getting latest distribution:', error);
    return null;
  }
}

export async function markOrdersAsCompleted(orderIds: string[], driverId?: string): Promise<void> {
  if (orderIds.length === 0) return;
  try {
    const payload: Record<string, any> = {
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

// ============================================================================
// Log Operations
// ============================================================================

export async function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>) {
  try {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...log,
    };

    const { error } = await supabase
      .from(TABLES.LOGS)
      .insert({
        id: entry.id,
        timestamp: entry.timestamp,
        type: entry.type,
        message: entry.message,
        details: entry.details,
      });

    if (error) throw error;
    return entry;
  } catch (error) {
    console.error('Error adding log:', error);
    throw error;
  }
}

export async function getAllLogs(): Promise<LogEntry[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.LOGS)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all logs:', error);
    return [];
  }
}

export async function clearLogs() {
  try {
    const { error } = await supabase
      .from(TABLES.LOGS)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
  } catch (error) {
    console.error('Error clearing logs:', error);
    throw error;
  }
}

// ============================================================================
// History Operations (No-op for backward compatibility)
// ============================================================================

export async function addHistory(action: string, data: any) {
  // History tracking removed in Supabase version
  // Can be re-implemented if needed
  console.log('History tracking:', action, data);
}

export async function getHistory(limit: number = 50) {
  // History tracking removed in Supabase version
  return [];
}

// ============================================================================
// WhatsApp Message Operations
// ============================================================================

export async function addWhatsAppMessage(
  recipient: string,
  message: string,
  distributionId?: string
) {
  try {
    const msg = {
      id: generateId(),
      recipient,
      message,
      status: 'pending' as const,
      distribution_id: distributionId,
    };

    const { error } = await supabase
      .from(TABLES.WHATSAPP_MESSAGES)
      .insert(msg);

    if (error) throw error;
    return msg;
  } catch (error) {
    console.error('Error adding WhatsApp message:', error);
    throw error;
  }
}

export async function updateWhatsAppMessage(
  id: string,
  updates: { status?: string; sentAt?: string; error?: string }
) {
  try {
    const { error } = await supabase
      .from(TABLES.WHATSAPP_MESSAGES)
      .update({
        status: updates.status,
        sent_at: updates.sentAt,
        error: updates.error,
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating WhatsApp message:', error);
    throw error;
  }
}

export async function getAllWhatsAppMessages() {
  try {
    const { data, error } = await supabase
      .from(TABLES.WHATSAPP_MESSAGES)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all WhatsApp messages:', error);
    return [];
  }
}

export async function getPendingWhatsAppMessages() {
  try {
    const { data, error } = await supabase
      .from(TABLES.WHATSAPP_MESSAGES)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending WhatsApp messages:', error);
    return [];
  }
}

// ============================================================================
// Backup and Restore
// ============================================================================

export async function exportAllData() {
  try {
    const [config, sheets, orders, drivers, distributions, logs, whatsapp] = await Promise.all([
      getConfig(),
      getAllSheets(),
      getAllOrders(),
      getAllDrivers(),
      getAllDistributions(),
      getAllLogs(),
      getAllWhatsAppMessages(),
    ]);

    return {
      config,
      sheets,
      orders,
      drivers,
      distributions,
      logs,
      whatsapp,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
}

export async function importAllData(data: any) {
  try {
    // Clear existing data
    await Promise.all([
      clearOrders(),
      clearDrivers(),
      clearLogs(),
    ]);

    // Import data
    if (data.config) await saveConfig(data.config);
    if (data.orders && data.orders.length > 0) await saveOrders(data.orders);
    if (data.drivers && data.drivers.length > 0) await saveDrivers(data.drivers);

    // Import sheets (handled separately)
    if (data.sheets) {
      for (const sheet of data.sheets) {
        await createSheet(sheet.name, sheet.type, sheet.headers, sheet.data);
      }
    }

    // Distributions and logs are read-only, don't import to avoid duplicates

    console.log('Data import completed successfully');
  } catch (error) {
    console.error('Error importing all data:', error);
    throw error;
  }
}

// ============================================================================
// Real-time Subscriptions (Optional)
// ============================================================================

export function subscribeToOrders(callback: (payload: any) => void) {
  return supabase
    .channel('orders-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ORDERS }, callback)
    .subscribe();
}

export function subscribeToDrivers(callback: (payload: any) => void) {
  return supabase
    .channel('drivers-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.DRIVERS }, callback)
    .subscribe();
}

export function unsubscribe(subscription: any) {
  return supabase.removeChannel(subscription);
}
