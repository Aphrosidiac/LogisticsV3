// Re-export barrel — all consumers import from here for backward compatibility.
// Actual implementations live in focused modules:
//   db-config.ts, db-orders.ts, db-drivers.ts, db-distributions.ts, db-logs.ts, db-whatsapp.ts

export { getConfig, saveConfig, saveSchema, getSchema, setLastAutoDistributionDate } from './db-config';
export { saveOrders, getAllOrders, clearOrders, addOrder, updateOrder, deleteOrder, updateOrdersToAssigned, getPendingOrderCountForDate, markOrdersAsCompleted } from './db-orders';
export { getAllClients, addClient, updateClient, deleteClient, clearClients } from './db-clients';
export { saveDrivers, getAllDrivers, addDriver, updateDriver, deleteDriver, setDriverActive, getActiveDrivers, clearDrivers } from './db-drivers';
export { saveDistribution, getAllDistributions, getDistribution, getLatestDistribution, getDistributionByDate, updateDistribution, updateDistributionAssignments } from './db-distributions';
export { addLog, getAllLogs, clearLogs } from './db-logs';
export { addWhatsAppMessage, updateWhatsAppMessage, getAllWhatsAppMessages, getPendingWhatsAppMessages } from './db-whatsapp';

// Sheet operations (kept inline — small and tightly coupled)
import { supabase, TABLES } from './supabase';
import type { Sheet } from '@/types';
import { generateId } from './utils';

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

// Backup and Restore
import { getConfig } from './db-config';
import { getAllOrders, clearOrders, saveOrders } from './db-orders';
import { getAllDrivers, clearDrivers, saveDrivers } from './db-drivers';
import { getAllDistributions } from './db-distributions';
import { getAllLogs, clearLogs } from './db-logs';
import { getAllWhatsAppMessages } from './db-whatsapp';
import { getAllClients, clearClients } from './db-clients';
import { saveConfig } from './db-config';

export async function exportAllData() {
  try {
    const [config, sheets, orders, drivers, distributions, logs, whatsapp, clients] = await Promise.all([
      getConfig(),
      getAllSheets(),
      getAllOrders(),
      getAllDrivers(),
      getAllDistributions(),
      getAllLogs(),
      getAllWhatsAppMessages(),
      getAllClients(),
    ]);

    return {
      config,
      sheets,
      orders,
      drivers,
      distributions,
      logs,
      whatsapp,
      clients,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
}

export async function importAllData(data: any) {
  try {
    await Promise.all([
      clearOrders(),
      clearDrivers(),
      clearLogs(),
    ]);

    if (data.config) await saveConfig(data.config);
    if (data.orders && data.orders.length > 0) await saveOrders(data.orders);
    if (data.drivers && data.drivers.length > 0) await saveDrivers(data.drivers);

    if (data.sheets) {
      for (const sheet of data.sheets) {
        await createSheet(sheet.name, sheet.type, sheet.headers, sheet.data);
      }
    }

    if (data.clients && data.clients.length > 0) {
      const { addClient } = await import('./db-clients');
      for (const client of data.clients) {
        await addClient(client);
      }
    }

    console.log('Data import completed successfully');
  } catch (error) {
    console.error('Error importing all data:', error);
    throw error;
  }
}

// History Operations (backward compat stubs)
export async function addHistory(action: string, data: any) {
  console.log('History tracking:', action, data);
}

export async function getHistory(limit: number = 50) {
  return [];
}

// Real-time Subscriptions
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
