import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { apiClient } from '../../api/client';
import { LoanSimulationResult } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface LoanSimulatorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmTakeLoan?: (loanData: { lender: string; emiAmount: number; principalAmount?: number }) => void;
}

export const LoanSimulatorModal: React.FC<LoanSimulatorModalProps> = ({
  visible,
  onClose,
  onConfirmTakeLoan,
}) => {
  const [loanAmount, setLoanAmount] = useState('');
  const [newEmi, setNewEmi] = useState('');
  const [durationMonths, setDurationMonths] = useState('6');
  const [dueDay, setDueDay] = useState('15');
  const [lenderName, setLenderName] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LoanSimulationResult | null>(null);

  const handleSimulate = async () => {
    const emi = parseFloat(newEmi);
    const duration = parseInt(durationMonths, 10);
    const principal = loanAmount ? parseFloat(loanAmount) : undefined;
    const day = dueDay ? parseInt(dueDay, 10) : undefined;

    if (isNaN(emi) || emi <= 0) {
      Alert.alert('Invalid EMI', 'Please enter a valid monthly EMI amount.');
      return;
    }
    if (isNaN(duration) || duration <= 0) {
      Alert.alert('Invalid Duration', 'Please enter loan duration in months.');
      return;
    }

    setLoading(true);
    try {
      const simResult = await apiClient.simulateLoan({
        loanAmount: principal,
        newEmi: emi,
        durationMonths: duration,
        preferredDueDay: day,
      });
      setResult(simResult);
    } catch (err: any) {
      Alert.alert('Simulation Error', err.message || 'Failed to simulate loan.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  const handleTakeLoan = () => {
    const emi = parseFloat(newEmi);
    const principal = loanAmount ? parseFloat(loanAmount) : undefined;
    onClose();
    if (onConfirmTakeLoan) {
      onConfirmTakeLoan({
        lender: lenderName.trim() || 'New Loan',
        emiAmount: emi,
        principalAmount: principal,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>New Loan Simulation</Text>
              <Text style={styles.subtitle}>"What-if" repayment burden calculator</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {!result ? (
              // Input Form (§3.3)
              <View>
                <Input
                  label="Lender / App Name (Optional)"
                  placeholder="e.g. KreditBee, Navi"
                  value={lenderName}
                  onChangeText={setLenderName}
                />
                <Input
                  label="Loan Amount (Optional)"
                  prefix="₹"
                  placeholder="20,000"
                  keyboardType="numeric"
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                />
                <Input
                  label="New Monthly EMI *"
                  prefix="₹"
                  placeholder="3,500"
                  keyboardType="numeric"
                  value={newEmi}
                  onChangeText={setNewEmi}
                />
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Input
                      label="Duration (Months) *"
                      placeholder="6"
                      keyboardType="numeric"
                      value={durationMonths}
                      onChangeText={setDurationMonths}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Due Day of Month"
                      placeholder="15"
                      keyboardType="numeric"
                      value={dueDay}
                      onChangeText={setDueDay}
                    />
                  </View>
                </View>

                <Button
                  title="Simulate Impact"
                  onPress={handleSimulate}
                  loading={loading}
                  style={styles.simBtn}
                />
              </View>
            ) : (
              // Simulation Output (§3.3)
              <View>
                {/* Comparison Card */}
                <View style={styles.resultCard}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Current EMI</Text>
                    <Text style={styles.metricVal}>{formatCurrency(result.currentEmi)}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>New EMI</Text>
                    <Text style={styles.metricVal}>+ {formatCurrency(result.newEmi)}</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.metricRow}>
                    <Text style={styles.boldLabel}>Combined Monthly EMI</Text>
                    <Text style={styles.boldVal}>{formatCurrency(result.combinedEmi)}</Text>
                  </View>
                </View>

                {/* Ratio Impact (§3.3) */}
                <View style={[
                  styles.ratioBox,
                  result.isAboveSafeLimit ? styles.ratioBoxWarn : styles.ratioBoxSafe
                ]}>
                  <View style={styles.ratioHeader}>
                    <Text style={styles.ratioHeaderLabel}>Repayment-to-Income Impact</Text>
                    <Text style={[
                      styles.statusPill,
                      result.isAboveSafeLimit ? styles.statusPillWarn : styles.statusPillSafe
                    ]}>
                      {result.isAboveSafeLimit ? '⚠️ Above Safe Limit' : '✓ Within Safe Limit'}
                    </Text>
                  </View>

                  <View style={styles.ratioComparison}>
                    <View style={styles.ratioCol}>
                      <Text style={styles.colLabel}>Before</Text>
                      <Text style={styles.colVal}>{result.ratioBefore}%</Text>
                    </View>
                    <Text style={styles.arrow}>➔</Text>
                    <View style={styles.ratioCol}>
                      <Text style={styles.colLabel}>After</Text>
                      <Text style={[
                        styles.colVal,
                        { color: result.isAboveSafeLimit ? colors.riskHigh : colors.primary }
                      ]}>
                        {result.ratioAfter}%
                      </Text>
                    </View>
                    <View style={styles.ratioCol}>
                      <Text style={styles.colLabel}>Delta</Text>
                      <Text style={[styles.colVal, { color: colors.riskMedium }]}>
                        +{result.deltaPp} pp
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.commitmentText}>
                    +{formatCurrency(result.additionalMonthlyCommitment)} additional monthly commitment
                  </Text>
                  <Text style={styles.safeNote}>
                    Your configured safe threshold: {result.safeLimitPct}%
                  </Text>
                </View>

                {/* Calendar Impact (§3.3 & §4.3) */}
                <View style={styles.calendarImpactCard}>
                  <Text style={styles.impactTitle}>📅 Calendar & Concentration Impact</Text>
                  <Text style={styles.impactSummary}>
                    {result.calendarImpact.impactSummary}
                  </Text>
                  {result.calendarImpact.createsNewPressureWindow && (
                    <Text style={styles.collisionAlertText}>
                      ⚠️ Note: This payment timing clusters with existing repayments.
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <Button
                    title="Edit Simulation"
                    variant="outline"
                    onPress={handleReset}
                    style={{ flex: 1, marginRight: spacing.sm }}
                  />
                  <Button
                    title="I Took This Loan"
                    onPress={handleTakeLoan}
                    style={{ flex: 1 }}
                  />
                </View>
                <Text style={styles.disclaimer}>
                  Simulations are ephemeral and do not modify your loan records unless confirmed.
                </Text>
              </View>
            )}
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
    maxHeight: '90%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textMuted,
    padding: spacing.xs,
  },
  body: {
    marginBottom: spacing.base,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  simBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  resultCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusMd,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  boldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  boldVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  ratioBox: {
    borderRadius: spacing.radiusMd,
    padding: spacing.base,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  ratioBoxWarn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
  },
  ratioBoxSafe: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  ratioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ratioHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillWarn: {
    color: colors.riskHigh,
  },
  statusPillSafe: {
    color: colors.riskLow,
  },
  ratioComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: spacing.xs,
  },
  ratioCol: {
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  colVal: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  arrow: {
    fontSize: 16,
    color: colors.textMuted,
  },
  commitmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  safeNote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  calendarImpactCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusMd,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  impactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  impactSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  collisionAlertText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.riskHigh,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  disclaimer: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.base,
  },
});
