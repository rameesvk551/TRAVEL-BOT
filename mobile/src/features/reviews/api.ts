// FILE: mobile/src/features/reviews/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Review {
  id: string;
  customerName: string;
  rating: number; // 1-5
  platform: string; // Google, Tripadvisor, Direct
  content: string;
  date: string;
  replied: boolean;
}

export function useReviews(platform?: string) {
  return useQuery({
    queryKey: ['reviews', platform],
    queryFn: async () => {
      try {
        const response = await api.get('/reviews', { params: { platform } });
        return response.data.data as Review[];
      } catch (err: any) {
        return getMockReviews().filter(r => {
          if (!platform || platform === 'All') return true;
          return r.platform === platform;
        });
      }
    },
  });
}

export function useReview(id: string) {
  return useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/reviews/${id}`);
        return response.data.data as Review;
      } catch (err: any) {
        return getMockReviews().find(r => r.id === id);
      }
    },
  });
}

function getMockReviews(): Review[] {
  return [
    { id: '1', customerName: 'Ravi Kumar', rating: 5, platform: 'Google', content: 'Amazing experience in Goa! The itinerary was perfect.', date: new Date().toISOString(), replied: false },
    { id: '2', customerName: 'Sunita Sharma', rating: 4, platform: 'Tripadvisor', content: 'Good trip overall, but the hotel could have been better.', date: new Date(Date.now() - 86400000).toISOString(), replied: true },
  ];
}
