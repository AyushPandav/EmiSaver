import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { UnifiedCalendarSummary } from '../types';

export function useUnifiedCalendar() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const [calendarData, setCalendarData] = useState<UnifiedCalendarSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getUnifiedCalendar(selectedMonth, selectedYear);
      setCalendarData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load unified calendar');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const nextMonth = () => {
    setSelectedMonth(prev => {
      if (prev === 12) {
        setSelectedYear(y => y + 1);
        return 1;
      }
      return prev + 1;
    });
  };

  const prevMonth = () => {
    setSelectedMonth(prev => {
      if (prev === 1) {
        setSelectedYear(y => y - 1);
        return 12;
      }
      return prev - 1;
    });
  };

  return {
    selectedMonth,
    selectedYear,
    viewMode,
    setViewMode,
    calendarData,
    isLoading,
    error,
    fetchCalendar,
    nextMonth,
    prevMonth,
  };
}
