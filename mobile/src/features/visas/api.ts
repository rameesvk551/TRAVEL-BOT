// FILE: mobile/src/features/visas/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Visa {
  id: string;
  country: string;
  type: string;
  price: number;
  processingTime: string;
  validity: string;
  isActive: boolean;
  flag: string;
}

export function useVisas(status?: string) {
  return useQuery({
    queryKey: ['visas', status],
    queryFn: async () => {
      try {
        const response = await api.get('/visas', { params: { status } });
        return response.data.data as Visa[];
      } catch (err: any) {
        return getMockVisas().filter(v => {
          if (status === 'Active') return v.isActive;
          if (status === 'Inactive') return !v.isActive;
          return true; // All
        });
      }
    },
  });
}

function getMockVisas(): Visa[] {
  return [
    { id: '1', country: 'United Arab Emirates', type: 'Tourist (30 Days)', price: 7500, processingTime: '3-4 Days', validity: '30 Days', isActive: true, flag: '🇦🇪' },
    { id: '2', country: 'Singapore', type: 'Tourist', price: 3500, processingTime: '5-7 Days', validity: '30 Days', isActive: true, flag: '🇸🇬' },
  ];
}
