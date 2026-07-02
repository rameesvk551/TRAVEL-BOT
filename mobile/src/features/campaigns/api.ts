// FILE: mobile/src/features/campaigns/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Campaign {
  id: string;
  name: string;
  type: string; // WhatsApp, Email
  status: string; // Draft, Scheduled, Sent
  sentCount: number;
  openCount?: number;
  clickCount?: number;
  date: string;
}

export function useCampaigns(status?: string) {
  return useQuery({
    queryKey: ['campaigns', status],
    queryFn: async () => {
      try {
        const response = await api.get('/campaigns', { params: { status } });
        return response.data.data as Campaign[];
      } catch (err: any) {
        return getMockCampaigns().filter(c => {
          if (!status || status === 'All') return true;
          return c.status === status;
        });
      }
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/campaigns/${id}`);
        return response.data.data as Campaign;
      } catch (err: any) {
        return getMockCampaigns().find(c => c.id === id);
      }
    },
  });
}

function getMockCampaigns(): Campaign[] {
  return [
    { id: '1', name: 'Summer Special Offer', type: 'WhatsApp', status: 'Sent', sentCount: 1500, openCount: 1200, clickCount: 450, date: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', name: 'Diwali Greetings', type: 'Email', status: 'Scheduled', sentCount: 0, date: new Date(Date.now() + 86400000 * 5).toISOString() },
    { id: '3', name: 'Abandoned Cart Recovery', type: 'WhatsApp', status: 'Draft', sentCount: 0, date: new Date().toISOString() },
  ];
}
