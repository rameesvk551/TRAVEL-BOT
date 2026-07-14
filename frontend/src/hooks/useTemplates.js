// FILE: /frontend/src/hooks/useTemplates.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../api/templatesApi';

export function usePrebuiltTemplates(params = {}) {
  return useQuery({
    queryKey: ['templates', 'prebuilt', params],
    queryFn: () => templatesApi.listPrebuilt(params),
  });
}

export function useAgencyTemplates(params = {}) {
  return useQuery({
    queryKey: ['templates', 'agency', params],
    queryFn: () => templatesApi.listAgency(params),
  });
}

export function useTemplate(id) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => templatesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => templatesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => templatesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['template', id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => templatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => templatesApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUsePrebuiltTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => templatesApi.usePrebuilt(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useSubmitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => templatesApi.submit(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['template', id] });
    },
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => templatesApi.sync(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}
