// FILE: mobile/src/features/customers/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  totalBilled: number;
  balanceDue: number;
  createdAt: string;
}

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      try {
        const response = await api.get('/customers', { params: { search } });
        return response.data.data as Customer[];
      } catch (err: any) {
        return getMockCustomers();
      }
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/customers/${id}`);
        return response.data.data as Customer;
      } catch (err: any) {
        return getMockCustomers().find(c => c.id === id);
      }
    },
  });
}

function getMockCustomers(): Customer[] {
  return [
    { id: '1', name: 'Ravi Kumar', phone: '+91 9876543210', email: 'ravi@example.com', totalBilled: 150000, balanceDue: 0, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
    { id: '2', name: 'Sunita Sharma', phone: '+91 9876543211', email: 'sunita@example.com', totalBilled: 85000, balanceDue: 15000, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() },
    { id: '3', name: 'Amit Singh', phone: '+91 9876543212', email: 'amit@example.com', totalBilled: 12000, balanceDue: 12000, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString() },
  ];
}
