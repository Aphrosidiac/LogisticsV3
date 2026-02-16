import { supabase, TABLES } from './supabase';
import * as db from './db';
import type { Order, Driver, AppConfig } from '@/types';

export interface MigrationResult {
  success: boolean;
  message: string;
  details: {
    orders: number;
    drivers: number;
    sheets: number;
    distributions: number;
    logs: number;
    whatsappMessages: number;
    config: boolean;
  };
  errors: string[];
}

/**
 * Migrate all data from IndexedDB to Supabase
 */
export async function migrateToSupabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: '',
    details: {
      orders: 0,
      drivers: 0,
      sheets: 0,
      distributions: 0,
      logs: 0,
      whatsappMessages: 0,
      config: false,
    },
    errors: [],
  };

  try {
    console.log('Starting migration from IndexedDB to Supabase...');

    // 1. Migrate Config
    try {
      const config = await db.getConfig();
      const { error: configError } = await supabase
        .from(TABLES.APP_CONFIG)
        .upsert({
          id: crypto.randomUUID(),
          admin_numbers: config.adminNumbers || [],
          manual_drivers: config.manualDrivers || [],
          whatsapp_connected: config.whatsappConnected || false,
          message_templates: config.messageTemplates || [],
          password_hash: config.passwordHash || null,
          schemas: config.schemas || {},
        });

      if (configError) {
        result.errors.push(`Config migration error: ${configError.message}`);
      } else {
        result.details.config = true;
        console.log('✓ Config migrated');
      }
    } catch (error: any) {
      result.errors.push(`Config migration failed: ${error.message}`);
    }

    // 2. Migrate Sheets
    try {
      const sheets = await db.getAllSheets();
      if (sheets.length > 0) {
        const { error: sheetsError } = await supabase
          .from(TABLES.SHEETS)
          .insert(
            sheets.map((sheet) => ({
              id: sheet.id,
              name: sheet.name,
              type: sheet.type,
              headers: sheet.headers,
              data: sheet.data,
              created_at: sheet.createdAt,
              updated_at: sheet.updatedAt,
            }))
          );

        if (sheetsError) {
          result.errors.push(`Sheets migration error: ${sheetsError.message}`);
        } else {
          result.details.sheets = sheets.length;
          console.log(`✓ ${sheets.length} sheets migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Sheets migration failed: ${error.message}`);
    }

    // 3. Migrate Orders
    try {
      const orders = await db.getAllOrders();
      if (orders.length > 0) {
        const { error: ordersError } = await supabase
          .from(TABLES.ORDERS)
          .insert(
            orders.map((order: any) => ({
              id: order.id,
              sheet_id: order.sheetId || null,
              zone: order.zone,
              date: order.date || new Date().toISOString().split('T')[0],
              priority: 'standard',
              pallets: order.pallets,
              pickup: order.pickup || null,
              delivery: order.delivery || null,
              do_number: null,
              invoice_number: order.invoice || null,
              raw_data: order.rawData || {},
            }))
          );

        if (ordersError) {
          result.errors.push(`Orders migration error: ${ordersError.message}`);
        } else {
          result.details.orders = orders.length;
          console.log(`✓ ${orders.length} orders migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Orders migration failed: ${error.message}`);
    }

    // 4. Migrate Drivers
    try {
      const drivers = await db.getAllDrivers();
      if (drivers.length > 0) {
        const { error: driversError } = await supabase
          .from(TABLES.DRIVERS)
          .insert(
            drivers.map((driver: any) => ({
              id: driver.id,
              name: driver.name,
              identifier: driver.identifier,
              home_region: null,
              max_capacity: 11,
              raw_data: {},
            }))
          );

        if (driversError) {
          result.errors.push(`Drivers migration error: ${driversError.message}`);
        } else {
          result.details.drivers = drivers.length;
          console.log(`✓ ${drivers.length} drivers migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Drivers migration failed: ${error.message}`);
    }

    // 5. Migrate Distributions
    try {
      const distributions = await db.getAllDistributions();
      if (distributions.length > 0) {
        const { error: distributionsError } = await supabase
          .from(TABLES.DISTRIBUTIONS)
          .insert(
            distributions.map((dist: any) => ({
              id: dist.id,
              assignments: dist.assignments,
              summary: dist.summary,
              target_date: new Date().toISOString().split('T')[0],
              timestamp: dist.timestamp,
            }))
          );

        if (distributionsError) {
          result.errors.push(`Distributions migration error: ${distributionsError.message}`);
        } else {
          result.details.distributions = distributions.length;
          console.log(`✓ ${distributions.length} distributions migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Distributions migration failed: ${error.message}`);
    }

    // 6. Migrate Logs
    try {
      const logs = await db.getAllLogs();
      if (logs.length > 0) {
        const { error: logsError } = await supabase
          .from(TABLES.LOGS)
          .insert(
            logs.map((log) => ({
              id: log.id,
              timestamp: log.timestamp,
              type: log.type,
              message: log.message,
              details: log.details || null,
            }))
          );

        if (logsError) {
          result.errors.push(`Logs migration error: ${logsError.message}`);
        } else {
          result.details.logs = logs.length;
          console.log(`✓ ${logs.length} logs migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Logs migration failed: ${error.message}`);
    }

    // 7. Migrate WhatsApp Messages
    try {
      const messages = await db.getAllWhatsAppMessages();
      if (messages.length > 0) {
        const { error: messagesError } = await supabase
          .from(TABLES.WHATSAPP_MESSAGES)
          .insert(
            messages.map((msg) => ({
              id: msg.id,
              recipient: msg.recipient,
              message: msg.message,
              status: msg.status,
              sent_at: msg.sentAt || null,
              error: msg.error || null,
              distribution_id: msg.distributionId || null,
            }))
          );

        if (messagesError) {
          result.errors.push(`WhatsApp messages migration error: ${messagesError.message}`);
        } else {
          result.details.whatsappMessages = messages.length;
          console.log(`✓ ${messages.length} WhatsApp messages migrated`);
        }
      }
    } catch (error: any) {
      result.errors.push(`WhatsApp messages migration failed: ${error.message}`);
    }

    // Determine success
    result.success = result.errors.length === 0;
    result.message = result.success
      ? 'Migration completed successfully!'
      : `Migration completed with ${result.errors.length} error(s)`;

    console.log('\nMigration Summary:');
    console.log('==================');
    console.log(`Orders: ${result.details.orders}`);
    console.log(`Drivers: ${result.details.drivers}`);
    console.log(`Sheets: ${result.details.sheets}`);
    console.log(`Distributions: ${result.details.distributions}`);
    console.log(`Logs: ${result.details.logs}`);
    console.log(`WhatsApp Messages: ${result.details.whatsappMessages}`);
    console.log(`Config: ${result.details.config ? 'Yes' : 'No'}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err) => console.log(`- ${err}`));
    }

    return result;
  } catch (error: any) {
    result.success = false;
    result.message = `Migration failed: ${error.message}`;
    result.errors.push(error.message);
    return result;
  }
}

/**
 * Export IndexedDB data for backup before migration
 */
export async function exportIndexedDBBackup(): Promise<string> {
  const data = await db.exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Download the backup file
  const link = document.createElement('a');
  link.href = url;
  link.download = `logistics-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return json;
}

/**
 * Check if migration has already been performed
 */
export async function checkMigrationStatus(): Promise<{
  hasMigrated: boolean;
  hasIndexedDBData: boolean;
  hasSupabaseData: boolean;
}> {
  try {
    // Check IndexedDB
    const orders = await db.getAllOrders();
    const drivers = await db.getAllDrivers();
    const hasIndexedDBData = orders.length > 0 || drivers.length > 0;

    // Check Supabase
    const { data: supabaseOrders } = await supabase
      .from(TABLES.ORDERS)
      .select('id')
      .limit(1);

    const { data: supabaseDrivers } = await supabase
      .from(TABLES.DRIVERS)
      .select('id')
      .limit(1);

    const hasSupabaseData = (supabaseOrders && supabaseOrders.length > 0) ||
                           (supabaseDrivers && supabaseDrivers.length > 0);

    return {
      hasMigrated: hasSupabaseData,
      hasIndexedDBData,
      hasSupabaseData,
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return {
      hasMigrated: false,
      hasIndexedDBData: false,
      hasSupabaseData: false,
    };
  }
}
