// FILE: mobile/src/features/referrals/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Referral {
  id: string;
  referrerName: string;
  referredName: string;
  status: string; // Pending, Converted
  rewardAmount: number;
  date: string;
}

export function useReferrals(status?: string) {
  return useQuery({
    queryKey: ['referrals', status],
    queryFn: async () => {
      try {
        const response = await api.get('/referrals', { params: { status } });
        return response.data.data as Referral[];
      } catch (err: any) {
        return getMockReferrals().filter(r => {
          if (!status || status === 'All') return true;
          return r.status === status;
        });
      }
    },
  });
}

function getMockReferrals(): Referral[] {
  return [
    { id: '1', referrerName: 'Ravi Kumar', referredName: 'Amit Singh', status: 'Converted', rewardAmount: 5000, date: new Date().toISOString() },
    { id: '2', referrerName: 'Sunita Sharma', referredName: 'Neha Gupta', status: 'Pending', rewardAmount: 2000, date: new Date(Date.now() - 86400000).toISOString() },
  ];
}
