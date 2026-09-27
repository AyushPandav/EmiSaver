import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Loan } from '../../types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';

interface LoanListItemProps {
  loan: Loan;
  onPress: () => void;
}

export const LoanListItem: React.FC<LoanListItemProps> = ({ loan, onPress }) => {
  const confidence = loan.sourceConfidence ? Math.round(loan.sourceConfidence * 100) : null;
  const isLowConfidence = confidence !== null && confidence < 60;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={styles.header}>
          <Text style={styles.lenderName}>{loan.lender}</Text>
          {loan.loanIdentifier ? (
            <Text style={styles.loanId}>({loan.loanIdentifier})</Text>
          ) : null}
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.dueDate}>
            Due: {loan.nextDueDate ? formatDate(loan.nextDueDate) : 'Monthly'}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.frequency}>{loan.repaymentFrequency}</Text>
        </View>

        <View style={styles.badgesRow}>
          {confidence !== null ? (
            <Badge
              label={`${confidence}% Match`}
              variant={confidence >= 80 ? 'safe' : confidence >= 60 ? 'caution' : 'danger'}
              style={styles.badge}
            />
          ) : null}

          {isLowConfidence || !loan.manuallyVerified ? (
            <Badge label="Needs Verify" variant="caution" style={styles.badge} />
          ) : (
            <Badge label="Verified" variant="safe" style={styles.badge} />
          )}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.emiAmount}>{formatCurrency(loan.emiAmount)}</Text>
        <Text style={styles.perMonth}>per month</Text>
        <Text style={styles.editLink}>Edit &gt;</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  left: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lenderName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  loanId: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dueDate: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dot: {
    marginHorizontal: spacing.xs,
    color: colors.textMuted,
  },
  frequency: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    marginRight: spacing.xs,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  emiAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  perMonth: {
    fontSize: 11,
    color: colors.textMuted,
  },
  editLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
});
