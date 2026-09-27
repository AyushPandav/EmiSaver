import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { StructuredLoanPayload } from '../../services/onDeviceParser';

interface Props {
  item: StructuredLoanPayload;
  rawText?: string;
  sender?: string;
  onConfirm: (item: StructuredLoanPayload) => void;
  onEdit: (updatedItem: StructuredLoanPayload) => void;
  onFallbackParse?: (rawText: string, sender?: string, ref?: string) => void;
}

export function LowConfidenceReviewCard({
  item,
  rawText,
  sender,
  onConfirm,
  onEdit,
  onFallbackParse,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [lender, setLender] = useState(item.lender || '');
  const [emi, setEmi] = useState(item.emi ? item.emi.toString() : '');
  const [dueDate, setDueDate] = useState(item.due_date || '');

  const conf = item.confidence;
  const isLowLender = conf.lender < 0.75;
  const isLowEmi = conf.emi < 0.75;
  const isLowDate = conf.due_date < 0.75;

  const handleSaveEdit = () => {
    onEdit({
      ...item,
      lender: lender.trim() || null,
      emi: parseFloat(emi) || null,
      due_date: dueDate.trim() || null,
      confidence: {
        ...conf,
        overall: 1.0, // manually confirmed
      },
    });
    setIsEditing(false);
  };

  const handleRequestBackendHelp = () => {
    Alert.alert(
      'Cloud-Assisted Parsing Consent',
      'Under standard operation, your messages are processed only on your device. By tapping Continue, you explicitly opt-in to send this single raw message text to our server for advanced parsing.\n\nRetention: Auto-deleted within 14 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Consent & Send',
          onPress: () => {
            if (rawText && onFallbackParse) {
              onFallbackParse(rawText, sender, item.local_message_ref);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      {/* Header Warning */}
      <View style={styles.headerRow}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>Review Possible EMI</Text>
          <Text style={styles.subtitle}>
            {isLowLender
              ? 'Lender detection confidence is low'
              : isLowDate
              ? 'Due date needs verification'
              : 'Please verify the extracted details'}
          </Text>
        </View>
        <View style={styles.confPill}>
          <Text style={styles.confText}>{Math.round(conf.overall * 100)}% Match</Text>
        </View>
      </View>

      {/* Field Details */}
      <View style={styles.fieldsContainer}>
        {/* Lender */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Lender</Text>
          <View style={styles.fieldValueContainer}>
            <Text style={[styles.fieldValue, isLowLender && styles.lowConfValue]}>
              {item.lender || 'Unknown Lender'}
            </Text>
            <Text style={[styles.fieldConfBadge, isLowLender && styles.lowConfBadge]}>
              {Math.round(conf.lender * 100)}%
            </Text>
          </View>
        </View>

        {/* EMI */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>EMI Amount</Text>
          <View style={styles.fieldValueContainer}>
            <Text style={[styles.fieldValue, isLowEmi && styles.lowConfValue]}>
              {item.emi ? `₹${item.emi.toLocaleString('en-IN')}` : 'Not detected'}
            </Text>
            <Text style={[styles.fieldConfBadge, isLowEmi && styles.lowConfBadge]}>
              {Math.round(conf.emi * 100)}%
            </Text>
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Due Date</Text>
          <View style={styles.fieldValueContainer}>
            <Text style={[styles.fieldValue, isLowDate && styles.lowConfValue]}>
              {item.due_date || 'Not detected'}
            </Text>
            <Text style={[styles.fieldConfBadge, isLowDate && styles.lowConfBadge]}>
              {Math.round(conf.due_date * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.confirmButton} onPress={() => onConfirm(item)}>
          <Text style={styles.confirmButtonText}>✓ Confirm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
          <Text style={styles.editButtonText}>✎ Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Explicit Backend Fallback Option */}
      {rawText && onFallbackParse && (
        <TouchableOpacity style={styles.fallbackLink} onPress={handleRequestBackendHelp}>
          <Text style={styles.fallbackLinkText}>🔒 Let us help parse this one (Opt-in)</Text>
        </TouchableOpacity>
      )}

      {/* Quick Edit Modal */}
      <Modal visible={isEditing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit EMI Details</Text>

            <Text style={styles.inputLabel}>Lender Name</Text>
            <TextInput
              style={styles.input}
              value={lender}
              onChangeText={setLender}
              placeholder="e.g. LazyPay"
            />

            <Text style={styles.inputLabel}>EMI Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={emi}
              onChangeText={setEmi}
              keyboardType="numeric"
              placeholder="e.g. 2499"
            />

            <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2026-09-25"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveModalBtnText}>Save & Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warningIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSizes.md,
    fontFamily: typography.fontFamilies.bold,
    color: '#92400E',
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    fontFamily: typography.fontFamilies.regular,
    color: '#B45309',
  },
  confPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  confText: {
    fontSize: 11,
    fontFamily: typography.fontFamilies.semiBold,
    color: '#92400E',
  },
  fieldsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  fieldValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldValue: {
    fontSize: typography.fontSizes.sm,
    fontFamily: typography.fontFamilies.medium,
    color: colors.textPrimary,
    marginRight: 6,
  },
  lowConfValue: {
    color: '#D97706',
    fontFamily: typography.fontFamilies.bold,
  },
  fieldConfBadge: {
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    color: '#4B5563',
  },
  lowConfBadge: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: typography.fontSizes.sm,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamilies.medium,
    fontSize: typography.fontSizes.sm,
  },
  fallbackLink: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  fallbackLinkText: {
    fontSize: typography.fontSizes.xs,
    color: '#6366F1',
    fontFamily: typography.fontFamilies.medium,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: typography.fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: typography.fontSizes.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelModalBtnText: {
    color: colors.textMuted,
  },
  saveModalBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamilies.semiBold,
  },
});
