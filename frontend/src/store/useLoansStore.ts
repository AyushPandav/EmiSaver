import { create } from 'zustand';
import { Loan, DashboardSummary, EmiScheduleItem, RiskStatus } from '../types';
import { apiClient } from '../api/client';
import { StructuredLoanPayload } from '../services/onDeviceParser';
import { computeDebtAggregation } from '../services/debtAggregator';

interface LoansState {
  loans: Loan[];
  summary: DashboardSummary | null;
  upcomingRepayments: EmiScheduleItem[];
  isLoading: boolean;
  error: string | null;

  fetchDashboardData: () => Promise<void>;
  updateLoan: (loanId: string, updates: any) => Promise<void>;
  mergeLoans: (primaryId: string, secondaryId: string) => Promise<void>;
  dismissLoan: (loanId: string) => Promise<void>;
  ingestParsedLoans: (items: StructuredLoanPayload[], monthlyIncome?: number) => void;
}

export const useLoansStore = create<LoansState>((set, get) => ({
  loans: [],
  summary: null,
  upcomingRepayments: [],
  isLoading: false,
  error: null,

  ingestParsedLoans: (items, incomeParam) => {
    const currentLoans = [...get().loans];
    const currentRepayments = [...get().upcomingRepayments];
    const income = incomeParam || get().summary?.monthlyIncome || 35000;

    for (const item of items) {
      if (!item.emi || item.emi <= 0) continue;
      const lenderName = item.lender || 'Financial Obligation';

      // Check if this loan already exists (by loanIdentifier or lender match)
      const existingIdx = currentLoans.findIndex(l =>
        (item.loan_identifier && l.loanIdentifier === item.loan_identifier) ||
        (l.lender.toLowerCase() === lenderName.toLowerCase() && Math.abs(l.emiAmount - (item.emi || 0)) < 1)
      );

      const loanId = existingIdx >= 0 ? currentLoans[existingIdx].id : 'local-' + Math.random().toString(36).substring(2, 9);

      const updatedLoan: Loan = {
        id: loanId,
        userId: 'current-user',
        lender: lenderName,
        loanIdentifier: item.loan_identifier || undefined,
        principalAmount: item.outstanding || (existingIdx >= 0 ? currentLoans[existingIdx].principalAmount : undefined),
        emiAmount: item.emi,
        category: item.category,
        repaymentFrequency: 'monthly',
        status: 'active',
        sourceConfidence: item.confidence.overall,
        manuallyVerified: false,
        nextDueDate: item.due_date || (existingIdx >= 0 ? currentLoans[existingIdx].nextDueDate : undefined),
        createdAt: existingIdx >= 0 ? currentLoans[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        currentLoans[existingIdx] = updatedLoan;
      } else {
        currentLoans.push(updatedLoan);
      }

      // Add to upcoming repayments if due date present
      if (item.due_date) {
        const repIdx = currentRepayments.findIndex(r => r.loanId === loanId);
        const repItem: EmiScheduleItem = {
          id: 'rep-' + loanId,
          loanId: loanId,
          lender: lenderName,
          dueDate: item.due_date,
          amount: item.emi,
          paid: false,
          loanIdentifier: item.loan_identifier || undefined,
        };
        if (repIdx >= 0) {
          currentRepayments[repIdx] = repItem;
        } else {
          currentRepayments.push(repItem);
        }
      }
    }

    // Recompute real-time debt aggregation
    const agg = computeDebtAggregation(currentLoans, income, 40);
    const newSummary: DashboardSummary = {
      monthlyIncome: agg.monthlyIncome,
      totalEmi: agg.totalMonthlyDebt,
      emiToIncomePct: agg.debtToIncomeRatioPct,
      safeEmiRatioPct: agg.safeLimitPct,
      maxSafeEmi: agg.maxSafeMonthlyDebt,
      activeLoansCount: currentLoans.length,
      riskStatus: agg.riskStatus as RiskStatus,
      currency: 'INR',
      riskMessage: agg.riskMessage,
    };

    set({
      loans: currentLoans,
      summary: newSummary,
      upcomingRepayments: currentRepayments,
    });
  },

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [loans, summary, cal] = await Promise.all([
        apiClient.getLoans('active'),
        apiClient.getDashboardSummary(),
        apiClient.getUpcomingCalendar(),
      ]);

      set({
        loans,
        summary,
        upcomingRepayments: cal.upcoming_repayments,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch loan data', isLoading: false });
    }
  },

  updateLoan: async (loanId, updates) => {
    try {
      await apiClient.updateLoan(loanId, updates);
      await get().fetchDashboardData();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  mergeLoans: async (primaryId, secondaryId) => {
    try {
      await apiClient.mergeLoans(primaryId, secondaryId);
      await get().fetchDashboardData();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  dismissLoan: async (loanId) => {
    try {
      await apiClient.markNotLoan(loanId);
      await get().fetchDashboardData();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));
