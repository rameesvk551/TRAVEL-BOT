// FILE: mobile/src/features/cruises/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Cruise {
  id: string;
  name: string;
  line: string;
  port: string;
  duration: string;
  price: number;
  isActive: boolean;
}

export function useCruises(status?: string) {
  return useQuery({
    queryKey: ['cruises', status],
    queryFn: async () => {
      try {
        const response = await api.get('/cruises', { params: { status } });
        return response.data.data as Cruise[];
      } catch (err: any) {
        return getMockCruises().filter(c => {
          if (status === 'Active') return c.isActive;
          if (status === 'Inactive') return !c.isActive;
          return true; // All
        });
      }
    },
  });
}

function getMockCruises(): Cruise[] {
  return [
    { id: '1', name: 'Mediterranean Bliss', line: 'Royal Caribbean', port: 'Barcelona', duration: '7N/8D', price: 85000, isActive: true },
    { id: '2', name: 'Caribbean Explorer', line: 'Carnival', port: 'Miami', duration: '5N/6D', price: 65000, isActive: true },
  ];
}
