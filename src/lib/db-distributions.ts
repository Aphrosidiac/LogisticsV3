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
        summary: {
          ...distribution.summary,
          skippedOrdersList: distribution.skippedOrders || [],
        },
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
    const { skippedOrdersList, ...summaryRest } = data.summary || {};
    return {
      id: data.id,
      assignments: data.assignments || [],
      unassignedDrivers: data.unassigned_drivers || [],
      skippedOrders: skippedOrdersList || [],
      summary: summaryRest,
      timestamp: data.timestamp,
      targetDate: data.target_date,
    };
  } catch (error) {
    console.error('Error getting latest distribution:', error);
    return null;
  }
}

export async function getDistributionByDate(targetDate: string): Promise<DistributionResult | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .select('*')
      .eq('target_date', targetDate)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    const { skippedOrdersList, ...summaryRest } = data.summary || {};
    return {
      id: data.id,
      assignments: data.assignments || [],
      unassignedDrivers: data.unassigned_drivers || [],
      skippedOrders: skippedOrdersList || [],
      summary: summaryRest,
      timestamp: data.timestamp,
      targetDate: data.target_date,
    };
  } catch (error) {
    console.error('Error getting distribution by date:', error);
    return null;
  }
}

export async function deleteDistribution(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting distribution:', error);
    throw error;
  }
}

export async function updateDistribution(id: string, distribution: DistributionResult): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .update({
        assignments: distribution.assignments,
        summary: {
          ...distribution.summary,
          skippedOrdersList: distribution.skippedOrders || [],
        },
        timestamp: distribution.timestamp,
      })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating distribution:', error);
    throw error;
  }
}

export async function updateDistributionAssignments(id: string, assignments: DistributionResult['assignments']): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLES.DISTRIBUTIONS)
      .update({ assignments })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating distribution assignments:', error);
    throw error;
  }
}
