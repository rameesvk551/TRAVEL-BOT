// FILE: mobile/src/features/services/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface AddonService {
  id: string;
  name: string;
  category: string;
  price: number;
  pricingType: string;
  icon: string;
  features: string[];
  isActive: boolean;
}

export function useServices(category?: string) {
  return useQuery({
    queryKey: ['services', category],
    queryFn: async () => {
      try {
        const response = await api.get('/services', { params: { category } });
        return response.data.data as AddonService[];
      } catch (err: any) {
        return getMockServices().filter(s => !category || category === 'All' || s.category === category);
      }
    },
  });
}

function getMockServices(): AddonService[] {
  return [
    { id: '1', name: 'Travel Insurance', category: 'Insurance', price: 1500, pricingType: 'Starting', icon: '🛡️', features: ['Medical', 'Baggage'], isActive: true },
    { id: '2', name: 'Airport Transfer', category: 'Transport', price: 2000, pricingType: 'Fixed', icon: '🚕', features: ['Sedan', 'AC'], isActive: true },
  ];
}
