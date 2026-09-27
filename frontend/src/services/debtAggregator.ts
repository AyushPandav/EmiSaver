import { DebtCategory } from './onDeviceParser';

export interface CategoryBreakdownItem {
  category: DebtCategory;
  label: string;
  count: number;
  totalMonthlyAmount: number;
  items: Array<{
    lender: string;
    amount: number;
    dueDate?: string;
    outstanding?: number | null;
    loanIdentifier?: string;
  }>;
}

export interface DebtAggregatorSummary {
  monthlyIncome: number;
  categories: CategoryBreakdownItem[];
  totalMonthlyDebt: number;
  debtToIncomeRatioPct: number; // e.g. 43.6
  safeLimitPct: number;         // e.g. 40
  maxSafeMonthlyDebt: number;   // e.g. 14000
  riskStatus: 'safe' | 'caution' | 'over_limit';
  riskMessage: string;
}

const CATEGORY_LABELS: Record<DebtCategory, string> = {
  personal_loan: 'Personal Loan',
  bnpl: 'BNPL (Pay Later)',
  credit_card: 'Credit Card',
  home_loan: 'Home Loan',
  loan_emi: 'Loan EMI',
  other_debt: 'Other Debt',
  salary: 'Salary Credit',
};

/**
 * Aggregates all obligations into categories and computes real-time debt-to-income metrics.
 */
export function computeDebtAggregation(
  loans: Array<{
    lender: string;
    emiAmount: number;
    category?: DebtCategory | string;
    principalAmount?: number;
    nextDueDate?: string;
    loanIdentifier?: string;
  }>,
  monthlyIncome: number = 35000,
  safeLimitPct: number = 40
): DebtAggregatorSummary {
  const categoryMap = new Map<DebtCategory, CategoryBreakdownItem>();

  const standardCategories: DebtCategory[] = [
    'personal_loan',
    'bnpl',
    'credit_card',
    'home_loan',
    'loan_emi',
    'other_debt',
  ];

  for (const cat of standardCategories) {
    categoryMap.set(cat, {
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      count: 0,
      totalMonthlyAmount: 0,
      items: [],
    });
  }

  let totalMonthlyDebt = 0;

  for (const loan of loans) {
    if (!loan.emiAmount || loan.emiAmount <= 0) continue;

    let cat = (loan.category as DebtCategory) || 'loan_emi';
    if (!categoryMap.has(cat)) {
      cat = 'loan_emi';
    }

    const bucket = categoryMap.get(cat)!;
    bucket.count += 1;
    bucket.totalMonthlyAmount += loan.emiAmount;
    bucket.items.push({
      lender: loan.lender,
      amount: loan.emiAmount,
      dueDate: loan.nextDueDate,
      outstanding: loan.principalAmount || null,
      loanIdentifier: loan.loanIdentifier,
    });

    totalMonthlyDebt += loan.emiAmount;
  }

  // Filter only categories that have items
  const activeCategories = Array.from(categoryMap.values()).filter(c => c.count > 0);

  const dti = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;
  const debtToIncomeRatioPct = parseFloat(dti.toFixed(1));
  const maxSafeMonthlyDebt = Math.round((monthlyIncome * safeLimitPct) / 100);

  let riskStatus: 'safe' | 'caution' | 'over_limit' = 'safe';
  let riskMessage = `Your EMIs are ${debtToIncomeRatioPct}% of income — comfortably within your safe limit.`;

  if (debtToIncomeRatioPct > safeLimitPct) {
    riskStatus = 'over_limit';
    const excess = totalMonthlyDebt - maxSafeMonthlyDebt;
    riskMessage = `High Debt Stress: EMIs are ${debtToIncomeRatioPct}% of income (₹${excess.toLocaleString('en-IN')} over ${safeLimitPct}% safe limit).`;
  } else if (debtToIncomeRatioPct >= safeLimitPct - 10) {
    riskStatus = 'caution';
    riskMessage = `Caution: EMIs represent ${debtToIncomeRatioPct}% of income, approaching your ${safeLimitPct}% safe limit.`;
  }

  return {
    monthlyIncome,
    categories: activeCategories,
    totalMonthlyDebt,
    debtToIncomeRatioPct,
    safeLimitPct,
    maxSafeMonthlyDebt,
    riskStatus,
    riskMessage,
  };
}
