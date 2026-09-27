import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useLoansStore } from '../store/useLoansStore';

export const ReliefHubScreen: React.FC = () => {
  const { loans, summary } = useLoansStore();
  const [extraPrepay, setExtraPrepay] = useState<number>(2000);
  const [selectedLetter, setSelectedLetter] = useState<'moratorium' | 'tenure' | 'waiver' | 'harassment'>('moratorium');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const totalEmi = summary?.totalEmi || 0;
  const totalPrincipal = loans.reduce((sum, l) => sum + (l.principalAmount || l.emiAmount * 12), 0);

  // Simplified amortization calculation for extra prepayment
  const estimatedMonthsLeft = totalEmi > 0 ? Math.ceil(totalPrincipal / totalEmi) : 18;
  const acceleratedMonthly = totalEmi + extraPrepay;
  const newMonthsLeft = acceleratedMonthly > 0 ? Math.max(1, Math.ceil(totalPrincipal / acceleratedMonthly)) : 12;
  const monthsSaved = Math.max(1, estimatedMonthsLeft - newMonthsLeft);
  const interestSaved = Math.round(monthsSaved * (totalEmi * 0.18)); // Approx 18% avg interest savings

  const letters = {
    moratorium: {
      title: 'Temporary EMI Moratorium Request',
      recipient: 'The Branch Manager / Loan Operations',
      body: `Subject: Request for Temporary Moratorium / EMI Relief on Loan Account

Dear Sir/Madam,

I hold an active loan account with your institution. Due to an unforeseen financial hardship and cashflow disruption, I am writing to formally request a temporary moratorium / deferment of my monthly EMI for a period of 2 to 3 months.

I remain fully committed to honoring all my debt obligations. This temporary relief will enable me to stabilize my finances and resume regular repayments without defaulting.

Kindly advise on the required formalities to activate this relief.

Sincerely,
[Your Name]
Loan Account: [Insert Loan Number]
Contact: [Insert Phone Number]`,
    },
    tenure: {
      title: 'Tenure Extension & EMI Restructuring',
      recipient: 'Credit Underwriting & Restructuring Cell',
      body: `Subject: Application for Loan Restructuring & Tenure Extension

Dear Sir/Madam,

I am writing regarding my ongoing loan account. In order to ensure continuous, uninterrupted repayments without financial distress, I request your institution to kindly restructure my loan by extending the repayment tenure.

Extending the repayment tenure will reduce the monthly EMI burden to a sustainable level in proportion to my current net income.

I look forward to your positive consideration and approval of an adjusted EMI schedule.

Yours faithfully,
[Your Name]
Loan Account: [Insert Loan Number]`,
    },
    waiver: {
      title: 'Waiver of Penal & Bounce Charges',
      recipient: 'Customer Grievance Officer',
      body: `Subject: Request for One-Time Waiver of Late Penalties and Bounce Charges

Dear Grievance Officer,

I noticed that penal charges and overdue fees have been debited to my loan account due to an inadvertent delay in clearing my recent installment.

As a customer with a genuine commitment to repayment who has cleared the principal EMI dues, I humbly request a one-time waiver of these penal and administrative charges as a gesture of goodwill.

Thanking you,
[Your Name]
Loan Reference: [Insert Loan ID]`,
    },
    harassment: {
      title: 'Cease & Desist Unlawful Recovery Harassment',
      recipient: 'Principal Nodal Officer / Grievance Redressal',
      body: `Subject: Formal Complaint Against Unlawful Recovery Harassment under RBI Fair Practices Code

Dear Principal Nodal Officer,

I am writing to lodge a formal grievance regarding non-compliant recovery practices by representatives claiming to act on behalf of your institution.

Recovery agents have engaged in calls outside permitted hours (8:00 AM - 7:00 PM), used intimidatory language, and attempted to contact third parties. This constitutes a severe violation of the Reserve Bank of India (RBI) Master Direction on Fair Practices Code and Guidelines on Recovery Agents.

I demand the immediate cessation of all non-compliant harassment. All future communication regarding my loan must strictly be conducted via registered email or official postal correspondence. Failure to comply will result in this matter being escalated directly to the RBI Banking Ombudsman (cms.rbi.org.in).

Regards,
[Your Name]
Loan Account: [Insert Loan Number]`,
    },
  };

  const handleShareLetter = async () => {
    const text = letters[selectedLetter].body;
    try {
      await Share.share({
        title: letters[selectedLetter].title,
        message: text,
      });
      setCopiedNotification('Letter ready to share or email!');
      setTimeout(() => setCopiedNotification(null), 3000);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Relief & Payoff Hub</Text>
            <View style={styles.shieldBadge}>
              <Text style={styles.shieldBadgeText}>RBI Protected 🛡️</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Prepayment simulator, legal hardship letters & borrower protections.
          </Text>
        </View>

        {/* 1. Debt Freedom & Prepayment Simulator */}
        <Card style={styles.simCard}>
          <Text style={styles.cardHeaderTitle}>🚀 Debt Freedom Accelerator</Text>
          <Text style={styles.cardHeaderSubtitle}>
            See how putting a few extra rupees each month cuts your debt tenure:
          </Text>

          {/* Amount Presets */}
          <View style={styles.extraRow}>
            {[1000, 2000, 3000, 5000].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[styles.extraBtn, extraPrepay === amt && styles.extraBtnActive]}
                onPress={() => setExtraPrepay(amt)}
              >
                <Text style={[styles.extraBtnText, extraPrepay === amt && styles.extraBtnTextActive]}>
                  +₹{amt.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Impact Results */}
          <View style={styles.impactContainer}>
            <View style={styles.impactBox}>
              <Text style={styles.impactValue}>{monthsSaved} Months</Text>
              <Text style={styles.impactLabel}>Debt-Free Sooner</Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactBox}>
              <Text style={[styles.impactValue, { color: colors.safe }]}>
                ~₹{interestSaved.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.impactLabel}>Total Interest Saved</Text>
            </View>
          </View>
        </Card>

        {/* 2. Formal Hardship & Restructuring Letters */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📄 Official RBI Hardship Letters</Text>
          <Text style={styles.sectionHelper}>Ready to send to bank</Text>
        </View>

        {/* Letter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.letterTabsScroll}>
          <TouchableOpacity
            style={[styles.letterTab, selectedLetter === 'moratorium' && styles.letterTabActive]}
            onPress={() => setSelectedLetter('moratorium')}
          >
            <Text style={[styles.letterTabText, selectedLetter === 'moratorium' && styles.letterTabTextActive]}>
              ⏸️ Moratorium Request
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.letterTab, selectedLetter === 'tenure' && styles.letterTabActive]}
            onPress={() => setSelectedLetter('tenure')}
          >
            <Text style={[styles.letterTabText, selectedLetter === 'tenure' && styles.letterTabTextActive]}>
              ⏳ Tenure Extension
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.letterTab, selectedLetter === 'waiver' && styles.letterTabActive]}
            onPress={() => setSelectedLetter('waiver')}
          >
            <Text style={[styles.letterTabText, selectedLetter === 'waiver' && styles.letterTabTextActive]}>
              💵 Penalty Waiver
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.letterTab, selectedLetter === 'harassment' && styles.letterTabActive]}
            onPress={() => setSelectedLetter('harassment')}
          >
            <Text style={[styles.letterTabText, selectedLetter === 'harassment' && styles.letterTabTextActive]}>
              🛑 Cease Harassment
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Letter Display */}
        <Card style={styles.letterCard}>
          <View style={styles.letterHeader}>
            <Text style={styles.letterTitle}>{letters[selectedLetter].title}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleShareLetter}>
              <Text style={styles.copyBtnText}>📋 Share / Copy</Text>
            </TouchableOpacity>
          </View>
          {copiedNotification && (
            <View style={styles.notifBanner}>
              <Text style={styles.notifBannerText}>{copiedNotification}</Text>
            </View>
          )}
          <ScrollView nestedScrollEnabled style={styles.letterBodyContainer}>
            <Text style={styles.letterBodyText}>{letters[selectedLetter].body}</Text>
          </ScrollView>
        </Card>

        {/* 3. Know Your Rights Against Recovery Harassment */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚖️ Borrower Rights under RBI Law</Text>
        </View>

        <Card style={styles.rightsCard}>
          <View style={styles.rightItem}>
            <Text style={styles.rightIcon}>⏰</Text>
            <View style={styles.rightTextContainer}>
              <Text style={styles.rightHeading}>Strict Call Timings (8 AM – 7 PM)</Text>
              <Text style={styles.rightDesc}>
                Recovery agents and lenders cannot call or message you before 8:00 AM or after 7:00 PM.
              </Text>
            </View>
          </View>

          <View style={styles.rightDivider} />

          <View style={styles.rightItem}>
            <Text style={styles.rightIcon}>🚫</Text>
            <View style={styles.rightTextContainer}>
              <Text style={styles.rightHeading}>No Contacting Friends or Relatives</Text>
              <Text style={styles.rightDesc}>
                Lenders are strictly barred from harassing contacts, employers, or family members.
              </Text>
            </View>
          </View>

          <View style={styles.rightDivider} />

          <View style={styles.rightItem}>
            <Text style={styles.rightIcon}>🏛️</Text>
            <View style={styles.rightTextContainer}>
              <Text style={styles.rightHeading}>RBI Ombudsman Escalation</Text>
              <Text style={styles.rightDesc}>
                If a lender refuses to resolve legitimate grievances within 30 days, complain at cms.rbi.org.in.
              </Text>
            </View>
          </View>
        </Card>

        {/* 4. Emergency Cash Triage Hierarchy */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🆘 Cash Shortage Triage (What to Pay First)</Text>
        </View>

        <Card style={styles.triageCard}>
          <View style={styles.triageStep}>
            <Badge variant="info" label="Tier 1" />
            <View style={styles.triageStepContent}>
              <Text style={styles.triageStepTitle}>Essentials & Living Survival</Text>
              <Text style={styles.triageStepDesc}>Food, rent, electricity & medical buffer come before any lender.</Text>
            </View>
          </View>

          <View style={styles.triageStep}>
            <Badge variant="caution" label="Tier 2" />
            <View style={styles.triageStepContent}>
              <Text style={styles.triageStepTitle}>Secured Assets (Home / Vehicle Loan)</Text>
              <Text style={styles.triageStepDesc}>Priority loan repayment to prevent seizure of primary home or car.</Text>
            </View>
          </View>

          <View style={styles.triageStep}>
            <Badge variant="neutral" label="Tier 3" />
            <View style={styles.triageStepContent}>
              <Text style={styles.triageStepTitle}>Unsecured Personal Loans & BNPL</Text>
              <Text style={styles.triageStepDesc}>Eligible for moratorium, restructuring, or settlement requests.</Text>
            </View>
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
  shieldBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  shieldBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.safe,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  simCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  extraRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  extraBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  extraBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  extraBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  extraBtnTextActive: {
    color: '#FFFFFF',
  },
  impactContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
  },
  impactBox: {
    flex: 1,
    alignItems: 'center',
  },
  impactValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  impactLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  impactDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  letterTabsScroll: {
    marginBottom: spacing.sm,
  },
  letterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  letterTabActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  letterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  letterTabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  letterCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  letterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  letterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  copyBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  notifBanner: {
    backgroundColor: '#ECFDF5',
    padding: 6,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  notifBannerText: {
    fontSize: 11,
    color: colors.safe,
    fontWeight: '600',
  },
  letterBodyContainer: {
    maxHeight: 200,
  },
  letterBodyText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  rightsCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rightIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  rightTextContainer: {
    flex: 1,
  },
  rightHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rightDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  rightDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  triageCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  triageStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: 10,
  },
  triageStepContent: {
    flex: 1,
  },
  triageStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  triageStepDesc: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
