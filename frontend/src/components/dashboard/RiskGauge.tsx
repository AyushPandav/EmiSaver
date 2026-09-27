import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatters';

interface RiskGaugeProps {
  totalEmi: number;
  maxSafeEmi: number;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ totalEmi, maxSafeEmi }) => {
  const percentage = maxSafeEmi > 0 ? Math.min(150, (totalEmi / maxSafeEmi) * 100) : 0;
  
  const getFillColor = () => {
    if (percentage <= 70) return colors.safe;
    if (percentage <= 100) return colors.caution;
    return colors.overLimit;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Safe EMI Limit Utilization</Text>
        <Text style={styles.safeCap}>Cap: {formatCurrency(maxSafeEmi)}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, percentage)}%`,
              backgroundColor: getFillColor(),
            },
          ]}
        />
        {/* 100% threshold marker */}
        <View style={styles.marker} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.legendText}>0%</Text>
        <Text style={[styles.legendText, { color: colors.cautionText }]}>70% Caution</Text>
        <Text style={[styles.legendText, { color: colors.overLimitText }]}>100% Safe Cap</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  safeCap: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  track: {
    height: 10,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusFull,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: spacing.radiusFull,
  },
  marker: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.overLimit,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
