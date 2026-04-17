// FILE: /frontend/src/hooks/useDrips.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dripsApi } from '../api/dripsApi';

export function useDrips() {
  return useQuery({
    queryKey: ['drips'],
    queryFn: () => dripsApi.list(),
  });
}

export function useDripSequence(id) {
  return useQuery({
    queryKey: ['drip', id],
    queryFn: () => dripsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateDrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => dripsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drips'] }),
  });
}

export function useUpdateDrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => dripsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['drips'] });
      qc.invalidateQueries({ queryKey: ['drip', id] });
    },
  });
}

export function useToggleDrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => dripsApi.toggle(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['drips'] });
      qc.invalidateQueries({ queryKey: ['drip', id] });
    },
  });
}
