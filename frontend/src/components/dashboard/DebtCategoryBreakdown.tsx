import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Card } from '../common/Card';
import { DebtAggregatorSummary } from '../../services/debtAggregator';

interface DebtCategoryBreakdownProps {
  aggregation: DebtAggregatorSummary;
}

export const DebtCategoryBreakdown: React.FC<DebtCategoryBreakdownProps> = ({ aggregation }) => {
  const {
    monthlyIncome,
    categories,
    totalMonthlyDebt,
    debtToIncomeRatioPct,
    safeLimitPct,
    riskStatus,
  } = aggregation;

  const isOverLimit = debtToIncomeRatioPct > safeLimitPct;
  const isCaution = debtToIncomeRatioPct >= safeLimitPct - 10 && !isOverLimit;

  const statusColor = isOverLimit ? colors.riskHigh : isCaution ? colors.riskMedium : colors.riskLow;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Real-Time Debt Aggregation</Text>
          <Text style={styles.subtitle}>On-Device SMS & Financial Obligations</Text>
        </View>
        <View style={[styles.dtiBadge, { backgroundColor: statusColor + '1A', borderColor: statusColor }]}>
          <Text style={[styles.dtiBadgeText, { color: statusColor }]}>
            {debtToIncomeRatioPct}% DTI
          </Text>
        </View>
      </View>

      {/* Monthly Income Row */}
      <View style={styles.row}>
        <Text style={styles.incomeLabel}>Monthly Income</Text>
        <Text style={styles.incomeValue}>₹{monthlyIncome.toLocaleString('en-IN')}</Text>
      </View>

      <View style={styles.divider} />

      {/* Category Breakdown */}
      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No financial commitments detected yet.</Text>
          <Text style={styles.emptySubtext}>Scan device SMS in Permissions tab to populate.</Text>
        </View>
      ) : (
        categories.map((cat) => (
          <View key={cat.category} style={styles.categoryRow}>
            <View style={styles.categoryLeft}>
              <View style={styles.dot} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.itemCount}>({cat.count})</Text>
            </View>
            <Text style={styles.categoryAmount}>
              ₹{cat.totalMonthlyAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        ))
      )}

      <View style={styles.totalDivider} />

      {/* Total Monthly Debt Row */}
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total Monthly Debt</Text>
        <Text style={styles.totalValue}>₹{totalMonthlyDebt.toLocaleString('en-IN')}</Text>
      </View>

      {/* DTI Summary Footer */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Debt / Income:{' '}
          <Text style={[styles.footerHighlight, { color: statusColor }]}>
            {debtToIncomeRatioPct}%
          </Text>{' '}
          (Safe Ceiling: {safeLimitPct}%)
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  dtiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  dtiBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  incomeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  incomeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.safe,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  totalDivider: {
    height: 1.5,
    backgroundColor: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  itemCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyContainer: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  footerRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  footerHighlight: {
    fontWeight: '800',
  },
});
