// FILE: mobile/src/features/leads/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Lead {
  id: string;
  name: string;
  destination: string;
  source: string;
  status: string;
  assignedAgent: string;
  nextFollowUp?: string;
  isOverdue: boolean;
  avatarUrl?: string;
  value: number;
}

export interface FollowUpTask {
  id: string;
  leadId: string;
  leadName: string;
  trip: string;
  dueTime: string;
  note: string;
  assignedAgent: string;
  isOverdue: boolean;
  status: 'pending' | 'done';
}

export function useLeads(filter?: Record<string, any>) {
  return useQuery({
    queryKey: ['leads', filter],
    queryFn: async () => {
      try {
        const response = await api.get('/leads', { params: filter });
        return response.data.data as Lead[];
      } catch (err: any) {
        return getMockLeads();
      }
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/leads/${id}`);
        return response.data.data as Lead;
      } catch (err: any) {
        return getMockLeads().find(l => l.id === id);
      }
    },
  });
}

export function useFollowUps(filter?: string) {
  return useQuery({
    queryKey: ['followups', filter],
    queryFn: async () => {
      try {
        const response = await api.get('/leads/followups', { params: { filter } });
        return response.data.data as FollowUpTask[];
      } catch (err: any) {
        return getMockFollowUps();
      }
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await new Promise(r => setTimeout(r, 500));
      return { id, status }; // mocked response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await new Promise(r => setTimeout(r, 500));
      return { id, status: 'done' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
    },
  });
}

// Mocks
function getMockLeads(): Lead[] {
  return [
    { id: '1', name: 'John Doe', destination: 'Dubai', source: 'Instagram Ads', status: 'New', assignedAgent: 'You', isOverdue: false, value: 50000 },
    { id: '2', name: 'Jane Smith', destination: 'Maldives', source: 'Referral', status: 'Follow Up', assignedAgent: 'You', nextFollowUp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), isOverdue: true, value: 120000 },
    { id: '3', name: 'Acme Corp', destination: 'Goa', source: 'Website', status: 'Negotiation', assignedAgent: 'Alex', nextFollowUp: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), isOverdue: false, value: 80000 },
  ];
}

function getMockFollowUps(): FollowUpTask[] {
  return [
    { id: 'f1', leadId: '2', leadName: 'Jane Smith', trip: 'Maldives', dueTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(), note: 'Call to discuss itinerary', assignedAgent: 'You', isOverdue: true, status: 'pending' },
    { id: 'f2', leadId: '4', leadName: 'Vikram Singh', trip: 'Thailand', dueTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), note: 'Send quotation', assignedAgent: 'You', isOverdue: false, status: 'pending' },
  ];
}
