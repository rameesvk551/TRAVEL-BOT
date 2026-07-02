import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callsApi } from '../api/callsApi';

export function useCallLogs(params = {}) {
  return useQuery({
    queryKey: ['callLogs', params],
    queryFn: () => callsApi.list(params),
    enabled: Boolean(params.leadId),
  });
}

export function useStartLeadCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId) => callsApi.start(leadId),
    onSuccess: (_, leadId) => {
      qc.invalidateQueries({ queryKey: ['callLogs'] });
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
