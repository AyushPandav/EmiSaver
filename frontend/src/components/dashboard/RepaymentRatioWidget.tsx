import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { RepaymentRatioData } from '../../types';

interface RepaymentRatioWidgetProps {
  data: RepaymentRatioData | null;
  loading?: boolean;
}

export const RepaymentRatioWidget: React.FC<RepaymentRatioWidgetProps> = ({ data, loading }) => {
  if (!data) return null;

  const isAbove = data.isAboveLimit;
  const badgeColor = isAbove ? colors.riskHigh : colors.riskLow;
  const badgeBg = isAbove ? colors.riskHighLight : colors.riskLowLight;

  const getTrendIcon = () => {
    if (data.trendDirection === 'up') return '▲';
    if (data.trendDirection === 'down') return '▼';
    return '▬';
  };

  const getTrendColor = () => {
    if (data.trendDirection === 'up') return colors.riskHigh;
    if (data.trendDirection === 'down') return colors.riskLow;
    return colors.textMuted;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Repayment-to-Income Ratio</Text>
          <Text style={styles.subtitle}>Configured Safe Limit: {data.safeLimitPct}%</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
            {isAbove ? '⚠️ Above Limit' : '✓ Safe Buffer'}
          </Text>
        </View>
      </View>

      {/* Main Ratio & Trend Row */}
      <View style={styles.metricRow}>
        <View style={styles.primaryMetric}>
          <Text style={[styles.ratioNumber, { color: isAbove ? colors.riskHigh : colors.primary }]}>
            {data.ratioPct}%
          </Text>
          <Text style={styles.ratioLabel}>Monthly EMI Burden</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.trendBlock}>
          <View style={styles.trendRow}>
            <Text style={[styles.trendArrow, { color: getTrendColor() }]}>
              {getTrendIcon()}
            </Text>
            <Text style={[styles.trendValue, { color: getTrendColor() }]}>
              {Math.abs(data.trendDeltaPct)}%
            </Text>
          </View>
          <Text style={styles.trendLabel}>vs Last Snapshot</Text>
        </View>
      </View>

      {/* Progress Bar vs Safe Limit */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(data.ratioPct, 100)}%`,
              backgroundColor: isAbove ? colors.riskHigh : colors.riskLow,
            },
          ]}
        />
        {/* Marker for configured safe limit */}
        <View
          style={[
            styles.safeLimitMarker,
            { left: `${Math.min(data.safeLimitPct, 100)}%` },
          ]}
        />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabelText}>0%</Text>
        <Text style={[styles.barLabelText, styles.markerText]}>
          | Safe: {data.safeLimitPct}%
        </Text>
        <Text style={styles.barLabelText}>100%</Text>
      </View>

      {/* Non-verdict factual statement */}
      <View style={[styles.messageBox, { backgroundColor: isAbove ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)' }]}>
        <Text style={[styles.messageText, { color: isAbove ? colors.riskHigh : colors.textSecondary }]}>
          {data.message}
        </Text>
      </View>

      {/* Normalization Note if non-monthly loans exist */}
      {data.normalizationNotes && data.normalizationNotes.length > 0 && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Normalization Auditing:</Text>
          {data.normalizationNotes.map((note, idx) => (
            <Text key={idx} style={styles.noteItem}>• {note}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.radiusSm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  primaryMetric: {
    flex: 1,
  },
  ratioNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  ratioLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.base,
  },
  trendBlock: {
    alignItems: 'flex-start',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendArrow: {
    fontSize: 14,
    marginRight: 4,
    fontWeight: '800',
  },
  trendValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    marginTop: spacing.sm,
    position: 'relative',
    overflow: 'visible',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  safeLimitMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: colors.textPrimary,
    zIndex: 2,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  barLabelText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  markerText: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageBox: {
    padding: spacing.xs + 2,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.xs,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesTitle: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noteItem: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
