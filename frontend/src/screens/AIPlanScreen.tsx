import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Share,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useLoansStore } from '../store/useLoansStore';
import { apiClient } from '../api/client';

export const AIPlanScreen: React.FC = () => {
  const { loans, summary } = useLoansStore();
  const [selectedStrategy, setSelectedStrategy] = useState<'avalanche' | 'snowball' | 'relief'>('avalanche');
  const [extraAmount, setExtraAmount] = useState<number>(2000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [isAiPowered, setIsAiPowered] = useState<boolean>(true);

  // Chat copilot state
  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: 'Namaste! I am your Mistral Financial Copilot. Ask me anything about repaying your EMIs, RBI recovery rules, or negotiating with lenders.',
    },
  ]);

  const monthlyIncome = summary?.monthlyIncome || 35000;
  const totalEmi = summary?.totalEmi || 0;
  const dti = summary?.emiToIncomePct || (monthlyIncome > 0 ? Math.round((totalEmi / monthlyIncome) * 100) : 0);

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    try {
      const goals = {
        strategy: selectedStrategy === 'avalanche' ? 'Debt Avalanche (Highest Interest First)' : selectedStrategy === 'snowball' ? 'Debt Snowball (Lowest Balance First)' : 'EMI Relief & Cashflow Restructuring',
        monthly_extra: extraAmount,
      };

      const incomeData = {
        monthly_income: monthlyIncome,
        total_emi: totalEmi,
        dti_pct: dti,
      };

      const res = await apiClient.getAiPlan(goals, loans, incomeData);
      setPlanResult(res.plan);
      setIsAiPowered(res.is_ai_powered ?? true);
    } catch {
      // Fallback local plan if API fails
      setPlanResult(
        `### 🛡️ Smart Debt Payoff Blueprint\n\n` +
        `**Overview:** You currently have ${loans.length} active loan obligations totaling ₹${totalEmi.toLocaleString()}/month.\n\n` +
        `**Priority Step 1:** Direct your extra ₹${extraAmount.toLocaleString()}/month towards your highest interest debt.\n\n` +
        `**Priority Step 2:** Maintain minimum payments on all other loans to protect your CIBIL score.\n\n` +
        `**Tactical Tip:** Contact your primary lender to request an extension of tenure if monthly EMI exceeds 45% DTI.`
      );
      setIsAiPowered(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async (presetText?: string) => {
    const textToSend = presetText || chatQuestion.trim();
    if (!textToSend || chatLoading) return;

    const userMsg = { sender: 'user' as const, text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    if (!presetText) setChatQuestion('');
    setChatLoading(true);

    try {
      const incomeData = { monthly_income: monthlyIncome, total_emi: totalEmi };
      const res = await apiClient.askAiChat(textToSend, loans, incomeData);
      setChatMessages(prev => [...prev, { sender: 'ai', text: res.reply }]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: 'Under RBI guidelines, lenders must treat borrowers respectfully and cannot contact you before 8 AM or after 7 PM. Focus on maintaining basic essentials and notify your bank in writing of any temporary income disruption.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSharePlan = async () => {
    if (!planResult) return;
    try {
      await Share.share({
        message: `My EmiSaver Debt Relief Roadmap:\n\n${planResult}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>AI Debt Advisor</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>Mistral AI ⚡</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Intelligent debt elimination, payoff prioritization & lender negotiations.
          </Text>
        </View>

        {/* Snapshot Metric Card */}
        <Card style={styles.snapshotCard}>
          <View style={styles.metricRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Active Debts</Text>
              <Text style={styles.metricValue}>{loans.length}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Monthly EMI</Text>
              <Text style={styles.metricValue}>₹{totalEmi.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Debt-to-Income</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: dti > 50 ? colors.overLimit : dti > 35 ? colors.caution : colors.safe },
                ]}
              >
                {dti}%
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Badge
              variant={dti > 50 ? 'danger' : dti > 35 ? 'caution' : 'safe'}
              label={dti > 50 ? 'High Financial Stress' : dti > 35 ? 'Elevated Pressure' : 'Healthy Range'}
            />
            <Text style={styles.statusDetail}>
              {dti > 40
                ? 'Action recommended: Reallocate or restructure'
                : 'On track: Optimize with extra payoffs'}
            </Text>
          </View>
        </Card>

        {/* Strategy Selection */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>1. Choose Payoff Strategy</Text>
        </View>

        <View style={styles.strategyRow}>
          <TouchableOpacity
            style={[styles.strategyPill, selectedStrategy === 'avalanche' && styles.strategyPillActive]}
            onPress={() => setSelectedStrategy('avalanche')}
          >
            <Text style={[styles.strategyPillText, selectedStrategy === 'avalanche' && styles.strategyPillTextActive]}>
              ⚡ Avalanche
            </Text>
            <Text style={styles.strategySub}>Max Interest Saved</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.strategyPill, selectedStrategy === 'snowball' && styles.strategyPillActive]}
            onPress={() => setSelectedStrategy('snowball')}
          >
            <Text style={[styles.strategyPillText, selectedStrategy === 'snowball' && styles.strategyPillTextActive]}>
              🎯 Snowball
            </Text>
            <Text style={styles.strategySub}>Quick Win Motivation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.strategyPill, selectedStrategy === 'relief' && styles.strategyPillActive]}
            onPress={() => setSelectedStrategy('relief')}
          >
            <Text style={[styles.strategyPillText, selectedStrategy === 'relief' && styles.strategyPillTextActive]}>
              🛡️ EMI Relief
            </Text>
            <Text style={styles.strategySub}>Lower Monthly Outgo</Text>
          </TouchableOpacity>
        </View>

        {/* Extra Prepayment Booster */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2. Monthly Extra Payoff Target</Text>
          <Text style={styles.sectionHelper}>₹{extraAmount.toLocaleString('en-IN')} / month</Text>
        </View>

        <View style={styles.presetRow}>
          {[500, 1000, 2000, 5000].map(amt => (
            <TouchableOpacity
              key={amt}
              style={[styles.presetBtn, extraAmount === amt && styles.presetBtnActive]}
              onPress={() => setExtraAmount(amt)}
            >
              <Text style={[styles.presetBtnText, extraAmount === amt && styles.presetBtnTextActive]}>
                +₹{amt.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGeneratePlan}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateBtnText}>⚡ Generate Custom AI Action Plan</Text>
          )}
        </TouchableOpacity>

        {/* Plan Results */}
        {planResult && (
          <Card style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planBadgeRow}>
                <Text style={styles.planTitle}>Your Tailored Action Plan</Text>
                <Badge
                  variant={isAiPowered ? 'info' : 'neutral'}
                  label={isAiPowered ? 'Mistral Verified' : 'Rule Engine'}
                />
              </View>
              <TouchableOpacity onPress={handleSharePlan} style={styles.shareBtn}>
                <Text style={styles.shareBtnText}>📤 Share / Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.planBody}>
              <Text style={styles.planText}>{planResult}</Text>
            </View>
          </Card>
        )}

        {/* Interactive AI Financial Copilot */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💬 Ask Mistral Financial Copilot</Text>
        </View>

        {/* Preset Questions */}
        <View style={styles.presetQuestionsRow}>
          <TouchableOpacity
            style={styles.questionChip}
            onPress={() => handleSendChat('What are my RBI legal rights if recovery agents call?')}
          >
            <Text style={styles.questionChipText}>🛡️ Recovery agent rules?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.questionChip}
            onPress={() => handleSendChat('Which loan should I prepay first with my bonus?')}
          >
            <Text style={styles.questionChipText}>💰 How to prepay?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.questionChip}
            onPress={() => handleSendChat('How can I ask my bank for an EMI tenure extension?')}
          >
            <Text style={styles.questionChipText}>📝 Restructure letter?</Text>
          </TouchableOpacity>
        </View>

        {/* Chat History Box */}
        <Card style={styles.chatBox}>
          {chatMessages.map((msg, idx) => (
            <View
              key={idx}
              style={[
                styles.chatBubble,
                msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text
                style={[
                  styles.chatBubbleText,
                  msg.sender === 'user' ? styles.userBubbleText : styles.aiBubbleText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))}
          {chatLoading && (
            <View style={[styles.chatBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {/* Chat Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything about loans or relief..."
              placeholderTextColor={colors.textMuted}
              value={chatQuestion}
              onChangeText={setChatQuestion}
              onSubmitEditing={() => handleSendChat()}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => handleSendChat()}
              disabled={chatLoading || !chatQuestion.trim()}
            >
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  snapshotCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-between',
  },
  statusDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHelper: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  strategyPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  strategyPillActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4',
  },
  strategyPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  strategyPillTextActive: {
    color: colors.primary,
  },
  strategySub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  generateBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  planCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    marginBottom: spacing.sm,
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shareBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  planBody: {
    marginTop: 4,
  },
  planText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  presetQuestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  questionChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chatBox: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
  },
  chatBubbleText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiBubbleText: {
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
