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
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useUserStore } from '../store/useUserStore';

interface OnboardingScreenProps {
  navigation: any;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  // Default values matching problem statement example: 45,000 income, 18,000 expenses, 40% safe ratio
  const [monthlyIncome, setMonthlyIncome] = useState('45000');
  const [salaryDate, setSalaryDate] = useState('1');
  const [fixedExpenses, setFixedExpenses] = useState('18000');
  const [safeEmiRatio, setSafeEmiRatio] = useState(0.40); // 40%
  const [emergencyBuffer, setEmergencyBuffer] = useState('10000');
  const [calculationMethod, setCalculationMethod] = useState<'gross' | 'net'>('gross');
  const [submitting, setSubmitting] = useState(false);

  const { saveIncomeProfile } = useUserStore();

  // Calculations
  const incomeNum = parseFloat(monthlyIncome) || 0;
  const expensesNum = parseFloat(fixedExpenses) || 0;

  // Formula per §5.1:
  // Gross: Monthly Income * Safe EMI Ratio (Default: ₹45,000 * 40% = ₹18,000)
  // Net: (Monthly Income - Fixed Expenses) * Safe EMI Ratio
  const maxSafeEmi =
    calculationMethod === 'net'
      ? Math.max(0, (incomeNum - expensesNum) * safeEmiRatio)
      : incomeNum * safeEmiRatio;

  const handleContinue = async () => {
    if (incomeNum <= 0) {
      Alert.alert('Required', 'Please enter your monthly take-home salary.');
      return;
    }

    setSubmitting(true);
    try {
      await saveIncomeProfile({
        monthlyIncome: incomeNum,
        salaryDate: parseInt(salaryDate, 10) || 1,
        fixedExpenses: expensesNum,
        safeEmiRatio: safeEmiRatio,
        emergencyBuffer: parseFloat(emergencyBuffer) || 0,
        calculationMethod: calculationMethod,
      });
      navigation.navigate('Permissions');
    } catch (err: any) {
      console.warn('Backend offline or error:', err.message);
      // Allow seamless demo flow
      navigation.navigate('Permissions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Income & Safety Profile</Text>
        <Text style={styles.headerSubtitle}>
          Set your baseline finances so EmiSaver can alert you before risky borrowings.
        </Text>

        <Card style={styles.formCard}>
          <Input
            label="Monthly Take-Home Income"
            prefix="₹"
            value={monthlyIncome}
            onChangeText={setMonthlyIncome}
            keyboardType="numeric"
            placeholder="e.g. 45,000"
            hint="Your net in-hand salary deposited in your account each month."
          />

          <Input
            label="Salary Credit Day of Month (1 - 31)"
            value={salaryDate}
            onChangeText={setSalaryDate}
            keyboardType="numeric"
            placeholder="1"
          />

          <Input
            label="Fixed Monthly Expenses (Rent, Utilities, Food)"
            prefix="₹"
            value={fixedExpenses}
            onChangeText={setFixedExpenses}
            keyboardType="numeric"
            placeholder="e.g. 18,000"
            hint="Non-negotiable monthly outflows."
          />

          {/* Safe EMI Ratio Slider / Stepper (20% - 60%) */}
          <View style={styles.ratioContainer}>
            <View style={styles.ratioHeader}>
              <Text style={styles.ratioLabel}>Safe EMI Limit Ratio</Text>
              <Text style={styles.ratioValue}>{Math.round(safeEmiRatio * 100)}%</Text>
            </View>

            <View style={styles.sliderButtonsRow}>
              {[0.20, 0.30, 0.40, 0.50, 0.60].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.ratioChip,
                    safeEmiRatio === r && styles.ratioChipActive,
                  ]}
                  onPress={() => setSafeEmiRatio(r)}
                >
                  <Text
                    style={[
                      styles.ratioChipText,
                      safeEmiRatio === r && styles.ratioChipTextActive,
                    ]}
                  >
                    {Math.round(r * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratioHint}>
              Financial advisors typically recommend keeping total EMIs under 40% of income.
            </Text>
          </View>

          <Input
            label="Emergency Buffer (Optional)"
            prefix="₹"
            value={emergencyBuffer}
            onChangeText={setEmergencyBuffer}
            keyboardType="numeric"
            placeholder="e.g. 10,000"
          />
        </Card>

        {/* Computed Summary Screen (§5.1) */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Computed Safety Limits</Text>
            {/* Toggleable Methodology Selector (§5.1) */}
            <View style={styles.methodToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  calculationMethod === 'gross' && styles.toggleBtnActive,
                ]}
                onPress={() => setCalculationMethod('gross')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    calculationMethod === 'gross' && styles.toggleTextActive,
                  ]}
                >
                  Gross
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  calculationMethod === 'net' && styles.toggleBtnActive,
                ]}
                onPress={() => setCalculationMethod('net')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    calculationMethod === 'net' && styles.toggleTextActive,
                  ]}
                >
                  Net
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monthly Income:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(incomeNum)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fixed Expenses:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(expensesNum)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Safe EMI Limit:</Text>
            <Text style={styles.summaryValue}>{formatPercent(safeEmiRatio * 100)}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryHighlightRow}>
            <Text style={styles.highlightLabel}>Maximum Safe EMI:</Text>
            <Text style={styles.highlightValue}>{formatCurrency(maxSafeEmi)}</Text>
          </View>
        </Card>

        <Button
          title="Save & Proceed to SMS Scanning"
          onPress={handleContinue}
          loading={submitting}
          style={styles.continueBtn}
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
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  ratioContainer: {
    marginBottom: spacing.base,
  },
  ratioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ratioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ratioValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  sliderButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  ratioChip: {
    flex: 1,
    height: 38,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusSm,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratioChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  ratioChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ratioChipTextActive: {
    color: colors.textInverse,
  },
  ratioHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryCard: {
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
    marginBottom: spacing.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textInverse,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  summaryHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  highlightLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  highlightValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  continueBtn: {
    marginBottom: spacing.giant,
  },
});
