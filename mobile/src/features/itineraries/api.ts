// FILE: mobile/src/features/itineraries/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Itinerary {
  id: string;
  name: string;
  client: string;
  destination: string;
  date: string;
  price: number;
  margin: number;
  status: string;
}

export function useItineraries(status?: string) {
  return useQuery({
    queryKey: ['itineraries', status],
    queryFn: async () => {
      try {
        const response = await api.get('/itineraries', { params: { status } });
        return response.data.data as Itinerary[];
      } catch (err: any) {
        return getMockItineraries().filter(i => {
          if (!status || status === 'All') return true;
          return i.status === status;
        });
      }
    },
  });
}

function getMockItineraries(): Itinerary[] {
  return [
    { id: '1', name: 'Goa Honeymoon Trip', client: 'Ravi Kumar', destination: 'Goa', date: new Date().toISOString(), price: 45000, margin: 15, status: 'Draft' },
    { id: '2', name: 'Swiss Family Vacay', client: 'Sunita Sharma', destination: 'Switzerland', date: new Date(Date.now() - 86400000).toISOString(), price: 350000, margin: 20, status: 'Sent' },
  ];
}
