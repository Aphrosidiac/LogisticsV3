// Client operations
import { supabase, TABLES } from './supabase';
import type { Client } from '@/types';
import { generateId } from './utils';

export async function getAllClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.CLIENTS)
      .select('*')
      .order('company_name', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      company_name: row.company_name,
      contact_person: row.contact_person || undefined,
      phone: row.phone || undefined,
      delivery_locations: row.delivery_locations || [],
      notes: row.notes || undefined,
      date: row.date || undefined,
      attachment_urls: row.attachment_urls || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error('Error getting all clients:', error);
    return [];
  }
}

export async function addClient(client: Partial<Client>): Promise<Client> {
  try {
    const id = generateId();
    const row = {
      id,
      company_name: client.company_name || '',
      contact_person: client.contact_person || null,
      phone: client.phone || null,
      delivery_locations: client.delivery_locations || [],
      notes: client.notes || null,
      date: client.date || null,
      attachment_urls: client.attachment_urls || [],
    };

    const { error } = await supabase.from(TABLES.CLIENTS).insert(row);
    if (error) {
      console.error('Supabase insert error details:', JSON.stringify(error));
      throw error;
    }

    return { ...client, id, delivery_locations: row.delivery_locations } as Client;
  } catch (error) {
    console.error('Error adding client:', error);
    throw error;
  }
}

export async function updateClient(id: string, updates: Partial<Client>) {
  try {
    const payload: Record<string, any> = {};
    if (updates.company_name !== undefined) payload.company_name = updates.company_name;
    if (updates.contact_person !== undefined) payload.contact_person = updates.contact_person || null;
    if (updates.phone !== undefined) payload.phone = updates.phone || null;
    if (updates.delivery_locations !== undefined) payload.delivery_locations = updates.delivery_locations;
    if (updates.notes !== undefined) payload.notes = updates.notes || null;
    if (updates.date !== undefined) payload.date = updates.date || null;
    if (updates.attachment_urls !== undefined) payload.attachment_urls = updates.attachment_urls;

    const { error } = await supabase.from(TABLES.CLIENTS).update(payload).eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
}

export async function deleteClient(id: string) {
  try {
    const { error } = await supabase.from(TABLES.CLIENTS).delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
}

export async function clearClients() {
  try {
    const { error } = await supabase
      .from(TABLES.CLIENTS)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  } catch (error) {
    console.error('Error clearing clients:', error);
    throw error;
  }
}
