import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { StructuredLoanPayload } from '../../services/onDeviceParser';
import { LowConfidenceReviewCard } from './LowConfidenceReviewCard';

interface Props {
  items: Array<{
    payload: StructuredLoanPayload;
    rawText?: string;
    sender?: string;
  }>;
  onConfirmItem: (item: StructuredLoanPayload) => void;
  onEditItem: (updated: StructuredLoanPayload) => void;
  onFallbackParse?: (rawText: string, sender?: string, ref?: string) => void;
}

export function BatchReviewQueue({
  items,
  onConfirmItem,
  onEditItem,
  onFallbackParse,
}: Props) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Detected Loans</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length} pending</Text>
        </View>
      </View>
      <Text style={styles.description}>
        These messages had lower extraction certainty. Confirm or correct them to ensure accurate repayment tracking.
      </Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.payload.local_message_ref}
        renderItem={({ item }) => (
          <LowConfidenceReviewCard
            item={item.payload}
            rawText={item.rawText}
            sender={item.sender}
            onConfirm={onConfirmItem}
            onEdit={onEditItem}
            onFallbackParse={onFallbackParse}
          />
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontFamily: typography.fontFamilies.semiBold,
    color: '#B45309',
  },
  description: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
