/**
 * useCalendar — Hook for the calendar/upcoming-repayments screen.
 *
 * Groups upcoming EMI repayments by date and provides
 * monthly totals and navigation helpers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoansStore } from '../store/useLoansStore';
import { EmiScheduleItem } from '../types';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  repayments: EmiScheduleItem[];
  totalAmount: number;
}

interface UseCalendarReturn {
  /** All upcoming repayments (flat). */
  repayments: EmiScheduleItem[];

  /** Repayments grouped by date. */
  calendarDays: CalendarDay[];

  /** Total amount due across all upcoming repayments. */
  totalUpcoming: number;

  /** Currently selected month (1-12). */
  selectedMonth: number;

  /** Currently selected year. */
  selectedYear: number;

  /** Repayments filtered to the selected month. */
  monthRepayments: EmiScheduleItem[];

  /** Total for the selected month. */
  monthTotal: number;

  /** Navigate to a specific month. */
  setMonth: (month: number, year: number) => void;

  /** Move forward one month. */
  nextMonth: () => void;

  /** Move backward one month. */
  prevMonth: () => void;

  /** Loading state. */
  isLoading: boolean;

  /** Refresh data from server. */
  refresh: () => Promise<void>;
}

export function useCalendar(): UseCalendarReturn {
  const { upcomingRepayments, isLoading, fetchDashboardData } = useLoansStore();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Group repayments by date
  const calendarDays = useMemo(() => {
    const dayMap = new Map<string, EmiScheduleItem[]>();

    for (const r of upcomingRepayments) {
      const dateKey = r.dueDate.substring(0, 10); // YYYY-MM-DD
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(r);
    }

    return Array.from(dayMap.entries())
      .map(([date, repayments]) => ({
        date,
        repayments,
        totalAmount: repayments.reduce((sum, r) => sum + r.amount, 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [upcomingRepayments]);

  // Total upcoming amount
  const totalUpcoming = useMemo(
    () => upcomingRepayments.reduce((sum, r) => sum + r.amount, 0),
    [upcomingRepayments]
  );

  // Filter to selected month
  const monthRepayments = useMemo(() => {
    return upcomingRepayments.filter(r => {
      const d = new Date(r.dueDate);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [upcomingRepayments, selectedMonth, selectedYear]);

  const monthTotal = useMemo(
    () => monthRepayments.reduce((sum, r) => sum + r.amount, 0),
    [monthRepayments]
  );

  const setMonth = useCallback((month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  }, []);

  const nextMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev === 12) {
        setSelectedYear(y => y + 1);
        return 1;
      }
      return prev + 1;
    });
  }, []);

  const prevMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev === 1) {
        setSelectedYear(y => y - 1);
        return 12;
      }
      return prev - 1;
    });
  }, []);

  const refresh = useCallback(async () => {
    await fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-fetch on mount
  useEffect(() => {
    refresh();
  }, []);

  return {
    repayments: upcomingRepayments,
    calendarDays,
    totalUpcoming,
    selectedMonth,
    selectedYear,
    monthRepayments,
    monthTotal,
    setMonth,
    nextMonth,
    prevMonth,
    isLoading,
    refresh,
  };
}
