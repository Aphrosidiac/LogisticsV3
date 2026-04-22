// Config and Schema operations
import { supabase, TABLES } from './supabase';
import type { AppConfig } from '@/types';
import { generateId } from './utils';

export async function getConfig(): Promise<AppConfig> {
  try {
    const { data, error } = await supabase
      .from(TABLES.APP_CONFIG)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
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
      autoMessageRecipients: data.auto_message_recipients || 'drivers',
      distributionPaused: data.distribution_paused || false,
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

    const { data: existing } = await supabase
      .from(TABLES.APP_CONFIG)
      .select('id')
      .limit(1)
      .single();

    const payload = {
      admin_numbers: updated.adminNumbers,
      manual_drivers: updated.manualDrivers,
      whatsapp_connected: updated.whatsappConnected,
      message_templates: updated.messageTemplates,
      password_hash: updated.passwordHash,
      schemas: updated.schemas,
      distribution_time: updated.distributionTime || '20:00',
      last_auto_distribution_date: updated.lastAutoDistributionDate || null,
      auto_message_recipients: updated.autoMessageRecipients || 'drivers',
      distribution_paused: updated.distributionPaused || false,
    };

    if (existing) {
      const { error } = await supabase
        .from(TABLES.APP_CONFIG)
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(TABLES.APP_CONFIG)
        .insert(payload);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

export async function saveSchema(type: 'orders' | 'drivers', schema: unknown) {
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
