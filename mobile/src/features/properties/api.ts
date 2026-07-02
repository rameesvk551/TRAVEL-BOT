// FILE: mobile/src/features/properties/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Property {
  id: string;
  name: string;
  type: string;
  location: string;
  pricePerNight: number;
  coverImage?: string;
  isActive: boolean;
  amenities: string[];
}

export function useProperties(status?: string) {
  return useQuery({
    queryKey: ['properties', status],
    queryFn: async () => {
      try {
        const response = await api.get('/properties', { params: { status } });
        return response.data.data as Property[];
      } catch (err: any) {
        return getMockProperties().filter(p => {
          if (status === 'For sale') return p.type === 'For sale';
          if (status === 'For rent') return p.type === 'For rent';
          if (status === 'Inactive') return !p.isActive;
          return true; // All
        });
      }
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        return response.data.data as Property;
      } catch (err: any) {
        return getMockProperties().find(p => p.id === id);
      }
    },
  });
}

function getMockProperties(): Property[] {
  return [
    { id: '1', name: 'Sunset Villa', type: 'For rent', location: 'Goa', pricePerNight: 12000, isActive: true, amenities: ['Pool', 'WiFi', 'Kitchen'] },
    { id: '2', name: 'Alpine Chalet', type: 'For rent', location: 'Manali', pricePerNight: 8500, isActive: true, amenities: ['Heater', 'WiFi', 'Mountain View'] },
  ];
}
