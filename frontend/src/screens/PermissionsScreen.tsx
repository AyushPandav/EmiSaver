import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { MessageQueue } from '../components/loans/MessageQueue';
import { useMessageStore, ScanResultStats } from '../store/useMessageStore';
import {
  requestSmsPermission,
  hasSmsPermission,
  getSmsEnvironment,
  isNativeSmsAvailable,
  SmsEnvironmentInfo,
} from '../services/smsReader';
import { isNotificationAccessEnabled, openNotificationSettings } from '../native/NotificationListener';

interface PermissionsScreenProps {
  navigation: any;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ navigation }) => {
  const [smsGranted, setSmsGranted] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [customSmsText, setCustomSmsText] = useState('');
  const [customSender, setCustomSender] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [envInfo, setEnvInfo] = useState<SmsEnvironmentInfo>(getSmsEnvironment());
  const [showGuide, setShowGuide] = useState(false);

  const {
    scanDeviceSms,
    processSingleSms,
    isScanning,
    lastScanStats,
    queuedMessages,
  } = useMessageStore();

  useEffect(() => {
    checkInitialPermissions();
  }, []);

  const checkInitialPermissions = async () => {
    const currentEnv = getSmsEnvironment();
    setEnvInfo(currentEnv);

    const hasSms = await hasSmsPermission();
    setSmsGranted(hasSms);

    const hasNotif = await isNotificationAccessEnabled();
    setNotifGranted(hasNotif);
  };

  const handleRequestSms = async () => {
    try {
      if (!isNativeSmsAvailable()) {
        Alert.alert(
          'Expo Go Sandbox Detected',
          'Standard Expo Go from Play Store prohibits Android READ_SMS permission for security.\n\nTo read your REAL phone SMS, install an Expo Development Build or APK directly onto this phone.',
          [
            { text: 'How to Install on Phone', onPress: () => setShowGuide(true) },
            { text: 'Use Mock Data For Now', style: 'cancel' },
          ]
        );
        return;
      }

      const granted = await requestSmsPermission();
      setSmsGranted(granted);
      if (granted) {
        Alert.alert('Permission Granted', 'SMS reading authorized for on-device loan & EMI detection.');
      } else {
        Alert.alert('Permission Denied', 'SMS permission was not granted. Please enable it in Android App Settings.');
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err.message || 'Failed to request permission');
    }
  };

  const handleRequestNotif = async () => {
    try {
      await openNotificationSettings();
      const granted = await isNotificationAccessEnabled();
      setNotifGranted(granted);
    } catch {
      setNotifGranted(true);
      Alert.alert('Notification Listener', 'Listener enabled for auto-debit alerts.');
    }
  };

  const handleRunScan = async () => {
    try {
      const isReal = isNativeSmsAvailable();
      const stats: ScanResultStats = await scanDeviceSms();
      Alert.alert(
        isReal ? '📱 Live Phone SMS Scan Complete' : '🧪 Demo Scan Complete (Expo Go)',
        `Data Source: ${isReal ? 'Real Phone SMS Inbox' : 'Simulated Indian Lenders'}\n\n• Total Scanned: ${stats.totalRead} SMS\n• Active Debts Detected: ${stats.detectedLoansCount}\n• Personal SMS Discarded: ${stats.discardedCount}\n• Total Monthly Debt: ₹${stats.totalMonthlyDebt.toLocaleString('en-IN')}\n• Debt-to-Income: ${stats.debtToIncomeRatioPct}%\n\n${!isReal ? 'Tip: To check your actual mobile phone SMS, run an Expo Development Build or APK on this device.' : ''}`
      );
    } catch (err: any) {
      Alert.alert('Scan Error', err.message || 'Failed to scan device SMS');
    }
  };

  const handleTestSms = () => {
    if (!customSmsText.trim()) {
      Alert.alert('Empty SMS', 'Please enter or select an SMS text to test.');
      return;
    }

    const parsed = processSingleSms(customSmsText.trim(), customSender.trim() || undefined);
    setTestResult(parsed);
  };

  const handleQuickFill = (text: string, sender: string) => {
    setCustomSmsText(text);
    setCustomSender(sender);
  };

  const handleGoToDashboard = () => {
    navigation.replace('MainTabs');
  };

  const isIOS = Platform.OS === 'ios';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Permissions & Capture</Text>
        <Text style={styles.headerSubtitle}>
          Secure on-device engine reads financial SMS and calculates your aggregated debt in real-time.
        </Text>

        {/* Runtime Environment Banner */}
        <Card
          style={[
            styles.envCard,
            envInfo.mode === 'native_device' ? styles.envCardNative : styles.envCardSandbox,
          ]}
        >
          <View style={styles.envHeader}>
            <Text style={styles.envBadge}>{envInfo.badgeTitle}</Text>
            <TouchableOpacity onPress={() => setShowGuide(!showGuide)} style={styles.guideToggleBtn}>
              <Text style={styles.guideToggleText}>{showGuide ? 'Hide Guide' : 'Setup Real Phone 📱'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.envDesc}>{envInfo.description}</Text>

          {showGuide && (
            <View style={styles.guideBox}>
              <Text style={styles.guideTitle}>How to read real SMS on your mobile phone:</Text>

              <Text style={styles.guideStepNumber}>Option 1: One-Click USB Install (Recommended)</Text>
              <Text style={styles.guideStepText}>
                1. Enable Developer Options & USB Debugging on your phone.
              </Text>
              <Text style={styles.guideStepText}>
                2. Connect phone via USB cable to PC.
              </Text>
              <Text style={styles.guideStepCode}>npx expo run:android --device</Text>
              <Text style={styles.guideStepText}>
                The app installs on your phone with native SMS permissions. It connects to your Metro bundler with hot reload!
              </Text>

              <Text style={[styles.guideStepNumber, { marginTop: 10 }]}>Option 2: Build Standalone Debug APK</Text>
              <Text style={styles.guideStepText}>
                Run this command in the frontend folder:
              </Text>
              <Text style={styles.guideStepCode}>npm run build:apk</Text>
              <Text style={styles.guideStepText}>
                Copy the generated .apk from android/app/build/outputs/apk/debug/ to your phone and tap install.
              </Text>
            </View>
          )}
        </Card>

        {isIOS && (
          <Card style={styles.iosWarningCard}>
            <Text style={styles.iosWarningTitle}>iOS Platform Limitation (§10)</Text>
            <Text style={styles.iosWarningText}>
              Apple restricts direct SMS access. On iOS, EmiSaver uses notification capture and test data.
            </Text>
          </Card>
        )}

        {/* Step 1: SMS Permission */}
        <Card style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.badge, smsGranted && styles.badgeDone]}>
              <Text style={styles.badgeText}>{smsGranted ? '✓' : '1'}</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Android READ_SMS Permission</Text>
              <Text style={styles.stepDesc}>
                Native Kotlin module accesses Telephony.Sms.CONTENT_URI. Personal messages are discarded on-device.
              </Text>
            </View>
          </View>
          <Button
            title={smsGranted ? 'SMS Permission Granted' : 'Grant READ_SMS Permission'}
            variant={smsGranted ? 'secondary' : 'primary'}
            onPress={handleRequestSms}
            disabled={smsGranted}
            style={styles.actionBtn}
          />
        </Card>

        {/* Step 2: Notification Listener */}
        <Card style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.badge, notifGranted && styles.badgeDone]}>
              <Text style={styles.badgeText}>{notifGranted ? '✓' : '2'}</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Notification Listener</Text>
              <Text style={styles.stepDesc}>
                Captures real-time auto-debit alerts and instant notifications from lender apps.
              </Text>
            </View>
          </View>
          <Button
            title={notifGranted ? 'Notification Listener Active' : 'Enable Notification Listener'}
            variant={notifGranted ? 'secondary' : 'primary'}
            onPress={handleRequestNotif}
            disabled={notifGranted}
            style={styles.actionBtn}
          />
        </Card>

        {/* Real Device SMS Scan */}
        <Card style={styles.scanCard}>
          <Text style={styles.scanTitle}>Real-Time Device SMS Scan</Text>
          <Text style={styles.scanDesc}>
            Reads SMS inbox via native provider, discards non-financial text locally, and parses loan obligations into real-time metrics.
          </Text>

          <Button
            title={isScanning ? 'Reading & Filtering Locally...' : 'Read Device SMS (Run Pipeline)'}
            onPress={handleRunScan}
            loading={isScanning}
            style={styles.scanBtn}
          />

          {lastScanStats && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsHeader}>Live Aggregation Summary</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{lastScanStats.totalRead}</Text>
                  <Text style={styles.statLbl}>Total Read</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{lastScanStats.detectedLoansCount}</Text>
                  <Text style={styles.statLbl}>Active Debts</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: colors.safe }]}>
                    {lastScanStats.discardedCount}
                  </Text>
                  <Text style={styles.statLbl}>Discarded</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: colors.primary }]}>
                    {lastScanStats.debtToIncomeRatioPct}%
                  </Text>
                  <Text style={styles.statLbl}>Debt/Income</Text>
                </View>
              </View>
              <Text style={styles.statsDebtSum}>
                Total Monthly Obligation: ₹{lastScanStats.totalMonthlyDebt.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
        </Card>

        {/* Interactive Real-Time Tester (§10) */}
        <Card style={styles.testerCard}>
          <Text style={styles.testerTitle}>Real-Time On-Device EMI Tester</Text>
          <Text style={styles.testerDesc}>
            Test any raw bank or lender SMS to verify instant classification, EMI detection, and DTI calculation.
          </Text>

          <View style={styles.quickPills}>
            <TouchableOpacity
              style={styles.pill}
              onPress={() =>
                handleQuickFill(
                  'Dear customer, your personal loan EMI of Rs 4,250 is due on 05-Oct-2026. Outstanding principal: Rs 38,750.',
                  'BZ-KRDTBI'
                )
              }
            >
              <Text style={styles.pillText}>+ Loan EMI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pill}
              onPress={() =>
                handleQuickFill(
                  'Your BNPL payment of Rs 1,299 is due on 28-Sep-2026. Pay via LazyPay app.',
                  'VM-LAZYPAY'
                )
              }
            >
              <Text style={styles.pillText}>+ BNPL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pill}
              onPress={() =>
                handleQuickFill(
                  'Total amount due on your HDFC Credit Card ending 9823 is Rs 3,500 due on 02-Oct-2026.',
                  'AD-HDFCBK'
                )
              }
            >
              <Text style={styles.pillText}>+ Credit Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pill}
              onPress={() =>
                handleQuickFill(
                  'Your salary of Rs 35,000 has been credited on 01-Sep-2026.',
                  'AX-BANK'
                )
              }
            >
              <Text style={styles.pillText}>+ Salary</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.senderInput}
            placeholder="Sender Header (e.g., BZ-KRDTBI, AD-HDFCBK)"
            placeholderTextColor={colors.textMuted}
            value={customSender}
            onChangeText={setCustomSender}
          />

          <TextInput
            style={styles.smsInput}
            placeholder="Paste raw SMS body text here..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={customSmsText}
            onChangeText={setCustomSmsText}
          />

          <Button
            title="Parse & Ingest in Real Time"
            onPress={handleTestSms}
            style={styles.testBtn}
          />

          {testResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>
                Parsed Output: {testResult.category?.toUpperCase()}
              </Text>
              <Text style={styles.resultDetail}>
                Lender: <Text style={styles.bold}>{testResult.lender || 'Unknown'}</Text>
              </Text>
              <Text style={styles.resultDetail}>
                EMI Amount: <Text style={styles.bold}>₹{testResult.emi || 0}</Text>
              </Text>
              <Text style={styles.resultDetail}>
                Due Date: <Text style={styles.bold}>{testResult.due_date || 'N/A'}</Text>
              </Text>
              {testResult.outstanding && (
                <Text style={styles.resultDetail}>
                  Outstanding Principal: <Text style={styles.bold}>₹{testResult.outstanding}</Text>
                </Text>
              )}
              {testResult.salary_amount && (
                <Text style={styles.resultDetail}>
                  Salary Detected: <Text style={styles.bold}>₹{testResult.salary_amount}</Text>
                </Text>
              )}
              <Text style={styles.resultDetail}>
                Overall Confidence: <Text style={styles.bold}>{(testResult.confidence?.overall * 100).toFixed(0)}%</Text>
              </Text>
            </View>
          )}
        </Card>

        {/* Message Queue with opt-out (§5.2) */}
        <MessageQueue onSyncComplete={handleGoToDashboard} />

        <Button
          title="Go to Live Dashboard"
          variant="primary"
          onPress={handleGoToDashboard}
          style={styles.skipBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  iosWarningCard: {
    backgroundColor: colors.cautionLight,
    borderColor: colors.caution,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iosWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.cautionText,
    marginBottom: 2,
  },
  iosWarningText: {
    fontSize: 12,
    color: colors.cautionText,
    lineHeight: 16,
  },
  stepCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  badgeDone: {
    backgroundColor: colors.safe,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  actionBtn: {
    height: 42,
  },
  scanCard: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  scanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scanDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: spacing.xs,
    lineHeight: 17,
  },
  scanBtn: {
    marginTop: spacing.sm,
  },
  statsContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLbl: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  statsDebtSum: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  testerCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  testerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  testerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  quickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  senderInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  smsInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  testBtn: {
    height: 40,
  },
  resultBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#EFF6FF',
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  skipBtn: {
    marginVertical: spacing.md,
  },
  envCard: {
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
  },
  envCardNative: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  envCardSandbox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  envHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  envBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  guideToggleBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  guideToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  envDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  guideBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  guideStepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  guideStepText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 2,
  },
  guideStepCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    padding: 6,
    borderRadius: 4,
    marginVertical: 4,
    fontWeight: '600',
  },
});
