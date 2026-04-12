// FILE: /frontend/src/hooks/useLeads.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/leadsApi';

export function useLeads(params = {}) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsApi.list(params),
  });
}

export function useLead(id) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id),
    enabled: !!id,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead'] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
