/**
 * useAuth — Authentication & session management hook.
 *
 * Handles device ID generation, session initialization, and
 * onboarding state transitions.
 */

import { useCallback, useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';

interface UseAuthReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  error: string | null;

  /** Initialize a device session (create or fetch user). */
  initSession: () => Promise<void>;

  /** Complete onboarding by saving income profile. */
  completeOnboarding: (profile: {
    monthlyIncome: number;
    salaryDate?: number;
    fixedExpenses?: number;
    safeEmiRatio?: number;
  }) => Promise<void>;

  /** Clear all local state (logout). */
  clearSession: () => void;
}

export function useAuth(): UseAuthReturn {
  const {
    user,
    isOnboarded,
    initSession: storeInitSession,
    saveIncomeProfile,
    setOnboarded,
  } = useUserStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await storeInitSession();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session');
    } finally {
      setIsLoading(false);
    }
  }, [storeInitSession]);

  const completeOnboarding = useCallback(
    async (profile: {
      monthlyIncome: number;
      salaryDate?: number;
      fixedExpenses?: number;
      safeEmiRatio?: number;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        await saveIncomeProfile({
          monthlyIncome: profile.monthlyIncome,
          salaryDate: profile.salaryDate ?? 1,
          fixedExpenses: profile.fixedExpenses ?? 0,
          safeEmiRatio: profile.safeEmiRatio ?? 0.40,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to save profile');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [saveIncomeProfile]
  );

  const clearSession = useCallback(() => {
    setOnboarded(false);
    // In a real app, also clear AsyncStorage and device tokens
  }, [setOnboarded]);

  return {
    isLoading,
    isAuthenticated: !!user,
    isOnboarded,
    error,
    initSession,
    completeOnboarding,
    clearSession,
  };
}
