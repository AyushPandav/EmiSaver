import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { LoanTimelineNode } from '../../types';

interface Props {
  timeline: LoanTimelineNode[];
}

export function LoanTimeline({ timeline }: Props) {
  if (!timeline || timeline.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No timeline events recorded yet.</Text>
      </View>
    );
  }

  const getNodeIcon = (nodeType: string, isProjected: boolean) => {
    if (isProjected) return '⏳';
    switch (nodeType) {
      case 'loan_approved':
        return '🎉';
      case 'loan_disbursed':
        return '💰';
      case 'emi_generated':
        return '📄';
      case 'emi_reminder':
        return '⏰';
      case 'payment_confirmed':
        return '✅';
      case 'overdue_notice':
        return '🚨';
      default:
        return '📌';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>LOAN TIMELINE</Text>

      <View style={styles.timelineList}>
        {timeline.map((item, index) => {
          const isLast = index === timeline.length - 1;
          const icon = getNodeIcon(item.nodeType, item.isProjected);

          return (
            <View key={item.eventId || `node-${index}`} style={styles.nodeRow}>
              {/* Left Date Column */}
              <View style={styles.dateCol}>
                <Text style={[styles.dateText, item.isProjected && styles.projectedDate]}>
                  {formatDate(item.eventDate)}
                </Text>
              </View>

              {/* Center Timeline Spine */}
              <View style={styles.spineCol}>
                <View
                  style={[
                    styles.nodeDot,
                    item.isProjected && styles.projectedDot,
                    item.nodeType === 'payment_confirmed' && styles.paidDot,
                  ]}
                >
                  <Text style={styles.nodeIconText}>{icon}</Text>
                </View>

                {!isLast && (
                  <View
                    style={[
                      styles.connectorLine,
                      timeline[index + 1].isProjected && styles.dashedConnector,
                    ]}
                  />
                )}
              </View>

              {/* Right Content Column */}
              <View style={[styles.contentCol, item.isProjected && styles.projectedContent]}>
                <View style={styles.titleRow}>
                  <Text style={[styles.nodeTitle, item.isProjected && styles.projectedTitle]}>
                    {item.title}
                  </Text>
                  {item.isProjected && (
                    <View style={styles.projectedBadge}>
                      <Text style={styles.projectedBadgeText}>Projected</Text>
                    </View>
                  )}
                  {!item.isProjected && item.confidence != null && (
                    <Text style={styles.confidenceText}>
                      {Math.round(item.confidence * 100)}% conf
                    </Text>
                  )}
                </View>

                {item.amount != null && item.amount > 0 && (
                  <Text style={styles.amountText}>
                    ₹{item.amount.toLocaleString('en-IN')}
                  </Text>
                )}

                <Text style={styles.descriptionText}>{item.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  timelineList: {
    paddingLeft: spacing.xs,
  },
  nodeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  dateCol: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
    paddingTop: 2,
  },
  dateText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.semiBold,
    color: colors.textPrimary,
  },
  projectedDate: {
    color: '#818CF8',
    fontStyle: 'italic',
  },
  spineCol: {
    alignItems: 'center',
    width: 32,
  },
  nodeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2F6',
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  projectedDot: {
    borderColor: '#818CF8',
    backgroundColor: '#EEF2FF',
    borderStyle: 'dashed',
  },
  paidDot: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  nodeIconText: {
    fontSize: 12,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 2,
    minHeight: 24,
  },
  dashedConnector: {
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderLeftColor: '#818CF8',
    borderStyle: 'dashed',
  },
  contentCol: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.sm,
  },
  projectedContent: {
    opacity: 0.85,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nodeTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
  },
  projectedTitle: {
    color: '#4F46E5',
  },
  projectedBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  projectedBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamilies.medium,
    color: '#4F46E5',
  },
  confidenceText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.fontFamilies.regular,
  },
  amountText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.bold,
    color: colors.primary,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
});
