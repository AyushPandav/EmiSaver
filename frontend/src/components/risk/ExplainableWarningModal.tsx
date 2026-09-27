import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { RiskExplanationData } from '../../types';

interface Props {
  visible: boolean;
  explanation: RiskExplanationData | null;
  onClose: () => void;
}

export function ExplainableWarningModal({ visible, explanation, onClose }: Props) {
  if (!explanation) return null;

  const isHighRisk = explanation.riskStatus === 'over_limit' || explanation.riskStatus === 'high';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.badgeIcon}>{isHighRisk ? '🚨' : '⚠️'}</Text>
              <Text style={styles.title}>Why are you receiving this warning?</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Contributing Factor Bullets */}
            <View style={styles.bulletsCard}>
              {explanation.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            {/* Deterministic Templated Summary */}
            <View style={[styles.summaryCard, isHighRisk && styles.highRiskSummary]}>
              <Text style={styles.summaryTitle}>Assessment</Text>
              <Text style={styles.summaryText}>{explanation.plainLanguageSummary}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.understandBtn} onPress={onClose}>
            <Text style={styles.understandBtnText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxHeight: '80%',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.sm,
  },
  badgeIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
    fontFamily: typography.fontFamilies.bold,
  },
  content: {
    marginVertical: spacing.xs,
  },
  bulletsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.medium,
    color: '#1E293B',
    flex: 1,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  highRiskSummary: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  summaryTitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamilies.bold,
    color: '#92400E',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.regular,
    color: '#78350F',
    lineHeight: 20,
  },
  understandBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  understandBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamilies.bold,
    fontSize: typography.fontSizes.sm,
  },
});
