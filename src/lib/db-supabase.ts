// Supabase database wrapper - mirrors API of db.ts for easy migration
import { supabase, TABLES } from './supabase';
import type { Order, Driver, AppConfig, LogEntry, DistributionResult, MessageTemplate, Sheet } from '@/types';

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
            id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
    const ordersToInsert = orders.map((order) => ({
      id: order.id || crypto.randomUUID(),
      sheet_id: sheetId,
      zone: order.zone,
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
    }));

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
      date: row.date,
      priority: row.priority as 'high' | 'standard',
      ctn_amount: row.ctn_amount,
      ctn_to_pallet_ratio: row.ctn_to_pallet_ratio,
      pallets: row.pallets,
      do_number: row.do_number,
      invoice_number: row.invoice_number,
      invoice: row.invoice_number,
      pickup: row.pickup,
      delivery: row.delivery,
      attachment_urls: row.attachment_urls || [],
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

// ============================================================================
// Driver Operations
// ============================================================================

export async function saveDrivers(drivers: Driver[], sheetId?: string) {
  try {
    const driversToInsert = drivers.map((driver) => ({
      id: driver.id || crypto.randomUUID(),
      name: driver.name,
      identifier: driver.identifier,
      home_region: driver.home_region,
      max_capacity: driver.max_capacity || 11,
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
        id: driver.id || crypto.randomUUID(),
        name: driver.name,
        identifier: driver.identifier,
        home_region: driver.home_region,
        max_capacity: driver.max_capacity || 11,
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
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .update({
        name: updates.name,
        identifier: updates.identifier,
        home_region: updates.home_region,
        max_capacity: updates.max_capacity,
      })
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
    const id = crypto.randomUUID();
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

export async function getLatestDistribution() {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    console.error('Error getting latest distribution:', error);
    return null;
  }
}

// ============================================================================
// Log Operations
// ============================================================================

export async function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>) {
  try {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
