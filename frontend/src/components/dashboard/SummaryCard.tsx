import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { DashboardSummary } from '../../types';

interface SummaryCardProps {
  summary: DashboardSummary | null;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Monthly EMI Summary</Text>
      
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.label}>Monthly Income</Text>
          <Text style={styles.valueLarge}>
            {formatCurrency(summary?.monthlyIncome || 0)}
          </Text>
        </View>

        <View style={styles.cell}>
          <Text style={styles.label}>Total EMIs</Text>
          <Text style={[styles.valueLarge, { color: colors.primary }]}>
            {formatCurrency(summary?.totalEmi || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View>
          <Text style={styles.subLabel}>EMI / Income Load</Text>
          <Text style={styles.subValue}>
            {formatPercent(summary?.emiToIncomePct || 0)}
          </Text>
        </View>

        <View>
          <Text style={styles.subLabel}>Safe Limit</Text>
          <Text style={styles.subValue}>
            {formatPercent(summary?.safeEmiRatioPct || 40)}
          </Text>
        </View>

        <View>
          <Text style={styles.subLabel}>Active Loans</Text>
          <Text style={styles.subValue}>
            {summary?.activeLoansCount || 0}
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cell: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  valueLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  subValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
