import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBudgetStore, Envelope, EnvelopeColor } from '../store/useBudgetStore';
import { useLoansStore } from '../store/useLoansStore';
import { colors } from '../theme/colors';

// ─── Envelope Color Palette ───────────────────────────────────────────────────
const COLOR_OPTIONS: { color: EnvelopeColor; label: string }[] = [
  { color: '#4F46E5', label: 'Indigo' },
  { color: '#10B981', label: 'Green' },
  { color: '#F59E0B', label: 'Amber' },
  { color: '#EF4444', label: 'Red' },
  { color: '#8B5CF6', label: 'Violet' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#06B6D4', label: 'Cyan' },
  { color: '#F97316', label: 'Orange' },
];

const ICON_OPTIONS = ['🛒', '🚗', '🏠', '🎬', '🍕', '✈️', '👗', '💊', '📚', '🎮', '☕', '🏋️', '💡', '🐾', '🎁'];

// ─── Envelope Card ────────────────────────────────────────────────────────────
function EnvelopeCard({
  envelope,
  onPress,
}: {
  envelope: Envelope;
  onPress: () => void;
}) {
  const { getEnvelopeSpent } = useBudgetStore();
  const spent = getEnvelopeSpent(envelope.id);
  const pct = envelope.monthlyBudget > 0 ? Math.min(spent / envelope.monthlyBudget, 1) : 0;
  const remaining = envelope.monthlyBudget - spent;
  const isOver = remaining < 0;

  const barColor =
    pct >= 1 ? '#EF4444' : pct >= 0.75 ? '#F59E0B' : '#10B981';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: envelope.color + '22' }]}>
          <Text style={styles.cardIcon}>{envelope.icon}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{envelope.name}</Text>
          {envelope.isEmi && (
            <View style={styles.emiBadge}>
              <Text style={styles.emiBadgeText}>Auto-detected</Text>
            </View>
          )}
        </View>
        <View style={styles.cardAmounts}>
          <Text style={[styles.remainingAmount, { color: isOver ? '#EF4444' : colors.textPrimary }]}>
            ₹{Math.abs(remaining).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.remainingLabel}>{isOver ? 'over budget' : 'left'}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.spentText}>₹{spent.toLocaleString('en-IN')} spent</Text>
        <Text style={styles.budgetText}>of ₹{envelope.monthlyBudget.toLocaleString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Add Envelope Modal ───────────────────────────────────────────────────────
function AddEnvelopeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { addEnvelope } = useBudgetStore();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [selectedColor, setSelectedColor] = useState<EnvelopeColor>('#10B981');
  const [selectedIcon, setSelectedIcon] = useState('💰');
  const [isSavings, setIsSavings] = useState(false);
  const [savingsGoal, setSavingsGoal] = useState('');

  const reset = () => {
    setName('');
    setBudget('');
    setSelectedColor('#10B981');
    setSelectedIcon('💰');
    setIsSavings(false);
    setSavingsGoal('');
  };

  const handleAdd = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Please enter an envelope name.');
    const amount = parseFloat(budget);
    if (!amount || amount <= 0) return Alert.alert('Invalid amount', 'Enter a valid monthly budget.');
    addEnvelope({
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      monthlyBudget: amount,
      isSavings,
      savingsGoal: isSavings && savingsGoal ? parseFloat(savingsGoal) : undefined,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Envelope</Text>

          {/* Name */}
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Groceries"
            placeholderTextColor={colors.textMuted}
          />

          {/* Monthly Budget */}
          <Text style={styles.label}>Monthly Budget (₹)</Text>
          <TextInput
            style={styles.input}
            value={budget}
            onChangeText={setBudget}
            placeholder="5000"
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />

          {/* Icon Picker */}
          <Text style={styles.label}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
            {ICON_OPTIONS.map(icon => (
              <TouchableOpacity
                key={icon}
                onPress={() => setSelectedIcon(icon)}
                style={[styles.iconOption, selectedIcon === icon && styles.iconOptionSelected]}
              >
                <Text style={styles.iconOptionText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Color Picker */}
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map(({ color }) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[styles.colorDot, { backgroundColor: color }, selectedColor === color && styles.colorDotSelected]}
              />
            ))}
          </View>

          {/* Savings toggle */}
          <TouchableOpacity style={styles.toggleRow} onPress={() => setIsSavings(!isSavings)}>
            <View style={[styles.toggle, isSavings && styles.toggleOn]} />
            <Text style={styles.toggleLabel}>This is a savings envelope</Text>
          </TouchableOpacity>
          {isSavings && (
            <>
              <Text style={styles.label}>Savings Goal (₹) — optional</Text>
              <TextInput
                style={styles.input}
                value={savingsGoal}
                onChangeText={setSavingsGoal}
                placeholder="100000"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addBtnText}>Add Envelope</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Set Income Modal ─────────────────────────────────────────────────────────
function SetIncomeModal({
  visible,
  currentIncome,
  onClose,
}: {
  visible: boolean;
  currentIncome: number;
  onClose: () => void;
}) {
  const { setMonthlyIncome } = useBudgetStore();
  const [income, setIncome] = useState(currentIncome.toString());

  const handleSave = () => {
    const v = parseFloat(income);
    if (!v || v <= 0) return Alert.alert('Invalid', 'Enter a valid monthly income.');
    setMonthlyIncome(v);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: 24 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Monthly Income</Text>
          <Text style={styles.modalSubtitle}>Set your take-home pay to see how much is available to budget.</Text>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={income}
            onChangeText={setIncome}
            keyboardType="numeric"
            placeholder="35000"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleSave}>
              <Text style={styles.addBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function BudgetScreen({ navigation }: { navigation: any }) {
  const {
    envelopes,
    monthlyIncome,
    getTotalAllocated,
    getAvailableToBudget,
    loadFromStorage,
    isLoaded,
    syncEmiEnvelope,
  } = useBudgetStore();

  const { summary } = useLoansStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoaded) loadFromStorage();
  }, [isLoaded]);

  // Auto-sync EMI envelope when loans data is available
  useEffect(() => {
    if (summary?.totalEmi && summary.totalEmi > 0) {
      syncEmiEnvelope(summary.totalEmi);
    }
  }, [summary?.totalEmi]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFromStorage();
    setRefreshing(false);
  }, []);

  const totalAllocated = getTotalAllocated();
  const available = getAvailableToBudget();
  const availablePct = monthlyIncome > 0 ? Math.max(0, available / monthlyIncome) : 0;

  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Budget Envelopes</Text>
            <Text style={styles.headerSub}>{month}</Text>
          </View>
          <TouchableOpacity style={styles.incomeBtn} onPress={() => setShowIncomeModal(true)}>
            <Text style={styles.incomeBtnText}>₹{monthlyIncome.toLocaleString('en-IN')}/mo</Text>
            <Text style={styles.incomeBtnLabel}>✏️ income</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>₹{monthlyIncome.toLocaleString('en-IN')}</Text>
              <Text style={styles.summaryLabel}>Monthly Income</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>₹{totalAllocated.toLocaleString('en-IN')}</Text>
              <Text style={styles.summaryLabel}>Allocated</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: available < 0 ? '#EF4444' : '#10B981' }]}>
                ₹{Math.abs(available).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.summaryLabel}>{available < 0 ? 'Over!' : 'Free'}</Text>
            </View>
          </View>

          {/* Available bar */}
          <View style={styles.availableBarTrack}>
            <View style={[styles.availableBarFill, { width: `${(1 - availablePct) * 100}%`, backgroundColor: available < 0 ? '#EF4444' : '#4F46E5' }]} />
          </View>
          <Text style={styles.availableBarLabel}>
            {available >= 0
              ? `₹${available.toLocaleString('en-IN')} available to budget`
              : `₹${Math.abs(available).toLocaleString('en-IN')} over-allocated — reduce some envelopes`}
          </Text>
        </View>

        {/* EMI auto-sync note */}
        {summary?.totalEmi && summary.totalEmi > 0 && (
          <View style={styles.emiNotice}>
            <Text style={styles.emiNoticeText}>
              💳 EMI envelope auto-synced from your SMS (₹{summary.totalEmi.toLocaleString('en-IN')}/mo)
            </Text>
          </View>
        )}

        {/* Envelopes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Envelopes ({envelopes.length})</Text>
          {envelopes.map(env => (
            <EnvelopeCard
              key={env.id}
              envelope={env}
              onPress={() => navigation.navigate('EnvelopeDetail', { envelopeId: env.id })}
            />
          ))}
        </View>

        {/* Add button */}
        <TouchableOpacity style={styles.addEnvBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addEnvBtnText}>+ New Envelope</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      <AddEnvelopeModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
      <SetIncomeModal
        visible={showIncomeModal}
        currentIncome={monthlyIncome}
        onClose={() => setShowIncomeModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  incomeBtn: { alignItems: 'flex-end' },
  incomeBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  incomeBtnLabel: { fontSize: 11, color: colors.textMuted },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  availableBarTrack: { height: 6, backgroundColor: colors.surfaceSubtle, borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  availableBarFill: { height: '100%', borderRadius: 99 },
  availableBarLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  emiNotice: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  emiNoticeText: { fontSize: 13, color: '#991B1B' },

  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardIcon: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emiBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3 },
  emiBadgeText: { fontSize: 10, color: '#991B1B', fontWeight: '600' },
  cardAmounts: { alignItems: 'flex-end' },
  remainingAmount: { fontSize: 20, fontWeight: '800' },
  remainingLabel: { fontSize: 11, color: colors.textMuted },

  progressTrack: { height: 8, backgroundColor: colors.surfaceSubtle, borderRadius: 99, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 99 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  spentText: { fontSize: 12, color: colors.textSecondary },
  budgetText: { fontSize: 12, color: colors.textMuted },

  addEnvBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addEnvBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },

  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },

  iconRow: { marginBottom: 4 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: colors.surfaceSubtle,
  },
  iconOptionSelected: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary },
  iconOptionText: { fontSize: 22 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 99 },
  colorDotSelected: { borderWidth: 3, borderColor: colors.textPrimary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: colors.border, marginRight: 10 },
  toggleOn: { backgroundColor: colors.primary },
  toggleLabel: { fontSize: 14, color: colors.textPrimary },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surfaceSubtle, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  addBtn: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
