import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { RiskStatus } from '../../types';

interface RiskBannerProps {
  status: RiskStatus;
  message: string;
}

export const RiskBanner: React.FC<RiskBannerProps> = ({ status, message }) => {
  const getBannerStyles = () => {
    switch (status) {
      case 'safe':
        return {
          bg: colors.safeLight,
          border: colors.safe,
          textColor: colors.safeText,
          badgeBg: colors.safe,
          badgeText: 'SAFE',
        };
      case 'caution':
        return {
          bg: colors.cautionLight,
          border: colors.caution,
          textColor: colors.cautionText,
          badgeBg: colors.caution,
          badgeText: 'CAUTION',
        };
      case 'over_limit':
      default:
        return {
          bg: colors.overLimitLight,
          border: colors.overLimit,
          textColor: colors.overLimitText,
          badgeBg: colors.overLimit,
          badgeText: 'OVER-LIMIT',
        };
    }
  };

  const style = getBannerStyles();

  return (
    <View style={[styles.container, { backgroundColor: style.bg, borderColor: style.border }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: style.badgeBg }]}>
          <Text style={styles.badgeLabel}>{style.badgeText}</Text>
        </View>
        <Text style={[styles.title, { color: style.textColor }]}>
          {status === 'safe'
            ? 'Safe Repayment Zone'
            : status === 'caution'
            ? 'Approaching Safe Limit'
            : 'Unsafe Loan Volume'}
        </Text>
      </View>
      <Text style={[styles.message, { color: style.textColor }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    borderWidth: 1.5,
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radiusSm,
    marginRight: spacing.sm,
  },
  badgeLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
