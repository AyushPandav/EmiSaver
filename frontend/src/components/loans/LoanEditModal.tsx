import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Loan, LoanTimelineNode } from '../../types';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { apiClient } from '../../api/client';
import { LoanTimeline } from './LoanTimeline';

interface LoanEditModalProps {
  visible: boolean;
  loan: Loan | null;
  onClose: () => void;
  onSave: (loanId: string, updates: any) => Promise<void>;
  onMerge: (primaryId: string) => void;
  onDismissNotLoan: (loanId: string) => Promise<void>;
}

export const LoanEditModal: React.FC<LoanEditModalProps> = ({
  visible,
  loan,
  onClose,
  onSave,
  onMerge,
  onDismissNotLoan,
}) => {
  if (!loan) return null;

  const [lender, setLender] = useState(loan.lender);
  const [loanIdentifier, setLoanIdentifier] = useState(loan.loanIdentifier || '');
  const [emiAmount, setEmiAmount] = useState(String(loan.emiAmount));
  const [frequency, setFrequency] = useState(loan.repaymentFrequency);
  const [saving, setSaving] = useState(false);
  const [timeline, setTimeline] = useState<LoanTimelineNode[]>([]);

  useEffect(() => {
    if (visible && loan) {
      setLender(loan.lender);
      setLoanIdentifier(loan.loanIdentifier || '');
      setEmiAmount(String(loan.emiAmount));
      setFrequency(loan.repaymentFrequency);
      // Fetch timeline
      apiClient.getLoanTimeline(loan.id)
        .then((res) => setTimeline(res.timeline || []))
        .catch(() => setTimeline([]));
    }
  }, [visible, loan?.id]);

  const handleSave = async () => {
    const numEmi = parseFloat(emiAmount);
    if (isNaN(numEmi) || numEmi <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid EMI amount.');
      return;
    }

    setSaving(true);
    try {
      await onSave(loan.id, {
        lender,
        loan_identifier: loanIdentifier.trim() || undefined,
        emi_amount: numEmi,
        repayment_frequency: frequency,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update loan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    Alert.alert(
      'Mark as Not a Loan',
      'This obligation will be removed from your active EMI load and helps calibrate detection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove & Dismiss',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await onDismissNotLoan(loan.id);
              onClose();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Correct Loan Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {/* Source Detection Info (§6 Phase 2) */}
            <View style={styles.detectionInfoRow}>
              {loan.sourceConfidence != null && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    Confidence: {Math.round(loan.sourceConfidence * 100)}%
                  </Text>
                </View>
              )}
            </View>

            <Input
              label="Lender / App Name"
              value={lender}
              onChangeText={setLender}
              placeholder="e.g. KreditBee, LazyPay"
            />

            <Input
              label="Loan or Account Identifier (Optional)"
              value={loanIdentifier}
              onChangeText={setLoanIdentifier}
              placeholder="e.g. XXXX7841"
            />

            <Input
              label="Monthly EMI Amount"
              prefix="₹"
              value={emiAmount}
              onChangeText={setEmiAmount}
              keyboardType="numeric"
            />

            <Input
              label="Repayment Frequency"
              value={frequency}
              onChangeText={setFrequency}
              placeholder="monthly, weekly, bi-weekly"
            />

            {/* Reconstructed Loan Timeline (§5 Phase 3) */}
            <LoanTimeline timeline={timeline} />

            <View style={styles.actionButtons}>
              <Button
                title="Save Changes"
                onPress={handleSave}
                loading={saving}
                style={styles.saveBtn}
              />

              <Button
                title="Merge With Another Loan"
                variant="outline"
                onPress={() => onMerge(loan.id)}
                style={styles.mergeBtn}
              />

              <Button
                title="This is Not a Loan (Dismiss)"
                variant="danger"
                onPress={handleDismiss}
                style={styles.dismissBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.radiusLg,
    borderTopRightRadius: spacing.radiusLg,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textMuted,
    padding: spacing.xs,
  },
  body: {
    marginBottom: spacing.base,
  },
  detectionInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  confidenceBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: spacing.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  confidenceText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '700',
  },
  actionButtons: {
    marginTop: spacing.md,
  },
  saveBtn: {
    marginBottom: spacing.sm,
  },
  mergeBtn: {
    marginBottom: spacing.sm,
  },
  dismissBtn: {
    marginBottom: spacing.base,
  },
});
