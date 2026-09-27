/**
 * Notification Listener Native Module Bridge
 *
 * Provides a TypeScript interface over Android's NotificationListenerService.
 * In production, the native Java/Kotlin service captures all notifications.
 * This bridge provides the JS-side API + a mock for development.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface CapturedNotification {
  id: string;
  packageName: string;
  title: string;
  text: string;
  receivedAt: string;
}

interface NotificationListenerNativeInterface {
  /** Start listening for notifications (requires NotificationListenerService permission). */
  startListening(): Promise<void>;

  /** Stop the notification listener. */
  stopListening(): Promise<void>;

  /** Check if notification access is enabled in system settings. */
  isEnabled(): Promise<boolean>;

  /** Open system settings to grant notification access. */
  openSettings(): Promise<void>;

  /** Get recent captured notifications (last N hours). */
  getRecentNotifications(hoursBack: number): Promise<CapturedNotification[]>;
}

// Attempt to get the native module; null in dev/web
const NativeNotificationListener: NotificationListenerNativeInterface | undefined =
  NativeModules.EmiSaverNotificationListener;

// Event emitter for real-time notification capture
let eventEmitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (eventEmitter) return eventEmitter;
  if (NativeNotificationListener && Platform.OS === 'android') {
    eventEmitter = new NativeEventEmitter(NativeModules.EmiSaverNotificationListener);
  }
  return eventEmitter;
}

/**
 * Check if notification access permission is granted.
 */
export async function isNotificationAccessEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  if (NativeNotificationListener) {
    return NativeNotificationListener.isEnabled();
  }

  // Dev fallback: assume not enabled
  return false;
}

/**
 * Open the system Notification Access settings page
 * so the user can enable EmiSaver's listener.
 */
export async function openNotificationSettings(): Promise<void> {
  if (NativeNotificationListener) {
    return NativeNotificationListener.openSettings();
  }

  console.info('[NotificationListener] Native module not available, cannot open settings');
}

/**
 * Start the real-time notification listener.
 */
export async function startNotificationListener(): Promise<void> {
  if (NativeNotificationListener) {
    return NativeNotificationListener.startListening();
  }

  console.info('[NotificationListener] Native module not available, using mock mode');
}

/**
 * Stop the notification listener.
 */
export async function stopNotificationListener(): Promise<void> {
  if (NativeNotificationListener) {
    return NativeNotificationListener.stopListening();
  }
}

/**
 * Subscribe to real-time notification events.
 * Returns an unsubscribe function.
 */
export function onNotificationReceived(
  callback: (notification: CapturedNotification) => void
): () => void {
  const emitter = getEmitter();
  if (emitter) {
    const subscription = emitter.addListener('onNotificationReceived', callback);
    return () => subscription.remove();
  }

  // Dev fallback: no-op
  console.info('[NotificationListener] No native emitter, events will not fire');
  return () => {};
}

/**
 * Get recently captured notifications.
 * Falls back to mock data in development.
 */
export async function getRecentNotifications(
  hoursBack: number = 24
): Promise<CapturedNotification[]> {
  if (NativeNotificationListener) {
    return NativeNotificationListener.getRecentNotifications(hoursBack);
  }

  // Dev mock data
  console.info('[NotificationListener] Returning mock notifications');
  return getMockNotifications();
}

/**
 * Mock notifications for development/testing.
 */
function getMockNotifications(): CapturedNotification[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  return [
    {
      id: 'notif-mock-1',
      packageName: 'com.bajajfinserv.lending',
      title: 'EMI Reminder',
      text: 'Your EMI of ₹3,542 for Loan XXXX7891 is due tomorrow. Tap to pay.',
      receivedAt: new Date(now - 2 * hour).toISOString(),
    },
    {
      id: 'notif-mock-2',
      packageName: 'in.getsimpl.simpl',
      title: 'Bill Generated',
      text: 'Your Simpl bill of ₹1,200 is ready. Pay by 15th to avoid late fee.',
      receivedAt: new Date(now - 8 * hour).toISOString(),
    },
    {
      id: 'notif-mock-3',
      packageName: 'com.slice',
      title: 'Payment Due',
      text: 'Slice card bill ₹2,890 — due 20-Oct. Auto-debit is scheduled.',
      receivedAt: new Date(now - 12 * hour).toISOString(),
    },
  ];
}
