/**
 * On-device risk calculator — mirrors backend logic from §6.5.
 * Runs entirely on-device so the user can get instant feedback
 * before the server round-trip completes.
 */

import { RiskStatus, Loan, IncomeProfile } from '../types';

export interface LocalRiskResult {
  totalEmi: number;
  emiToIncomePct: number;
  maxSafeEmi: number;
  safeEmiRatioPct: number;
  riskStatus: RiskStatus;
  riskMessage: string;
  ratioUtilization: number;
  activeLoansCount: number;
  currency: string;
}

/**
 * Compute EMI/Income ratio and risk status locally (no network call).
 *
 * Logic matches the backend's RiskCalculator.compute_and_save_snapshot:
 * - Safe:       utilization <= 70% of safe ratio limit
 * - Caution:    70% - 100% of safe ratio limit
 * - Over-limit: > 100% of safe ratio limit
 */
export function computeLocalRisk(
  incomeProfile: IncomeProfile | null,
  loans: Loan[]
): LocalRiskResult {
  const monthlyIncome = incomeProfile?.monthlyIncome ?? 0;
  const safeRatio = incomeProfile?.safeEmiRatio ?? 0.40;
  const safeRatioPct = safeRatio * 100;

  // Sum active EMIs
  const activeLoans = loans.filter(l => l.status === 'active');
  const totalEmi = activeLoans.reduce((sum, l) => sum + (l.emiAmount || 0), 0);
  const maxSafeEmi = monthlyIncome * safeRatio;

  // EMI as percentage of income
  const emiToIncomePct = monthlyIncome > 0
    ? (totalEmi / monthlyIncome) * 100
    : 0;

  // Ratio utilization: how much of the safe band is consumed
  const ratioUtilization = safeRatioPct > 0
    ? emiToIncomePct / safeRatioPct
    : 1.0;

  // Determine status + human-readable message
  let riskStatus: RiskStatus;
  let riskMessage: string;

  if (ratioUtilization <= 0.70) {
    riskStatus = 'safe';
    riskMessage = `Your EMIs are ${emiToIncomePct.toFixed(1)}% of income — well within your ${safeRatioPct.toFixed(0)}% safe limit.`;
  } else if (ratioUtilization <= 1.00) {
    riskStatus = 'caution';
    riskMessage = `Your EMIs are ${emiToIncomePct.toFixed(1)}% of income — approaching your ${safeRatioPct.toFixed(0)}% safe limit.`;
  } else {
    riskStatus = 'over_limit';
    const overflow = totalEmi - maxSafeEmi;
    riskMessage = `Warning: Your EMIs (${emiToIncomePct.toFixed(1)}%) exceed your safe threshold of ${safeRatioPct.toFixed(0)}% by ₹${overflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`;
  }

  return {
    totalEmi,
    emiToIncomePct: parseFloat(emiToIncomePct.toFixed(1)),
    maxSafeEmi,
    safeEmiRatioPct: safeRatioPct,
    riskStatus,
    riskMessage,
    ratioUtilization: parseFloat(ratioUtilization.toFixed(3)),
    activeLoansCount: activeLoans.length,
    currency: '₹',
  };
}

/**
 * Quick helper: returns true if the combined EMI exceeds
 * the safe limit by the given percentage margin.
 */
export function isOverLimitByMargin(
  incomeProfile: IncomeProfile | null,
  loans: Loan[],
  marginPct: number = 10
): boolean {
  const result = computeLocalRisk(incomeProfile, loans);
  return result.emiToIncomePct > (result.safeEmiRatioPct + marginPct);
}

/**
 * Format a currency amount with Indian locale formatting.
 */
export function formatINR(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
