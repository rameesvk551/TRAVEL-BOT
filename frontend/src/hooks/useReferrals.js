// FILE: /frontend/src/hooks/useReferrals.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsApi } from '../api/referralsApi';

export function useReferrals() {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: () => referralsApi.list(),
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: ['referralStats'],
    queryFn: () => referralsApi.stats(),
  });
}

export function useCreateReferralCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => referralsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      qc.invalidateQueries({ queryKey: ['referralStats'] });
    },
  });
}

export function useToggleReferralCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => referralsApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referrals'] }),
  });
}
