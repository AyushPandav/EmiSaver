import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { EmiScheduleItem } from '../../types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RepaymentListProps {
  repayments: EmiScheduleItem[];
}

export const RepaymentList: React.FC<RepaymentListProps> = ({ repayments }) => {
  if (repayments.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Upcoming Repayments</Text>
        <Text style={styles.emptySubtitle}>
          All EMIs are either marked as paid or no active loans are scheduled.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Upcoming Due Dates</Text>
      {repayments.map((item, index) => {
        const isPaid = item.paid;
        return (
          <View key={item.id || index} style={[styles.itemRow, isPaid && styles.paidRow]}>
            {/* Date block */}
            <View style={styles.dateBlock}>
              <Text style={styles.dateText}>{formatDate(item.dueDate)}</Text>
            </View>

            {/* Lender details */}
            <View style={styles.lenderBlock}>
              <Text style={[styles.lenderName, isPaid && styles.paidText]}>
                {item.lender}
              </Text>
              {item.loanIdentifier ? (
                <Text style={styles.loanId}>ID: {item.loanIdentifier}</Text>
              ) : null}
            </View>

            {/* Amount block */}
            <View style={styles.amountBlock}>
              <Text style={[styles.amountText, isPaid && styles.paidText]}>
                {formatCurrency(item.amount)}
              </Text>
              {isPaid ? (
                <Text style={styles.paidBadge}>PAID</Text>
              ) : (
                <Text style={styles.dueBadge}>DUE</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderRadius: spacing.radiusMd,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paidRow: {
    opacity: 0.6,
    backgroundColor: colors.surfaceSubtle,
  },
  dateBlock: {
    width: 80,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: spacing.sm,
    marginRight: spacing.md,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  lenderBlock: {
    flex: 1,
  },
  lenderName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loanId: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  dueBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.cautionText,
    backgroundColor: colors.cautionLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: spacing.radiusSm,
    marginTop: 2,
  },
  paidBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.safeText,
    backgroundColor: colors.safeLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: spacing.radiusSm,
    marginTop: 2,
  },
  paidText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
