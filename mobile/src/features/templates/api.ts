// FILE: mobile/src/features/templates/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Template {
  id: string;
  name: string;
  channel: string; // WhatsApp, Email, SMS
  status: string; // Approved, Pending, Draft
  content: string;
  category: string; // Marketing, Utility, Authentication
}

export function useTemplates(channel?: string) {
  return useQuery({
    queryKey: ['templates', channel],
    queryFn: async () => {
      try {
        const response = await api.get('/templates', { params: { channel } });
        return response.data.data as Template[];
      } catch (err: any) {
        return getMockTemplates().filter(t => {
          if (!channel || channel === 'All') return true;
          return t.channel === channel;
        });
      }
    },
  });
}

function getMockTemplates(): Template[] {
  return [
    { id: '1', name: 'Diwali Offer', channel: 'WhatsApp', status: 'Approved', category: 'Marketing', content: 'Hi {{name}}, special offer for you!' },
    { id: '2', name: 'Booking Confirmation', channel: 'Email', status: 'Approved', category: 'Utility', content: 'Your booking {{bookingId}} is confirmed.' },
  ];
}
