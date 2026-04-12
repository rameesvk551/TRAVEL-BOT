// FILE: /frontend/src/hooks/useBookings.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '../api/bookingsApi';

export function useBookings(params = {}) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => bookingsApi.list(params),
  });
}

export function useBooking(id) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => bookingsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useBookingTimeline(id) {
  return useQuery({
    queryKey: ['booking-timeline', id],
    queryFn: () => bookingsApi.getTimeline(id),
    enabled: !!id,
  });
}
