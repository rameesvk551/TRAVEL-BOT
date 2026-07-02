// FILE: mobile/src/features/bookings/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Booking {
  id: string;
  ref: string;
  customerName: string;
  avatarUrl?: string;
  type: 'package' | 'property' | 'cruise' | 'visa' | 'service';
  itemName: string;
  travelDate: string;
  amount: number;
  paymentStatus: 'paid' | 'partial' | 'due';
  status: 'confirmed' | 'pending' | 'cancelled';
}

export function useBookings(filter?: string) {
  return useQuery({
    queryKey: ['bookings', filter],
    queryFn: async () => {
      try {
        const response = await api.get('/bookings', { params: { filter } });
        return response.data.data as Booking[];
      } catch (err: any) {
        return getMockBookings();
      }
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/bookings/${id}`);
        return response.data.data as Booking;
      } catch (err: any) {
        return getMockBookings().find(b => b.id === id);
      }
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      await new Promise(r => setTimeout(r, 800));
      return { id: Math.random().toString(), ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// Mocks
function getMockBookings(): Booking[] {
  return [
    { id: '1', ref: 'BKG-001', customerName: 'Ravi Kumar', type: 'package', itemName: 'Bali Escape 5N/6D', travelDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(), amount: 150000, paymentStatus: 'partial', status: 'confirmed' },
    { id: '2', ref: 'BKG-002', customerName: 'Sunita Sharma', type: 'property', itemName: 'Goa Beach Resort', travelDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), amount: 45000, paymentStatus: 'paid', status: 'confirmed' },
    { id: '3', ref: 'BKG-003', customerName: 'Amit Singh', type: 'visa', itemName: 'Dubai Tourist Visa', travelDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(), amount: 7500, paymentStatus: 'due', status: 'pending' },
  ];
}
