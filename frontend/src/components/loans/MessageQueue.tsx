import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useMessageStore } from '../../store/useMessageStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Button } from '../common/Button';

interface MessageQueueProps {
  onSyncComplete?: () => void;
}

export const MessageQueue: React.FC<MessageQueueProps> = ({ onSyncComplete }) => {
  const {
    queuedMessages,
    isSyncing,
    toggleExclusion,
    syncFilteredBatch,
    clearQueue,
  } = useMessageStore();

  if (queuedMessages.length === 0) {
    return null;
  }

  const activeCount = queuedMessages.filter(m => !m.excluded).length;

  const handleSync = async () => {
    try {
      await syncFilteredBatch();
      if (onSyncComplete) onSyncComplete();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {activeCount} Messages Queued for Processing
          </Text>
          <Text style={styles.subtitle}>
            On-device pre-filter selected only loan-related items.
          </Text>
        </View>
        <TouchableOpacity onPress={clearQueue}>
          <Text style={styles.dismissAll}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {queuedMessages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.itemCard, msg.excluded && styles.excludedCard]}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.senderText}>{msg.sender || 'Unknown Sender'}</Text>
              <TouchableOpacity
                onPress={() => toggleExclusion(msg.id)}
                style={styles.excludeBtn}
              >
                <Text style={styles.excludeBtnText}>
                  {msg.excluded ? 'Include +' : 'Exclude ✕'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.bodyText, msg.excluded && styles.excludedText]} numberOfLines={2}>
              {msg.rawText}
            </Text>

            <View style={styles.tagsRow}>
              {msg.languageDetected && (
                <View style={styles.langBadge}>
                  <Text style={styles.langBadgeText}>
                    {msg.languageDetected.toUpperCase()}
                  </Text>
                </View>
              )}
              {msg.matchedKeywords.map((kw, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{kw}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Button
        title={`Sync ${activeCount} Messages Securely`}
        onPress={handleSync}
        loading={isSyncing}
        disabled={activeCount === 0}
        style={styles.syncBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dismissAll: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  list: {
    maxHeight: 220,
    marginVertical: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.background,
    borderRadius: spacing.radiusMd,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  excludedCard: {
    opacity: 0.5,
    backgroundColor: colors.surfaceSubtle,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  excludeBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  excludeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  bodyText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  excludedText: {
    textDecorationLine: 'line-through',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  langBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: spacing.radiusSm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  langBadgeText: {
    fontSize: 9,
    color: '#2E7D32',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tag: {
    backgroundColor: colors.primarySoft,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 4,
    marginTop: 2,
  },
  tagText: {
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  syncBtn: {
    marginTop: spacing.xs,
  },
});
