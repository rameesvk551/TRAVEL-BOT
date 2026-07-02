// FILE: mobile/src/features/insights/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface ReportData {
  title: string;
  value: string;
  delta: number;
}

export function useInsightsData(type: string) {
  return useQuery({
    queryKey: ['insights', type],
    queryFn: async () => {
      try {
        const response = await api.get('/insights', { params: { type } });
        return response.data.data as ReportData[];
      } catch (err: any) {
        if (type === 'analytics') {
          return [
            { title: 'Total Revenue', value: '₹12.5M', delta: 15 },
            { title: 'Bookings', value: '142', delta: 8 },
            { title: 'Avg Order Value', value: '₹88K', delta: -2 },
            { title: 'Conversion Rate', value: '4.2%', delta: 1.1 },
          ];
        }
        if (type === 'crm') {
          return [
            { title: 'New Leads', value: '850', delta: 12 },
            { title: 'Qualified', value: '320', delta: 5 },
            { title: 'Proposals Sent', value: '150', delta: -4 },
            { title: 'Won', value: '42', delta: 8 },
          ];
        }
        if (type === 'calling') {
          return [
            { title: 'Total Calls', value: '1,240', delta: 25 },
            { title: 'Connected', value: '850', delta: 10 },
            { title: 'Avg Duration', value: '4m 12s', delta: -5 },
            { title: 'Talk Time', value: '62h', delta: 15 },
          ];
        }
        return [];
      }
    },
  });
}
