// WhatsApp message DB operations
import { supabase, TABLES } from './supabase';
import { generateId } from './utils';

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
