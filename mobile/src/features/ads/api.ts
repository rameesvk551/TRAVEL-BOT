// FILE: mobile/src/features/ads/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface AdCampaign {
  id: string;
  name: string;
  platform: string; // Meta, Google
  status: string; // Active, Paused, Completed
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export function useAds() {
  return useQuery({
    queryKey: ['ads'],
    queryFn: async () => {
      try {
        const response = await api.get('/ads');
        return response.data.data as AdCampaign[];
      } catch (err: any) {
        return getMockAds();
      }
    },
  });
}

function getMockAds(): AdCampaign[] {
  return [
    { id: '1', name: 'Goa Retargeting', platform: 'Meta', status: 'Active', spend: 4500, impressions: 12000, clicks: 850, leads: 42 },
    { id: '2', name: 'Europe Search Ads', platform: 'Google', status: 'Active', spend: 12000, impressions: 5000, clicks: 450, leads: 15 },
    { id: '3', name: 'Diwali Promo', platform: 'Meta', status: 'Paused', spend: 8500, impressions: 25000, clicks: 1200, leads: 85 },
  ];
}
