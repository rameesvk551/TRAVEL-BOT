// FILE: mobile/src/features/packages/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Package {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  duration: string;
  coverImage?: string;
  isActive: boolean;
}

export function usePackages(category?: string) {
  return useQuery({
    queryKey: ['packages', category],
    queryFn: async () => {
      try {
        const response = await api.get('/packages', { params: { category } });
        return response.data.data as Package[];
      } catch (err: any) {
        return getMockPackages().filter(p => !category || category === 'All' || p.category === category);
      }
    },
  });
}

export function usePackage(id: string) {
  return useQuery({
    queryKey: ['packages', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/packages/${id}`);
        return response.data.data as Package;
      } catch (err: any) {
        return getMockPackages().find(p => p.id === id);
      }
    },
  });
}

function getMockPackages(): Package[] {
  return [
    { id: '1', name: 'Goa Beach Escape', category: 'Domestic', basePrice: 25000, duration: '4N/5D', isActive: true },
    { id: '2', name: 'Swiss Alps Wonder', category: 'International', basePrice: 150000, duration: '6N/7D', isActive: true },
    { id: '3', name: 'Kerala Backwaters', category: 'Domestic', basePrice: 18000, duration: '3N/4D', isActive: false },
  ];
}
