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

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => leadsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

// FollowUp hooks
export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.addFollowUp(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, followUpId, data }) => leadsApi.updateFollowUp(id, followUpId, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, followUpId }) => leadsApi.deleteFollowUp(id, followUpId),
    onSuccess: (_, { id }) => {
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
