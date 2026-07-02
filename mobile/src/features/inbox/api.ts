// FILE: mobile/src/features/inbox/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface InboxThread {
  id: string;
  contactName: string;
  avatarUrl?: string;
  channel: 'WA' | 'IG';
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  assignedTo?: string;
  isBotMode: boolean;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  timestamp: string;
}

export function useInboxThreads(filter: 'all' | 'leads' | 'customers' = 'all') {
  return useQuery({
    queryKey: ['inbox', 'threads', filter],
    queryFn: async () => {
      try {
        const response = await api.get('/messages/threads', { params: { filter } });
        return response.data.data as InboxThread[];
      } catch (err: any) {
        if (err.response?.status === 404 || true) {
          return getMockThreads(filter);
        }
        throw err;
      }
    },
  });
}

export function useMessages(threadId: string) {
  return useQuery({
    queryKey: ['inbox', 'messages', threadId],
    queryFn: async () => {
      try {
        const response = await api.get(`/messages/threads/${threadId}/messages`);
        return response.data.data as ChatMessage[];
      } catch (err: any) {
        return getMockMessages(threadId);
      }
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      // Mock network delay
      await new Promise(r => setTimeout(r, 1000));
      return { id: Math.random().toString(), threadId, content, direction: 'outbound', status: 'sent', timestamp: new Date().toISOString() } as ChatMessage;
    },
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: ['inbox', 'messages', newMessage.threadId] });
      const previousMessages = queryClient.getQueryData(['inbox', 'messages', newMessage.threadId]);
      
      const optimisticMsg: ChatMessage = {
        id: Math.random().toString(),
        threadId: newMessage.threadId,
        content: newMessage.content,
        direction: 'outbound',
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      queryClient.setQueryData(['inbox', 'messages', newMessage.threadId], (old: any) => [...(old || []), optimisticMsg]);
      return { previousMessages, optimisticMsg };
    },
    onError: (err, newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['inbox', 'messages', newMessage.threadId], context.previousMessages);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', variables.threadId] });
    },
  });
}

// Mocks
function getMockThreads(filter: string): InboxThread[] {
  return [
    { id: '1', contactName: 'Priya Sharma', channel: 'WA', lastMessage: 'Can you send the itinerary?', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), unreadCount: 2, isBotMode: false, assignedTo: 'You' },
    { id: '2', contactName: 'Rahul Kumar', channel: 'IG', lastMessage: 'Thanks!', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), unreadCount: 0, isBotMode: true },
    { id: '3', contactName: 'Anil Desai', channel: 'WA', lastMessage: 'I would like to book a flight.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), unreadCount: 1, isBotMode: false },
  ];
}

function getMockMessages(threadId: string): ChatMessage[] {
  return [
    { id: 'm1', threadId, content: 'Hi, I am looking for a package to Bali.', direction: 'inbound', status: 'read', timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
    { id: 'm2', threadId, content: 'Hello! I can help you with that. Are you looking for a romantic or family trip?', direction: 'outbound', status: 'read', timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString() },
    { id: 'm3', threadId, content: 'Family trip.', direction: 'inbound', status: 'read', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: 'm4', threadId, content: 'Can you send the itinerary?', direction: 'inbound', status: 'read', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  ];
}
