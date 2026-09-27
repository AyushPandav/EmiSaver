/**
 * useDashboard — Hook for the main dashboard screen.
 *
 * Fetches server-side data and supplements with on-device risk
 * calculation for instant feedback.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoansStore } from '../store/useLoansStore';
import { useUserStore } from '../store/useUserStore';
import { computeLocalRisk, LocalRiskResult } from '../utils/riskCalculator';

interface UseDashboardReturn {
  /** Server-side dashboard summary (null until first fetch). */
  summary: ReturnType<typeof useLoansStore.getState>['summary'];

  /** Instant on-device risk calculation (always available). */
  localRisk: LocalRiskResult;

  /** Active loans list. */
  loans: ReturnType<typeof useLoansStore.getState>['loans'];

  /** Upcoming repayment items. */
  upcomingRepayments: ReturnType<typeof useLoansStore.getState>['upcomingRepayments'];

  /** Loading/error states. */
  isLoading: boolean;
  error: string | null;

  /** Refresh all dashboard data from the server. */
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const { loans, summary, upcomingRepayments, isLoading, error, fetchDashboardData } =
    useLoansStore();
  const { incomeProfile } = useUserStore();

  // Compute on-device risk instantly from local state
  const localRisk = useMemo(
    () => computeLocalRisk(incomeProfile, loans),
    [incomeProfile, loans]
  );

  const refresh = useCallback(async () => {
    await fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-fetch on mount
  useEffect(() => {
    refresh();
  }, []);

  return {
    summary,
    localRisk,
    loans,
    upcomingRepayments,
    isLoading,
    error,
    refresh,
  };
}
