// FILE: /frontend/src/hooks/useLeads.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/leadsApi';
import { crmApi } from '../api/crmApi';

// Agency-configurable pipeline stages ("statuses"). Shared across the Leads
// table, mobile cards, drawer and the Settings manager.
export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipelineStages'],
    queryFn: () => crmApi.listStages(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePipelineStageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pipelineStages'] });
    qc.invalidateQueries({ queryKey: ['leads'] });
  };
  return {
    create: useMutation({ mutationFn: (body) => crmApi.createStage(body), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, body }) => crmApi.updateStage(id, body), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id) => crmApi.deleteStage(id), onSuccess: invalidate }),
    reorder: useMutation({ mutationFn: (orderedIds) => crmApi.reorderStages(orderedIds), onSuccess: invalidate }),
  };
}

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

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => leadsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useBulkAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadIds, agentId }) => leadsApi.bulkAssign(leadIds, agentId),
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

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadIds) => {
      const results = await Promise.allSettled(leadIds.map((id) => leadsApi.delete(id)));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        throw new Error(`${failed.length} lead${failed.length === 1 ? '' : 's'} could not be deleted`);
      }
      return { deleted: results.length };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead'] });
    },
  });
}

// FollowUp hooks
export function useFollowUps(params = {}) {
  return useQuery({
    queryKey: ['followups', params],
    queryFn: () => leadsApi.listFollowUps(params),
  });
}

export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.addFollowUp(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, followUpId, data }) => leadsApi.updateFollowUp(id, followUpId, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, followUpId }) => leadsApi.deleteFollowUp(id, followUpId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

// Note hooks
export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.addNote(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}
