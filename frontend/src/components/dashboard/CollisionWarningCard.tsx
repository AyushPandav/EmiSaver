import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { PressureWindowData } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface CollisionWarningCardProps {
  windows: PressureWindowData[];
  onSelectWindow?: (window: PressureWindowData) => void;
}

export const CollisionWarningCard: React.FC<CollisionWarningCardProps> = ({
  windows,
  onSelectWindow,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!windows || windows.length === 0) {
    return null;
  }

  // Pick top high/caution pressure windows
  const significantWindows = windows.filter(w => w.severity === 'high' || w.severity === 'caution');
  if (significantWindows.length === 0) return null;

  const formatDateRange = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const sMonth = s.toLocaleString('default', { month: 'short' });
      const eMonth = e.toLocaleString('default', { month: 'short' });
      if (sMonth === eMonth) {
        return `${sMonth} ${s.getDate()}–${e.getDate()}`;
      }
      return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
    } catch {
      return `${startStr} to ${endStr}`;
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'high':
        return {
          bg: '#FEF2F2',
          border: '#F87171',
          text: colors.riskHigh,
          label: '⚠️ High Repayment Concentration',
        };
      case 'caution':
        return {
          bg: '#FFFBEB',
          border: '#FBBF24',
          text: colors.riskMedium,
          label: '⚡ Elevated Payment Cluster',
        };
      default:
        return {
          bg: colors.surfaceSubtle,
          border: colors.border,
          text: colors.textSecondary,
          label: 'ℹ Repayment Cluster',
        };
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Repayment Collision Alerts</Text>
      {significantWindows.map((item) => {
        const styleInfo = getSeverityStyle(item.severity);
        const isExpanded = expandedId === item.id;
        const factors = item.contributingFactors || {};

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => onSelectWindow?.(item)}
            style={[styles.card, { backgroundColor: styleInfo.bg, borderColor: styleInfo.border }]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.dateRange}>
                  {formatDateRange(item.windowStart, item.windowEnd)}
                </Text>
                <Text style={styles.amountTotal}>
                  {formatCurrency(item.totalDue)} repayments
                </Text>
              </View>
              <View style={styles.badgeColumn}>
                <View style={styles.scorePill}>
                  <Text style={[styles.scoreText, { color: styleInfo.text }]}>
                    Score: {Math.round(item.pressureScore)}
                  </Text>
                </View>
                <Text style={[styles.severityLabel, { color: styleInfo.text }]}>
                  {styleInfo.label}
                </Text>
              </View>
            </View>

            {/* Expandable factor breakdown (§4.4) */}
            <TouchableOpacity
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
              style={styles.expandRow}
            >
              <Text style={styles.expandText}>
                {isExpanded ? 'Hide Factor Breakdown ▲' : 'Why is this flagged? (Breakdown) ▼'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.factorBox}>
                <Text style={styles.factorItem}>
                  • Concentration Ratio: {Math.round((factors.concentration_ratio || 0) * 100)}% of monthly EMI
                </Text>
                <Text style={styles.factorItem}>
                  • Minimum Gap Between Dues: {factors.min_gap_days ?? 0} day(s)
                </Text>
                <Text style={styles.factorItem}>
                  • Timing: {factors.pre_salary ? 'Falls directly before salary arrival' : 'Post-salary window'}
                </Text>
                <Text style={styles.factorItem}>
                  • Concurrent Active Loans: {factors.active_loan_count ?? 0}
                </Text>
                <Text style={styles.factorHelper}>
                  Tap card to view this window on the Unified Calendar →
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  card: {
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateRange: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  amountTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-end',
  },
  scorePill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.radiusSm,
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '800',
  },
  severityLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandRow: {
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  expandText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  factorBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: spacing.radiusSm,
  },
  factorItem: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
    lineHeight: 16,
  },
  factorHelper: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  },
});
