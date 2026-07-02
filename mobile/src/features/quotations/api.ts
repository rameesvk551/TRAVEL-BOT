// FILE: mobile/src/features/quotations/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Quotation {
  id: string;
  number: string;
  customerName: string;
  amount: number;
  date: string;
  status: string;
}

export function useQuotations(status?: string) {
  return useQuery({
    queryKey: ['quotations', status],
    queryFn: async () => {
      try {
        const response = await api.get('/quotations', { params: { status } });
        return response.data.data as Quotation[];
      } catch (err: any) {
        return getMockQuotations().filter(q => {
          if (!status || status === 'All') return true;
          return q.status === status;
        });
      }
    },
  });
}

function getMockQuotations(): Quotation[] {
  return [
    { id: '1', number: 'EST-1001', customerName: 'Ravi Kumar', amount: 150000, date: new Date().toISOString(), status: 'Draft' },
    { id: '2', number: 'EST-1002', customerName: 'Sunita Sharma', amount: 85000, date: new Date(Date.now() - 86400000).toISOString(), status: 'Sent' },
    { id: '3', number: 'EST-1003', customerName: 'Amit Singh', amount: 12000, date: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'Accepted' },
  ];
}
