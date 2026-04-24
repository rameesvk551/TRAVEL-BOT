import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flowsApi } from '../api/flowsApi';

export function useFlows(params = {}) {
  return useQuery({
    queryKey: ['flows', params],
    queryFn: () => flowsApi.list(params),
  });
}

export function useFlow(id) {
  return useQuery({
    queryKey: ['flow', id],
    queryFn: () => flowsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => flowsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });
}

export function useUpdateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => flowsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      qc.invalidateQueries({ queryKey: ['flow', id] });
    },
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => flowsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });
}

export function usePublishFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => flowsApi.publish(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      qc.invalidateQueries({ queryKey: ['flow', id] });
    },
  });
}

export function useSyncFlows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => flowsApi.sync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });
}
