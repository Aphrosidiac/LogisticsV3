// Driver operations
import { supabase, TABLES } from './supabase';
import type { Driver } from '@/types';
import { generateId } from './utils';

function mapDriverRow(row: any): Driver {
  return {
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    home_region: row.home_region,
    max_capacity: row.max_capacity,
    phone: row.phone || row.raw_data?.phone || undefined,
    is_active: row.is_active !== false,
  };
}

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
    return (data || []).map(mapDriverRow);
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
  try {
    const { data, error } = await supabase
      .from(TABLES.DRIVERS)
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapDriverRow);
  } catch (error) {
    console.error('Error getting active drivers:', error);
    return [];
  }
}

export async function clearDrivers() {
  try {
    const { error } = await supabase
      .from(TABLES.DRIVERS)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  } catch (error) {
    console.error('Error clearing drivers:', error);
    throw error;
  }
}
