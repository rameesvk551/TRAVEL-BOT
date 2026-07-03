import { useQuery } from '@tanstack/react-query';
import { missedCallsApi } from '../api/missedCallsApi';

export function useMissedCalls(params = {}) {
  return useQuery({
    queryKey: ['missedCalls', params],
    queryFn: () => missedCallsApi.list(params),
  });
}
