import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBudgetStore, Transaction } from '../store/useBudgetStore';
import { colors } from '../theme/colors';

// ─── Add Transaction Modal ────────────────────────────────────────────────────
function AddTransactionModal({
  envelopeId,
  visible,
  onClose,
}: {
  envelopeId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { addTransaction } = useBudgetStore();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<'spend' | 'fill'>('spend');

  const reset = () => { setAmount(''); setNote(''); setType('spend'); };

  const handleAdd = () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) return Alert.alert('Invalid', 'Enter a valid amount.');
    addTransaction({
      envelopeId,
      amount: v,
      note: note.trim() || (type === 'spend' ? 'Expense' : 'Added funds'),
      date: new Date().toISOString(),
      type,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Add Transaction</Text>

          {/* Type selector */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'spend' && styles.typeBtnActive]}
              onPress={() => setType('spend')}
            >
              <Text style={[styles.typeBtnText, type === 'spend' && styles.typeBtnTextActive]}>
                💸 Spend
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'fill' && styles.typeBtnActive]}
              onPress={() => setType('fill')}
            >
              <Text style={[styles.typeBtnText, type === 'fill' && styles.typeBtnTextActive]}>
                ➕ Fill
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="500"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Weekly groceries"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
              <Text style={styles.saveText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TransactionRow({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const date = new Date(tx.date);
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={styles.txRow} onLongPress={() =>
      Alert.alert('Delete Transaction', `Delete "${tx.note}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ])
    }>
      <View style={[styles.txIcon, { backgroundColor: tx.type === 'spend' ? '#FEE2E2' : '#D1FAE5' }]}>
        <Text style={styles.txIconText}>{tx.type === 'spend' ? '💸' : '➕'}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txNote}>{tx.note}</Text>
        <Text style={styles.txDate}>{dateStr} · {timeStr}</Text>
      </View>
      <Text style={[styles.txAmount, { color: tx.type === 'spend' ? '#EF4444' : '#10B981' }]}>
        {tx.type === 'spend' ? '−' : '+'}₹{tx.amount.toLocaleString('en-IN')}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function EnvelopeDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { envelopeId } = route.params;
  const {
    envelopes,
    transactions,
    getEnvelopeSpent,
    getEnvelopeBalance,
    deleteEnvelope,
    deleteTransaction,
    updateEnvelope,
  } = useBudgetStore();

  const envelope = envelopes.find(e => e.id === envelopeId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  if (!envelope) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textMuted }}>Envelope not found.</Text>
      </SafeAreaView>
    );
  }

  const envTransactions = transactions.filter(t => t.envelopeId === envelopeId);
  const spent = getEnvelopeSpent(envelopeId);
  const balance = getEnvelopeBalance(envelopeId);
  const pct = envelope.monthlyBudget > 0 ? Math.min(spent / envelope.monthlyBudget, 1) : 0;
  const barColor = pct >= 1 ? '#EF4444' : pct >= 0.75 ? '#F59E0B' : '#10B981';

  const totalSaved = envTransactions
    .filter(t => t.type === 'fill')
    .reduce((s, t) => s + t.amount, 0);

  const handleDelete = () => {
    Alert.alert('Delete Envelope', `Delete "${envelope.name}" and all its transactions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteEnvelope(envelopeId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleSaveBudget = () => {
    const v = parseFloat(budgetInput);
    if (v && v > 0) updateEnvelope(envelopeId, { monthlyBudget: v });
    setEditBudget(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nav Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          {!envelope.isEmi && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Hero Card */}
        <View style={[styles.heroCard, { borderTopColor: envelope.color }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroBadge, { backgroundColor: envelope.color + '22' }]}>
              <Text style={styles.heroIcon}>{envelope.icon}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{envelope.name}</Text>
              {envelope.isSavings && (
                <Text style={styles.savingsGoalLabel}>
                  {envelope.savingsGoal
                    ? `Goal: ₹${envelope.savingsGoal.toLocaleString('en-IN')}`
                    : 'Savings envelope'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{spent.toLocaleString('en-IN')}</Text>
              <Text style={styles.statLabel}>Spent</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: balance < 0 ? '#EF4444' : '#10B981' }]}>
                ₹{Math.abs(balance).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.statLabel}>{balance < 0 ? 'Over' : 'Left'}</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => { setBudgetInput(envelope.monthlyBudget.toString()); setEditBudget(true); }}>
              {editBudget ? (
                <TextInput
                  style={styles.budgetEditInput}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  keyboardType="numeric"
                  onBlur={handleSaveBudget}
                  onSubmitEditing={handleSaveBudget}
                  autoFocus
                />
              ) : (
                <Text style={styles.statValue}>₹{envelope.monthlyBudget.toLocaleString('en-IN')}</Text>
              )}
              <Text style={styles.statLabel}>Budget ✏️</Text>
            </TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(pct * 100)}% used this month</Text>

          {/* Savings goal progress */}
          {envelope.isSavings && envelope.savingsGoal && (
            <View style={styles.goalSection}>
              <Text style={styles.goalLabel}>Savings Goal Progress</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${Math.min(totalSaved / envelope.savingsGoal, 1) * 100}%`,
                  backgroundColor: '#4F46E5',
                }]} />
              </View>
              <Text style={styles.progressLabel}>
                ₹{totalSaved.toLocaleString('en-IN')} saved of ₹{envelope.savingsGoal.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
        </View>

        {/* Add Transaction Button */}
        <TouchableOpacity style={[styles.addTxBtn, { backgroundColor: envelope.color }]} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addTxBtnText}>+ Add Transaction</Text>
        </TouchableOpacity>

        {/* Transactions */}
        <Text style={styles.txTitle}>Transactions ({envTransactions.length})</Text>
        {envTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubText}>Tap "Add Transaction" to log your first one</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {envTransactions.map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onDelete={() => deleteTransaction(tx.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddTransactionModal
        envelopeId={envelopeId}
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },

  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderTopWidth: 4,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  heroBadge: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  heroIcon: { fontSize: 28 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  savingsGoalLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  budgetEditInput: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },

  progressTrack: { height: 8, backgroundColor: colors.surfaceSubtle, borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 99 },
  progressLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  goalSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  goalLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },

  addTxBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  addTxBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  txTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  txList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txIconText: { fontSize: 18 },
  txInfo: { flex: 1 },
  txNote: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  txDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySubText: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.surfaceSubtle, borderWidth: 2, borderColor: 'transparent' },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  typeBtnTextActive: { color: colors.primary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.border },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surfaceSubtle, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
