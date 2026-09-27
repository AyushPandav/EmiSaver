/**
 * useNotificationListener — Hook for real-time notification capture.
 *
 * Manages the notification listener lifecycle and feeds captured
 * notifications into the message processing pipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isNotificationAccessEnabled,
  openNotificationSettings,
  startNotificationListener,
  stopNotificationListener,
  onNotificationReceived,
  getRecentNotifications,
  CapturedNotification,
} from '../native/NotificationListener';
import { useMessageStore } from '../store/useMessageStore';

interface UseNotificationListenerReturn {
  /** Whether notification access is enabled in system settings. */
  isEnabled: boolean | null;

  /** Whether the listener is currently active. */
  isListening: boolean;

  /** Count of notifications captured this session. */
  capturedCount: number;

  /** Most recent captured notification. */
  lastNotification: CapturedNotification | null;

  /** Open system settings to enable notification access. */
  openSettings: () => Promise<void>;

  /** Start the real-time listener. */
  start: () => Promise<void>;

  /** Stop the listener. */
  stop: () => Promise<void>;

  /** Scan recent notifications and queue them. */
  scanRecent: (hoursBack?: number) => Promise<void>;
}

export function useNotificationListener(): UseNotificationListenerReturn {
  const { queueRawMessages } = useMessageStore();
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<CapturedNotification | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Check permission on mount
  useEffect(() => {
    isNotificationAccessEnabled().then(setIsEnabled);
  }, []);

  const start = useCallback(async () => {
    const enabled = await isNotificationAccessEnabled();
    setIsEnabled(enabled);

    if (!enabled) {
      return;
    }

    await startNotificationListener();
    setIsListening(true);

    // Subscribe to real-time events
    unsubRef.current = onNotificationReceived((notif) => {
      setLastNotification(notif);
      setCapturedCount(c => c + 1);

      // Feed into message queue
      queueRawMessages([
        {
          sender: notif.packageName,
          text: `${notif.title}: ${notif.text}`,
          date: notif.receivedAt,
        },
      ]);
    });
  }, [queueRawMessages]);

  const stop = useCallback(async () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    await stopNotificationListener();
    setIsListening(false);
  }, []);

  const scanRecent = useCallback(
    async (hoursBack: number = 24) => {
      const notifications = await getRecentNotifications(hoursBack);
      if (notifications.length > 0) {
        queueRawMessages(
          notifications.map(n => ({
            sender: n.packageName,
            text: `${n.title}: ${n.text}`,
            date: n.receivedAt,
          }))
        );
      }
    },
    [queueRawMessages]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, []);

  return {
    isEnabled,
    isListening,
    capturedCount,
    lastNotification,
    openSettings: openNotificationSettings,
    start,
    stop,
    scanRecent,
  };
}
