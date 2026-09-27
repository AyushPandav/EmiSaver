import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { PressureWindowData } from '../types';

export function usePressureScore() {
  const [windows, setWindows] = useState<PressureWindowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPressureWindows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPressureWindows();
      setWindows(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pressure windows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPressureWindows();
  }, [fetchPressureWindows]);

  return {
    windows,
    isLoading,
    error,
    refresh: fetchPressureWindows,
  };
}
