// FILE: mobile/src/features/accounting/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: string; // Paid, Unpaid, Overdue
  dueDate: string;
}

export function useInvoices(status?: string) {
  return useQuery({
    queryKey: ['invoices', status],
    queryFn: async () => {
      try {
        const response = await api.get('/invoices', { params: { status } });
        return response.data.data as Invoice[];
      } catch (err: any) {
        return getMockInvoices().filter(i => {
          if (!status || status === 'All') return true;
          return i.status === status;
        });
      }
    },
  });
}

function getMockInvoices(): Invoice[] {
  return [
    { id: '1', invoiceNumber: 'INV-2026-001', customerName: 'Ravi Kumar', amount: 45000, status: 'Paid', dueDate: new Date().toISOString() },
    { id: '2', invoiceNumber: 'INV-2026-002', customerName: 'Sunita Sharma', amount: 12500, status: 'Unpaid', dueDate: new Date(Date.now() + 86400000 * 5).toISOString() },
    { id: '3', invoiceNumber: 'INV-2026-003', customerName: 'Amit Singh', amount: 8000, status: 'Overdue', dueDate: new Date(Date.now() - 86400000 * 3).toISOString() },
  ];
}
