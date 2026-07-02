// FILE: mobile/src/features/settings/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface BusinessProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
}

export function useBusinessProfile() {
  return useQuery({
    queryKey: ['businessProfile'],
    queryFn: async () => {
      try {
        const response = await api.get('/settings/business');
        return response.data.data as BusinessProfile;
      } catch (err: any) {
        return getMockBusinessProfile();
      }
    },
  });
}

function getMockBusinessProfile(): BusinessProfile {
  return {
    id: 'tenant-123',
    name: 'Wanderlust Travels',
    email: 'hello@wanderlust.com',
    phone: '+91 98765 43210',
    address: '123 Beach Road, Goa',
    currency: 'INR',
  };
}
