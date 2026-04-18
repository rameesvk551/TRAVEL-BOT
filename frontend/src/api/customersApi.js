import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

export const customersApi = {
  list: (params) => client.get('/customers', { params }).then((r) => r.data),
  create: (data) => client.post('/customers', data).then((r) => r.data),
};

export function useCustomers(filters = {}) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customersApi.list(filters),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
