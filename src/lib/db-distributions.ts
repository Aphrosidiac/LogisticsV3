// Distribution operations
import { supabase, TABLES } from './supabase';
import type { DistributionResult } from '@/types';
import { generateId } from './utils';

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
