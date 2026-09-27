import {
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export interface SmsMessage {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  type?: number;
  date?: string;
  address?: string;
}

const { SmsReader, EmiSaverSmsReader } = NativeModules;
const ActiveSmsModule = SmsReader || EmiSaverSmsReader;

/**
 * Request READ_SMS permission on Android at runtime.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Access for EMI Detection',
        message:
          'EmiSaver needs access to your SMS messages to securely identify loan, EMI, and BNPL obligations on-device.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[SmsReader] Permission request error:', error);
    return false;
  }
}

/**
 * Check if READ_SMS permission is currently granted.
 */
export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (ActiveSmsModule?.hasPermission) {
    try {
      return await ActiveSmsModule.hasPermission();
    } catch {
      // fallback to PermissionsAndroid
    }
  }

  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  } catch {
    return false;
  }
}

/**
 * Check if the native Android SMS reader module is available in this runtime.
 * Returns true in an Expo Development Build or APK build.
 * Returns false in the Expo Go sandbox (where custom native modules and READ_SMS are restricted).
 */
export function isNativeSmsAvailable(): boolean {
  return Platform.OS === 'android' && !!ActiveSmsModule;
}

export interface SmsEnvironmentInfo {
  isAndroid: boolean;
  hasNativeModule: boolean;
  mode: 'native_device' | 'expo_go_sandbox' | 'web_or_ios';
  badgeTitle: string;
  description: string;
}

/**
 * Returns diagnostic info about whether the app can read real mobile SMS
 * or is running under the Expo Go sandbox fallback.
 */
export function getSmsEnvironment(): SmsEnvironmentInfo {
  const isAndroid = Platform.OS === 'android';
  const hasNative = isNativeSmsAvailable();

  if (isAndroid && hasNative) {
    return {
      isAndroid: true,
      hasNativeModule: true,
      mode: 'native_device',
      badgeTitle: '🟢 Real Mobile SMS Active',
      description: 'Native Android Kotlin bridge is active. Reading real SMS directly from your device inbox.',
    };
  }

  if (isAndroid && !hasNative) {
    return {
      isAndroid: true,
      hasNativeModule: false,
      mode: 'expo_go_sandbox',
      badgeTitle: '🟡 Expo Go Sandbox (Demo Mode)',
      description:
        'Expo Go blocks custom native modules and READ_SMS for security. Install the Expo Dev Build or APK on this phone to read your real SMS.',
    };
  }

  return {
    isAndroid: false,
    hasNativeModule: false,
    mode: 'web_or_ios',
    badgeTitle: 'ℹ️ Mock / Simulation Mode',
    description: 'Direct SMS access is only supported on Android. Running with mock financial data.',
  };
}

/**
 * Read device SMS messages.
 * In a native Android build: queries ContentProvider Telephony.Sms.CONTENT_URI.
 * In development / Expo Go / mock fallback: returns realistic Indian lender SMS data.
 */
export async function readSms(): Promise<SmsMessage[]> {
  const hasNative = isNativeSmsAvailable();

  if (hasNative) {
    const granted = await requestSmsPermission();
    if (!granted) {
      throw new Error('SMS permission was denied. Please allow SMS permission in Android settings.');
    }

    if (ActiveSmsModule?.getMessages) {
      try {
        const messages = await ActiveSmsModule.getMessages();
        if (Array.isArray(messages)) {
          return messages.map((m: any) => ({
            id: String(m.id || Math.random().toString(36).substring(2, 9)),
            sender: String(m.sender || m.address || 'Unknown'),
            body: String(m.body || ''),
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            type: typeof m.type === 'number' ? m.type : 1,
            date: m.date || new Date(typeof m.timestamp === 'number' ? m.timestamp : Date.now()).toISOString(),
            address: m.address || m.sender || 'Unknown',
          }));
        }
      } catch (err) {
        console.warn('[SmsReader] Native getMessages failed:', err);
      }
    }
  }

  // Fallback for development / Expo Go / testing environment
  return getDevelopmentSmsData();
}

