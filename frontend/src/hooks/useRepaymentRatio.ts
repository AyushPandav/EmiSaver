import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { RepaymentRatioData } from '../types';

export function useRepaymentRatio() {
  const [ratioData, setRatioData] = useState<RepaymentRatioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRatio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRepaymentRatio();
      setRatioData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repayment ratio');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRatio();
  }, [fetchRatio]);

  return {
    ratioData,
    isLoading,
    error,
    refresh: fetchRatio,
  };
}
