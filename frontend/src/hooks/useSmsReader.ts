/**
 * useSmsReader — Hook for reading SMS messages from the device.
 *
 * Orchestrates: permission check → SMS read → on-device filter → queue into store.
 */

import { useCallback, useState } from 'react';
import {
  readSmsInbox,
  requestSmsPermission,
  hasSmsPermission,
  RawSmsMessage,
} from '../native/SmsReader';
import { useMessageStore } from '../store/useMessageStore';

interface UseSmsReaderReturn {
  isScanning: boolean;
  hasPermission: boolean | null;
  scanError: string | null;
  totalRead: number;
  filteredCount: number;

  /** Request SMS permission from the OS. */
  requestPermission: () => Promise<boolean>;

  /** Scan inbox, filter, and queue messages for review. */
  scanInbox: (lookbackDays?: number) => Promise<void>;

  /** Sync the filtered queue to the backend. */
  syncToBackend: () => Promise<number>;
}

export function useSmsReader(): UseSmsReaderReturn {
  const { queueRawMessages, syncFilteredBatch, queuedMessages, isScanning: storeScanning } =
    useMessageStore();

  const [hasPermissionState, setHasPermission] = useState<boolean | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [totalRead, setTotalRead] = useState(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await requestSmsPermission();
      setHasPermission(granted);
      return granted;
    } catch (err: any) {
      setScanError(err.message);
      return false;
    }
  }, []);

  const scanInbox = useCallback(
    async (lookbackDays: number = 180) => {
      setScanError(null);

      // Check permission first
      const permitted = await hasSmsPermission();
      setHasPermission(permitted);

      if (!permitted) {
        const granted = await requestSmsPermission();
        setHasPermission(granted);
        if (!granted) {
          setScanError('SMS permission denied. Enable it in Settings to scan loan messages.');
          return;
        }
      }

      try {
        const messages: RawSmsMessage[] = await readSmsInbox(lookbackDays);
        setTotalRead(messages.length);

        // Convert to the format expected by the message store
        const rawList = messages.map(m => ({
          sender: m.address,
          text: m.body,
          date: m.date,
        }));

        queueRawMessages(rawList);
      } catch (err: any) {
        setScanError(err.message || 'Failed to read SMS inbox');
      }
    },
    [queueRawMessages]
  );

  const syncToBackend = useCallback(async (): Promise<number> => {
    try {
      setScanError(null);
      return await syncFilteredBatch();
    } catch (err: any) {
      setScanError(err.message || 'Failed to sync messages');
      throw err;
    }
  }, [syncFilteredBatch]);

  return {
    isScanning: storeScanning,
    hasPermission: hasPermissionState,
    scanError,
    totalRead,
    filteredCount: queuedMessages.filter(m => !m.excluded).length,
    requestPermission,
    scanInbox,
    syncToBackend,
  };
}