/**
 * Read SMS messages with lookback period and max limit.
 */
export async function readSmsInbox(
  lookbackDays: number = 180,
  maxCount: number = 500
): Promise<SmsMessage[]> {
  const hasNative = isNativeSmsAvailable();

  if (hasNative) {
    const granted = await requestSmsPermission();
    if (!granted) {
      throw new Error('SMS permission was denied. Please allow SMS permission in Android settings.');
    }

    if (ActiveSmsModule?.readInbox) {
      try {
        const messages = await ActiveSmsModule.readInbox(lookbackDays, maxCount);
        if (Array.isArray(messages)) {
          return messages.map((m: any) => ({
            id: String(m.id || Math.random().toString(36).substring(2, 9)),
            sender: String(m.sender || m.address || 'Unknown'),
            body: String(m.body || ''),
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            type: typeof m.type === 'number' ? m.type : 1,
            date: m.date || new Date(typeof m.timestamp === 'number' ? m.timestamp : Date.now()).toISOString(),
            address: m.address || m.sender || 'Unknown',
          }));
        }
      } catch (err) {
        console.warn('[SmsReader] Native readInbox failed, falling back to readSms():', err);
      }
    }
  }

  return await readSms();
}

/**
 * Realistic Indian lender and financial SMS mock dataset for local dev / testing.
 */
export function getDevelopmentSmsData(): SmsMessage[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'sms-real-1',
      sender: 'BZ-KRDTBI',
      body: 'Dear customer, your personal loan EMI of Rs 4,250 for Loan A/c XX4912 is due on 05-Oct-2026. Outstanding principal: Rs 38,750.',
      timestamp: now - 1 * day,
      type: 1,
      date: new Date(now - 1 * day).toISOString(),
    },
    {
      id: 'sms-real-2',
      sender: 'VM-LAZYPAY',
      body: 'Your BNPL payment of Rs 1,299 is due on 28-Sep-2026. Pay via LazyPay app to avoid late charges.',
      timestamp: now - 2 * day,
      type: 1,
      date: new Date(now - 2 * day).toISOString(),
    },
    {
      id: 'sms-real-3',
      sender: 'AD-HDFCBK',
      body: 'Total amount due on your HDFC Credit Card ending 9823 is Rs 3,500. Payment due date: 02-Oct-2026. Min due: Rs 500.',
      timestamp: now - 3 * day,
      type: 1,
      date: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'sms-real-4',
      sender: 'NAVIFN',
      body: 'Your Navi Personal Loan EMI of Rs 6,200 is scheduled for auto-debit on 10-Oct-2026. Please maintain sufficient balance.',
      timestamp: now - 4 * day,
      type: 1,
      date: new Date(now - 4 * day).toISOString(),
    },
    {
      id: 'sms-real-5',
      sender: 'JM-SIMPL',
      body: 'Simpl bill of Rs 850 is generated for cycle ending Sep. Pay by 30-Sep.',
      timestamp: now - 5 * day,
      type: 1,
      date: new Date(now - 5 * day).toISOString(),
    },
    {
      id: 'sms-real-6',
      sender: 'AX-SALARY',
      body: 'Your salary of Rs 35,000 has been credited to A/c XX1049 on 01-Sep-2026. Avl bal: Rs 42,310.',
      timestamp: now - 21 * day,
      type: 1,
      date: new Date(now - 21 * day).toISOString(),
    },
    {
      id: 'sms-real-7',
      sender: 'VK-SWIGGY',
      body: 'Hungry? Enjoy 50% off on your next meal using code FEAST50.',
      timestamp: now - 1 * day,
      type: 1,
      date: new Date(now - 1 * day).toISOString(),
    },
    {
      id: 'sms-real-8',
      sender: 'VK-OTP',
      body: 'Your login OTP is 391823. Valid for 10 minutes. Do not share with anyone.',
      timestamp: now - 6 * day,
      type: 1,
      date: new Date(now - 6 * day).toISOString(),
    },
  ];
}
