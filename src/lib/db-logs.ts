// Log operations
import { supabase, TABLES } from './supabase';
import type { LogEntry } from '@/types';
import { generateId } from './utils';

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
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  } catch (error) {
    console.error('Error clearing logs:', error);
    throw error;
  }
}
