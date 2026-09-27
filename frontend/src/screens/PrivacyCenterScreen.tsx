import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { apiClient } from '../api/client';
import { useUserStore } from '../store/useUserStore';

interface ChecklistItem {
  id: string;
  title: string;
  explanation: string;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: 'on_device',
    title: 'SMS processed on device',
    explanation:
      'Extraction runs locally using our on-device rules engine. Only structured fields (amount, due date, lender) are sent to servers.',
  },
  {
    id: 'no_raw_storage',
    title: "Raw messages aren't stored in cloud",
    explanation:
      'Zero raw SMS or notification body text is uploaded during normal operation. Fallback cloud parsing is strictly opt-in with a 14-day auto-expiry.',
  },
  {
    id: 'only_extracted',
    title: 'Only extracted loan information is synced',
    explanation:
      'Only minimal financial fields needed to aggregate your calendar and compute your risk ratio are synced to our secure Neon database.',
  },
  {
    id: 'delete_anytime',
    title: 'You can delete all loan data',
    explanation:
      'A single tap triggers a permanent cascading deletion across all database tables. Your records are wiped cleanly.',
  },
  {
    id: 'no_bureau',
    title: 'No lender or bureau connection',
    explanation:
      'We do not connect to CIBIL, Experian, or lender backends. Everything is reconstructed privately from your own notifications.',
  },
  {
    id: 'no_ads',
    title: 'No advertising profile created',
    explanation:
      'Your financial data is never packaged, profiled, or sold to third-party ad networks or lenders.',
  },
];

export function PrivacyCenterScreen() {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const resetUser = useUserStore((state) => state.reset);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePurgeMessages = () => {
    Alert.alert(
      'Purge Raw Messages',
      'This will delete all raw SMS and notification records stored on the server. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Now',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction('purge');
              const res = await apiClient.purgeRawMessages(false);
              Alert.alert('Purge Complete', res.message);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to purge raw messages.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setLoadingAction('export');
      const exportData = await apiClient.exportUserData();
      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        title: 'EmiSaver Data Export',
        message: jsonString,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Unable to export structured data.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Loan Data',
      'CAUTION: This will permanently delete your entire loan portfolio, schedules, payment history, and profile from the database. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction('delete_all');
              const res = await apiClient.deleteAllData();
              Alert.alert('Data Wiped', res.message);
              if (resetUser) resetUser();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete user records.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>🛡️</Text>
        <Text style={styles.title}>Privacy Center</Text>
        <Text style={styles.subtitle}>
          Your financial data belongs to you. Here is full transparency on how your data is handled.
        </Text>
      </View>

      {/* Transparency Checklist */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Our Privacy Commitments</Text>
        {CHECKLIST.map((item) => {
          const isExpanded = !!expandedItems[item.id];
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.checkItem}
              onPress={() => toggleExpand(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.checkHeader}>
                <Text style={styles.checkIcon}>✓</Text>
                <Text style={styles.checkTitle}>{item.title}</Text>
                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
              </View>
              {isExpanded && (
                <Text style={styles.checkExplanation}>{item.explanation}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Data Location Transparency Table */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Location Audit</Text>
        <Text style={styles.tableSubtitle}>
          Real-time reflection of where information lives:
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, { flex: 1 }]}>Stored Locally (On Device)</Text>
            <Text style={[styles.th, { flex: 1 }]}>Stored in Cloud (Neon DB)</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={[styles.tdCol, { flex: 1 }]}>
              <Text style={styles.tdItem}>• Raw SMS Text</Text>
              <Text style={styles.tdItem}>• Notification Body</Text>
              <Text style={styles.tdItem}>• Sender Header Info</Text>
              <Text style={styles.tdItem}>• On-Device Regex Rules</Text>
            </View>
            <View style={[styles.tdCol, { flex: 1, borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
              <Text style={styles.tdItem}>• EMI Amount</Text>
              <Text style={styles.tdItem}>• Due Date</Text>
              <Text style={styles.tdItem}>• Lender Canonical Name</Text>
              <Text style={styles.tdItem}>• Per-field Confidence</Text>
              <Text style={styles.tdItem}>• Aggregated Risk Metrics</Text>
            </View>
          </View>
        </View>
      </View>

      {/* User Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Controls</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handlePurgeMessages}
          disabled={loadingAction !== null}
        >
          <Text style={styles.actionButtonIcon}>🧹</Text>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionButtonTitle}>Purge Raw Messages</Text>
            <Text style={styles.actionButtonSub}>
              Immediately wipe any temporary fallback messages stored on the server.
            </Text>
          </View>
          {loadingAction === 'purge' && <ActivityIndicator size="small" color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleExportData}
          disabled={loadingAction !== null}
        >
          <Text style={styles.actionButtonIcon}>📤</Text>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionButtonTitle}>Export My Data (JSON)</Text>
            <Text style={styles.actionButtonSub}>
              Download a complete machine-readable copy of your structured loan records.
            </Text>
          </View>
          {loadingAction === 'export' && <ActivityIndicator size="small" color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDeleteAll}
          disabled={loadingAction !== null}
        >
          <Text style={styles.actionButtonIcon}>🗑️</Text>
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionButtonTitle, styles.dangerText]}>Delete All Loan Data</Text>
            <Text style={styles.actionButtonSub}>
              Permanent cascading delete of all loans, schedules, events, and risk snapshots.
            </Text>
          </View>
          {loadingAction === 'delete_all' && <ActivityIndicator size="small" color="#EF4444" />}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  checkItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 16,
    color: '#10B981',
    fontFamily: typography.fontFamilies.bold,
    marginRight: spacing.sm,
  },
  checkTitle: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.textPrimary,
  },
  chevron: {
    fontSize: 11,
    color: colors.textMuted,
  },
  checkExplanation: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: 6,
    paddingLeft: spacing.md + 4,
    lineHeight: 18,
  },
  tableSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontSize: 11,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  tdCol: {
    padding: spacing.sm,
  },
  tdItem: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 4,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dangerButton: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  actionButtonIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  actionTextCol: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
  },
  dangerText: {
    color: '#EF4444',
  },
  actionButtonSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
