/**
 * useLoanActions — Hook for loan-level CRUD operations.
 *
 * Wraps the loans store with per-operation loading/error states
 * and provides convenient action methods for the UI.
 */

import { useCallback, useState } from 'react';
import { useLoansStore } from '../store/useLoansStore';
import { Loan } from '../types';

interface UseLoanActionsReturn {
  /** All loans. */
  loans: Loan[];

  /** Per-action loading state. */
  isUpdating: boolean;

  /** Per-action error. */
  actionError: string | null;

  /** Edit a loan's fields (lender, EMI, due date, etc.). */
  editLoan: (loanId: string, updates: {
    lender?: string;
    loanIdentifier?: string;
    emiAmount?: number;
    nextDueDate?: string;
    status?: string;
  }) => Promise<void>;

  /** Merge two duplicate loans into one. */
  mergeDuplicates: (primaryId: string, secondaryId: string) => Promise<void>;

  /** Mark a false-positive entry as "not a loan". */
  dismissFalsePositive: (loanId: string) => Promise<void>;

  /** Mark a loan as manually verified by the user. */
  verifyLoan: (loanId: string) => Promise<void>;

  /** Close/deactivate a loan. */
  closeLoan: (loanId: string) => Promise<void>;

  /** Clear the current action error. */
  clearError: () => void;
}

export function useLoanActions(): UseLoanActionsReturn {
  const { loans, updateLoan, mergeLoans, dismissLoan } = useLoansStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const wrapAction = useCallback(
    async (action: () => Promise<void>, errorPrefix: string) => {
      setIsUpdating(true);
      setActionError(null);
      try {
        await action();
      } catch (err: any) {
        setActionError(`${errorPrefix}: ${err.message}`);
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const editLoan = useCallback(
    async (loanId: string, updates: any) => {
      await wrapAction(
        () =>
          updateLoan(loanId, {
            lender: updates.lender,
            loan_identifier: updates.loanIdentifier,
            emi_amount: updates.emiAmount,
            next_due_date: updates.nextDueDate,
            status: updates.status,
          }),
        'Edit failed'
      );
    },
    [updateLoan, wrapAction]
  );

  const mergeDuplicates = useCallback(
    async (primaryId: string, secondaryId: string) => {
      await wrapAction(
        () => mergeLoans(primaryId, secondaryId),
        'Merge failed'
      );
    },
    [mergeLoans, wrapAction]
  );

  const dismissFalsePositive = useCallback(
    async (loanId: string) => {
      await wrapAction(
        () => dismissLoan(loanId),
        'Dismiss failed'
      );
    },
    [dismissLoan, wrapAction]
  );

  const verifyLoan = useCallback(
    async (loanId: string) => {
      await wrapAction(
        () => updateLoan(loanId, { manually_verified: true } as any),
        'Verify failed'
      );
    },
    [updateLoan, wrapAction]
  );

  const closeLoan = useCallback(
    async (loanId: string) => {
      await wrapAction(
        () => updateLoan(loanId, { status: 'closed' }),
        'Close failed'
      );
    },
    [updateLoan, wrapAction]
  );

  const clearError = useCallback(() => setActionError(null), []);

  return {
    loans,
    isUpdating,
    actionError,
    editLoan,
    mergeDuplicates,
    dismissFalsePositive,
    verifyLoan,
    closeLoan,
    clearError,
  };
}
