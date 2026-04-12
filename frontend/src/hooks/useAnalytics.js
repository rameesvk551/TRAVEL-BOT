// FILE: /frontend/src/hooks/useAnalytics.js

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary(),
    staleTime: 60 * 1000,
  });
}
