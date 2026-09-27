import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { LoanListItem } from '../components/dashboard/LoanListItem';
import { LoanEditModal } from '../components/loans/LoanEditModal';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useLoansStore } from '../store/useLoansStore';
import { useMessageStore } from '../store/useMessageStore';
import { Loan } from '../types';

export const LoansScreen: React.FC = () => {
  const { loans, updateLoan, mergeLoans, dismissLoan, fetchDashboardData } = useLoansStore();
  const { queueRawMessages, syncFilteredBatch } = useMessageStore();

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');

  // Custom Simulator state for testing arbitrary messages
  const [customSender, setCustomSender] = useState('BZ-KRDTBI');
  const [customText, setCustomText] = useState('₹3,200 repayment due for your KreditBee loan on 25 Sep.');
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async () => {
    if (!customText.trim()) return;
    setSimulating(true);
    try {
      queueRawMessages([
        {
          sender: customSender.trim() || undefined,
          text: customText.trim(),
          date: new Date().toISOString(),
        },
      ]);
      await syncFilteredBatch();
      Alert.alert('Simulated!', 'SMS was parsed on-device and synced as structured loan data.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleMergeAction = (primaryLoanId: string) => {
    const otherLoans = loans.filter(l => l.id !== primaryLoanId);
    if (otherLoans.length === 0) {
      Alert.alert('Merge Loans', 'No other active loan found to merge with.');
      return;
    }

    Alert.alert(
      'Select Loan to Merge',
      'Choose the second loan that represents the same debt obligation:',
      otherLoans.map(other => ({
        text: `${other.lender} (₹${other.emiAmount})`,
        onPress: async () => {
          try {
            await mergeLoans(primaryLoanId, other.id);
            setModalVisible(false);
            Alert.alert('Merged', `Successfully merged with ${other.lender}.`);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      }))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>All Loans & Obligations</Text>
          <Text style={styles.subtitle}>
            Manage canonical records, merge duplicate alerts, and correct details
          </Text>
        </View>

        {/* Live SMS Ingestion Simulator for QA & Demos */}
        <Card style={styles.simulatorCard}>
          <Text style={styles.simulatorTitle}>🧪 Ingest Test SMS / Notification</Text>
          <Input
            label="Sender ID"
            value={customSender}
            onChangeText={setCustomSender}
            placeholder="e.g. BZ-KRDTBI, VM-LAZYPAY, NAVIFN"
          />
          <Input
            label="SMS / Notification Body"
            value={customText}
            onChangeText={setCustomText}
            placeholder="Paste or type lender reminder text..."
            multiline
            numberOfLines={2}
          />
          <Button
            title="Parse & Ingest Message"
            onPress={handleSimulate}
            loading={simulating}
            style={styles.simulateBtn}
          />
        </Card>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Detected Loans ({loans.length})</Text>
        </View>

        {loans.map(loan => (
          <LoanListItem
            key={loan.id}
            loan={loan}
            onPress={() => {
              setSelectedLoan(loan);
              setModalVisible(true);
            }}
          />
        ))}

        {loans.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No loans recorded yet.</Text>
          </View>
        )}
      </ScrollView>

      <LoanEditModal
        visible={modalVisible}
        loan={selectedLoan}
        onClose={() => setModalVisible(false)}
        onSave={updateLoan}
        onMerge={handleMergeAction}
        onDismissNotLoan={dismissLoan}
      />
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
  header: {
    marginBottom: spacing.base,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  simulatorCard: {
    padding: spacing.base,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.lg,
  },
  simulatorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  simulateBtn: {
    height: 44,
  },
  listHeader: {
    marginBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
