import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { RiskBanner } from '../components/dashboard/RiskBanner';
import { RiskGauge } from '../components/dashboard/RiskGauge';
import { RepaymentRatioWidget } from '../components/dashboard/RepaymentRatioWidget';
import { CollisionWarningCard } from '../components/dashboard/CollisionWarningCard';
import { LoanListItem } from '../components/dashboard/LoanListItem';
import { LoanEditModal } from '../components/loans/LoanEditModal';
import { LoanSimulatorModal } from '../components/simulation/LoanSimulatorModal';
import { MessageQueue } from '../components/loans/MessageQueue';
import { DebtCategoryBreakdown } from '../components/dashboard/DebtCategoryBreakdown';
import { computeDebtAggregation } from '../services/debtAggregator';
import { useLoansStore } from '../store/useLoansStore';
import { useRepaymentRatio } from '../hooks/useRepaymentRatio';
import { usePressureScore } from '../hooks/usePressureScore';
import { Loan } from '../types';

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const {
    loans,
    summary,
    isLoading,
    fetchDashboardData,
    updateLoan,
    mergeLoans,
    dismissLoan,
  } = useLoansStore();

  const { ratioData, refresh: refreshRatio } = useRepaymentRatio();
  const { windows, refresh: refreshWindows } = usePressureScore();

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [simulatorVisible, setSimulatorVisible] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefreshAll = async () => {
    await Promise.all([
      fetchDashboardData(),
      refreshRatio(),
      refreshWindows(),
    ]);
  };

  const handleOpenLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditModalVisible(true);
  };

  const handleMergeAction = (primaryLoanId: string) => {
    const otherLoans = loans.filter(l => l.id !== primaryLoanId);
    if (otherLoans.length === 0) {
      Alert.alert('Merge Loans', 'No other active loan found to merge with.');
      return;
    }

    Alert.alert(
      'Select Loan to Merge',
      'Choose the second loan that represents the same debt obligation:',
      otherLoans.map(other => ({
        text: `${other.lender} (₹${other.emiAmount})`,
        onPress: async () => {
          try {
            await mergeLoans(primaryLoanId, other.id);
            setEditModalVisible(false);
            handleRefreshAll();
            Alert.alert('Merged', `Successfully merged with ${other.lender}.`);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      }))
    );
  };

  const handleConfirmedSimulatedLoan = (simData: {
    lender: string;
    emiAmount: number;
    principalAmount?: number;
  }) => {
    // Hand off to manual loan entry
    const mockNewLoan: Loan = {
      id: 'manual-entry',
      userId: '',
      lender: simData.lender,
      emiAmount: simData.emiAmount,
      principalAmount: simData.principalAmount,
      repaymentFrequency: 'monthly',
      status: 'active',
      manuallyVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedLoan(mockNewLoan);
    setEditModalVisible(true);
  };

  const handleNavigateToCalendar = () => {
    navigation.navigate('Calendar');
  };

  const riskStatus = summary?.riskStatus || 'safe';
  const riskMessage =
    summary?.riskMessage ||
    `Your EMIs are ${summary?.emiToIncomePct || 0}% of income — well within your safe limit.`;

  const monthlyIncome = summary?.monthlyIncome || 35000;
  const debtAggregation = computeDebtAggregation(loans, monthlyIncome, summary?.safeEmiRatioPct || 40);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefreshAll} />
        }
      >
        {/* Screen Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>EMI Dashboard</Text>
            <Text style={styles.subtitle}>Aggregated Debt Health & Safe Limit</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={styles.simulateBtn}
              onPress={() => setSimulatorVisible(true)}
            >
              <Text style={styles.simulateBtnText}>+ What-If</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshAll}
            >
              <Text style={styles.refreshBtnText}>↻</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.settingsBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Persistent Risk Banner */}
        <RiskBanner status={riskStatus} message={riskMessage} />

        {/* Quick AI & Relief Action Banner */}
        <View style={styles.aiActionRow}>
          <TouchableOpacity
            style={styles.aiActionCard}
            onPress={() => navigation.navigate('AI Plan')}
          >
            <View style={styles.aiActionIconWrap}>
              <Text style={styles.aiActionIcon}>🤖</Text>
            </View>
            <View style={styles.aiActionTextWrap}>
              <Text style={styles.aiActionTitle}>Mistral AI Debt Plan</Text>
              <Text style={styles.aiActionDesc}>Custom payoff roadmap</Text>
            </View>
            <Text style={styles.aiActionArrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.aiActionCard, { borderColor: '#A7F3D0' }]}
            onPress={() => navigation.navigate('Relief')}
          >
            <View style={[styles.aiActionIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.aiActionIcon}>🛡️</Text>
            </View>
            <View style={styles.aiActionTextWrap}>
              <Text style={styles.aiActionTitle}>Relief & Rights Hub</Text>
              <Text style={styles.aiActionDesc}>Prepay & RBI letters</Text>
            </View>
            <Text style={styles.aiActionArrow}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* Real-Time Debt Category Breakdown (§10) */}
        <DebtCategoryBreakdown aggregation={debtAggregation} />

        {/* Repayment Ratio Widget (§3.2) */}
        <RepaymentRatioWidget data={ratioData} />

        {/* Repayment Collision Warning Cards (§3.4) */}
        <CollisionWarningCard
          windows={windows}
          onSelectWindow={handleNavigateToCalendar}
        />

        {/* Summary Card */}
        <SummaryCard summary={summary} />

        {/* Risk Gauge Bar */}
        <View style={styles.gaugeContainer}>
          <RiskGauge
            totalEmi={summary?.totalEmi || 0}
            maxSafeEmi={summary?.maxSafeEmi || 18000}
          />
        </View>

        {/* Pending Message Queue */}
        <MessageQueue onSyncComplete={handleRefreshAll} />

        {/* Active Loans Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Active Loans & BNPL ({loans.length})
          </Text>
          <Text style={styles.sectionHelper}>Tap to verify or correct</Text>
        </View>

        {loans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Active Loans Detected</Text>
            <Text style={styles.emptyDesc}>
              Scan messages in Permissions tab or ingest new SMS reminders to populate loans.
            </Text>
          </View>
        ) : (
          loans.map((loan) => (
            <LoanListItem
              key={loan.id}
              loan={loan}
              onPress={() => handleOpenLoan(loan)}
            />
          ))
        )}
      </ScrollView>

      {/* Manual Correction Modal */}
      <LoanEditModal
        visible={editModalVisible}
        loan={selectedLoan}
        onClose={() => setEditModalVisible(false)}
        onSave={async (id, updates) => {
          await updateLoan(id, updates);
          handleRefreshAll();
        }}
        onMerge={handleMergeAction}
        onDismissNotLoan={async (id) => {
          await dismissLoan(id);
          handleRefreshAll();
        }}
      />

      {/* New Loan Simulation Modal (§3.3) */}
      <LoanSimulatorModal
        visible={simulatorVisible}
        onClose={() => setSimulatorVisible(false)}
        onConfirmTakeLoan={handleConfirmedSimulatedLoan}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simulateBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: spacing.radiusSm,
    marginRight: spacing.xs,
  },
  simulateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  settingsBtn: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs - 2,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    fontSize: 15,
  },
  aiActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.xs,
  },
  aiActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: spacing.radiusMd,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  aiActionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  aiActionIcon: {
    fontSize: 16,
  },
  aiActionTextWrap: {
    flex: 1,
  },
  aiActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  aiActionDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  aiActionArrow: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 2,
  },
  gaugeContainer: {
    marginVertical: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHelper: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: spacing.radiusLg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
