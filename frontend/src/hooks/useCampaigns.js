// FILE: /frontend/src/hooks/useCampaigns.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '../api/campaignsApi';

export function useCampaigns(params = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => campaignsApi.list(params),
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.getById(id),
    enabled: !!id,
    // Poll every 30s so stats update
    refetchInterval: 30000,
  });
}

export function useCampaignStats(id) {
  return useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => campaignsApi.getStats(id),
    enabled: !!id,
    refetchInterval: 15000,
  });
}

export function useCampaignAnalytics(params = {}) {
  return useQuery({
    queryKey: ['campaign-analytics', params],
    queryFn: () => campaignsApi.analytics(params),
    staleTime: 60 * 1000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => campaignsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => campaignsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => campaignsApi.send(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => campaignsApi.cancel(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => campaignsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => campaignsApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function usePreviewAudience() {
  return useMutation({
    mutationFn: (filter) => campaignsApi.previewAudience(filter),
  });
}
