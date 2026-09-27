/**
 * SMS Reader Native Module Bridge
 *
 * Provides a TypeScript interface over the native Android SMS content provider.
 * In production, the native Java/Kotlin module reads from content://sms/inbox.
 * This bridge provides the JS-side API + a mock for development/emulators.
 */

import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

export interface RawSmsMessage {
  id: string;
  address: string; // sender phone or short-code
  body: string;
  date: string;    // ISO 8601 timestamp
  read: boolean;
}

interface SmsReaderNativeInterface {
  /**
   * Read SMS messages from the device inbox.
   * @param lookbackDays - Number of days to look back (default: 180)
   * @param maxCount     - Maximum messages to return (default: 500)
   */
  readInbox(lookbackDays: number, maxCount: number): Promise<RawSmsMessage[]>;

  /** Check if SMS read permission is already granted. */
  hasPermission(): Promise<boolean>;
}

// Attempt to get the native module (SmsReader or EmiSaverSmsReader)
const NativeSmsReader: any =
  NativeModules.SmsReader || NativeModules.EmiSaverSmsReader;

/**
 * Check if the native Android SMS reader module is available in this runtime.
 */
export function isNativeSmsAvailable(): boolean {
  return Platform.OS === 'android' && !!NativeSmsReader;
}

/**
 * Request Android READ_SMS permission.
 * Returns true if granted or already granted.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Access',
        message:
          'EmiSaver needs to read your SMS messages to automatically detect EMI payments and loan-related notifications.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[SmsReader] Permission request failed:', err);
    return false;
  }
}

/**
 * Check if READ_SMS is already granted.
 */
export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  if (NativeSmsReader) {
    return NativeSmsReader.hasPermission();
  }

  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
  } catch {
    return false;
  }
}

/**
 * Read SMS inbox messages from the device.
 *
 * In production: delegates to the native EmiSaverSmsReader module.
 * In development (no native module): returns mock data for testing the pipeline.
 *
 * @param lookbackDays - How many days back to scan (default 180)
 * @param maxCount     - Max messages to return (default 500)
 */
export async function readSms(): Promise<RawSmsMessage[]> {
  return readSmsInbox();
}

/**
 * Read SMS inbox messages from the device.
 *
 * In production: delegates to the native SmsReader module.
 * In development (no native module): returns mock data for testing the pipeline.
 *
 * @param lookbackDays - How many days back to scan (default 180)
 * @param maxCount     - Max messages to return (default 500)
 */
export async function readSmsInbox(
  lookbackDays: number = 180,
  maxCount: number = 500
): Promise<RawSmsMessage[]> {
  // Native module available — use it
  if (NativeSmsReader) {
    try {
      if (typeof NativeSmsReader.readInbox === 'function') {
        const msgs = await NativeSmsReader.readInbox(lookbackDays, maxCount);
        if (Array.isArray(msgs)) return msgs;
      }
      if (typeof NativeSmsReader.getMessages === 'function') {
        const msgs = await NativeSmsReader.getMessages();
        if (Array.isArray(msgs)) {
          return msgs.map((m: any) => ({
            id: String(m.id || Math.random().toString(36).substring(2, 9)),
            address: String(m.sender || m.address || 'Unknown'),
            body: String(m.body || ''),
            date: m.date || (m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString()),
            read: true,
          }));
        }
      }
    } catch (err) {
      console.warn('[SmsReader] Native call failed, falling back:', err);
    }
  }

  // Development fallback: return mock loan-related SMS data
  console.info('[SmsReader] Native module not available, returning mock data');
  return getMockMessages();
}

/**
 * Mock messages for development/testing.
 * Covers common Indian lender SMS patterns.
 */
function getMockMessages(): RawSmsMessage[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'mock-1',
      address: 'AD-BAJFIN',
      body: 'Your EMI of Rs.3,542 for Loan A/c XXXX7891 is due on 05-Oct-2025. Pay on time to avoid late fee. - Bajaj Finance',
      date: new Date(now - 2 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-2',
      address: 'JM-SIMPL',
      body: 'Simpl bill of Rs.1,200 is generated. Pay by 15-Oct to avoid late charges. Download app to pay now.',
      date: new Date(now - 5 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-3',
      address: 'AD-HDFC',
      body: 'Dear Customer, your HDFC Personal Loan EMI of Rs 8,456.00 has been debited from A/c XX3421 on 01-Oct-25.',
      date: new Date(now - 10 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-4',
      address: 'VM-SLICE',
      body: 'Your slice card bill of Rs 2,890 is ready. Due date: 20-Oct-2025. Pay via app or auto-debit.',
      date: new Date(now - 3 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-5',
      address: 'AM-LAZYPAY',
      body: 'Hi! Your LazyPay EMI of INR 1,500 for Oct is due on 10th. Tap to pay: https://lazypay.in/p',
      date: new Date(now - 1 * day).toISOString(),
      read: false,
    },
    {
      id: 'mock-6',
      address: 'BZ-AMAZON',
      body: 'Amazon Pay Later: Your monthly instalment of Rs. 750 is due on 12-Oct. Pay now to maintain good standing.',
      date: new Date(now - 7 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-7',
      address: 'HP-ICICI',
      body: 'Txn alert: EMI Rs.5,200 debited from ICICI A/c XX9812 towards Home Loan on 01-Oct-25. Avl bal Rs.23,450.',
      date: new Date(now - 10 * day).toISOString(),
      read: true,
    },
    {
      id: 'mock-8',
      address: 'BW-MONEY',
      body: 'Enjoy 50% off on your next pizza order! Use code PIZZA50 at checkout.',
      date: new Date(now - 4 * day).toISOString(),
      read: true,
    },
  ];
}
