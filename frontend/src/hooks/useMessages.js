// FILE: /frontend/src/hooks/useMessages.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '../api/messagesApi';

export function useMessages(customerId, params = {}) {
  return useQuery({
    queryKey: ['messages', customerId, params],
    queryFn: () => messagesApi.list(customerId, params),
    enabled: !!customerId,
    refetchInterval: 8000,
  });
}

export function useMessageThreads(params = {}) {
  return useQuery({
    queryKey: ['message-threads', params],
    queryFn: () => messagesApi.threads(params),
    refetchInterval: 8000,
  });
}

export function useLiveMessages() {
  return useQuery({
    queryKey: ['messages-live'],
    queryFn: () => messagesApi.getLive(),
    refetchInterval: 8000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => messagesApi.send(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['messages', variables.customerId] });
      qc.invalidateQueries({ queryKey: ['messages-live'] });
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useAssignableAgents() {
  return useQuery({
    queryKey: ['assignable-agents'],
    queryFn: () => messagesApi.assignableAgents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAssignThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, agentId }) => messagesApi.assign(customerId, agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}

export function useTakeover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId) => messagesApi.takeover(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });
}
