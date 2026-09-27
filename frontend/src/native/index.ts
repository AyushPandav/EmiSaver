/**
 * Native modules barrel export.
 */
export { readSms, readSmsInbox, requestSmsPermission, hasSmsPermission } from './SmsReader';
export type { RawSmsMessage } from './SmsReader';

export {
  isNotificationAccessEnabled,
  openNotificationSettings,
  startNotificationListener,
  stopNotificationListener,
  onNotificationReceived,
  getRecentNotifications,
} from './NotificationListener';
export type { CapturedNotification } from './NotificationListener';
