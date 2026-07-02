// FILE: mobile/src/features/social/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface SocialMessage {
  id: string;
  senderName: string;
  platform: string; // Instagram, Facebook
  preview: string;
  date: string;
  unread: boolean;
}

export function useSocialMessages(platform?: string) {
  return useQuery({
    queryKey: ['social', platform],
    queryFn: async () => {
      try {
        const response = await api.get('/social', { params: { platform } });
        return response.data.data as SocialMessage[];
      } catch (err: any) {
        return getMockSocialMessages().filter(m => {
          if (!platform || platform === 'All') return true;
          return m.platform === platform;
        });
      }
    },
  });
}

function getMockSocialMessages(): SocialMessage[] {
  return [
    { id: '1', senderName: 'Ravi Kumar', platform: 'Instagram', preview: 'How much for the Goa package?', date: new Date().toISOString(), unread: true },
    { id: '2', senderName: 'Sunita Sharma', platform: 'Facebook', preview: 'Is this available next week?', date: new Date(Date.now() - 3600000).toISOString(), unread: false },
  ];
}
