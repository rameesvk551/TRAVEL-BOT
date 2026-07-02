// FILE: mobile/src/features/payments/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface PaymentTransaction {
  id: string;
  bookingRef: string;
  customerName: string;
  amount: number;
  date: string;
  method: 'upi' | 'card' | 'cash' | 'bank_transfer';
  status: 'successful' | 'pending' | 'failed';
}

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        const response = await api.get('/payments');
        return response.data.data as PaymentTransaction[];
      } catch (err: any) {
        return getMockPayments();
      }
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      await new Promise(r => setTimeout(r, 800));
      return { id: Math.random().toString(), ...data, status: 'successful', date: new Date().toISOString() };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// Mocks
function getMockPayments(): PaymentTransaction[] {
  return [
    { id: '1', bookingRef: 'BKG-001', customerName: 'Ravi Kumar', amount: 50000, date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), method: 'upi', status: 'successful' },
    { id: '2', bookingRef: 'BKG-002', customerName: 'Sunita Sharma', amount: 45000, date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), method: 'bank_transfer', status: 'successful' },
    { id: '3', bookingRef: 'BKG-003', customerName: 'Amit Singh', amount: 7500, date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), method: 'card', status: 'failed' },
  ];
}
