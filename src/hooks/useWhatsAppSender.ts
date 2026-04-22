'use client';

import { useState, useCallback } from 'react';
import * as db from '@/lib/db-supabase';

type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

interface DriverSendState {
  status: SendStatus;
  error?: string;
}

interface UseWhatsAppSenderResult {
  sendStates: Record<string, DriverSendState>;
  waConnected: boolean;
  waChecked: boolean;
  checkStatus: () => Promise<void>;
  sendMessage: (recipient: string, message: string, trackingKey: string, logMessage?: string) => Promise<boolean>;
  sendToAll: (items: Array<{ recipient: string; message: string; key: string }>, delayMs?: number) => Promise<void>;
  broadcastStatus: SendStatus;
  broadcastError: string | null;
  broadcast: (recipients: string[], message: string) => Promise<void>;
}

export function useWhatsAppSender(
  addLog?: (type: 'info' | 'success' | 'error' | 'warning', message: string, details?: string) => void
): UseWhatsAppSenderResult {
  const [waConnected, setWaConnected] = useState(false);
  const [waChecked, setWaChecked] = useState(false);
  const [sendStates, setSendStates] = useState<Record<string, DriverSendState>>({});
  const [broadcastStatus, setBroadcastStatus] = useState<SendStatus>('idle');
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setWaConnected(data.connected);
    } catch {
      setWaConnected(false);
    } finally {
      setWaChecked(true);
    }
  }, []);

  const sendMessage = useCallback(async (
    recipient: string,
    message: string,
    trackingKey: string,
    logMessage?: string,
  ): Promise<boolean> => {
    setSendStates(prev => ({ ...prev, [trackingKey]: { status: 'sending' } }));
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, message }),
      });
      const data = await res.json();

      if (data.status === 'success') {
        setSendStates(prev => ({ ...prev, [trackingKey]: { status: 'sent' } }));
        await db.addWhatsAppMessage(recipient, message);
        if (addLog && logMessage) addLog('success', logMessage);
        return true;
      } else {
        setSendStates(prev => ({ ...prev, [trackingKey]: { status: 'failed', error: data.message } }));
        if (addLog && logMessage) addLog('error', `Failed: ${logMessage}`, data.message);
        return false;
      }
    } catch (err: unknown) {
      setSendStates(prev => ({ ...prev, [trackingKey]: { status: 'failed', error: (err as Error).message } }));
      return false;
    }
  }, [addLog]);

  const sendToAll = useCallback(async (
    items: Array<{ recipient: string; message: string; key: string }>,
    delayMs = 400
  ) => {
    for (const item of items) {
      await sendMessage(item.recipient, item.message, item.key);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }, [sendMessage]);

  const broadcast = useCallback(async (recipients: string[], message: string) => {
    if (recipients.length === 0) return;
    setBroadcastStatus('sending');
    setBroadcastError(null);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        try {
          const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient, message }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            await db.addWhatsAppMessage(recipient, message);
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setBroadcastStatus('sent');
      if (addLog) {
        if (successCount > 0) addLog('success', `Broadcast sent to ${successCount} recipient(s)`);
        if (failCount > 0) addLog('warning', `Failed to send to ${failCount} recipient(s)`);
      }
      setTimeout(() => setBroadcastStatus('idle'), 4000);
    } catch (err: unknown) {
      setBroadcastStatus('failed');
      setBroadcastError((err as Error).message);
      if (addLog) addLog('error', 'Broadcast failed', (err as Error).message);
    }
  }, [addLog]);

  return {
    sendStates,
    waConnected,
    waChecked,
    checkStatus,
    sendMessage,
    sendToAll,
    broadcastStatus,
    broadcastError,
    broadcast,
  };
}
