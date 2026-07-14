// FILE: mobile/src/features/referrals/api.ts
// Backed by /api/referrals (backend/src/routes/referrals.ts → ReferralCode).
//
// IMPORTANT SHAPE CORRECTION: the backend does NOT store referrer→referred pairs.
// It stores REFERRAL CODES owned by a customer (the referrer). Redemptions are
// counted (usedCount / maxUses), not itemised, so there is no "referred person"
// and no per-referral Pending/Converted status. A code is simply active or not.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface ReferralCustomer {
  name?: string;
  phone?: string;
}

/** Mirrors backend/src/models/ReferralCode.ts. */
export interface ReferralCode {
  id: string;
  customerId: string;
  /** e.g. "RAHUL2026". */
  code: string;
  discountType: 'FLAT' | 'PERCENT';
  /** FLAT → paise. PERCENT → 1-100. */
  discountValue: number;
  maxUses: number;
  usedCount: number;
  /** Paise. */
  revenueGenerated: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** The referrer. */
  customer?: ReferralCustomer | null;
}

export interface ReferralStats {
  totalCodes: number;
  activeCodes: number;
  totalUses: number;
  /** Paise. */
  totalRevenue: number;
  topReferrers: ReferralCode[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReferrals() {
  return useQuery({
    queryKey: ['referrals', 'list'],
    queryFn: async (): Promise<ReferralCode[]> => {
      const res = await api.get('/referrals');
      return (res.data.data ?? []) as ReferralCode[];
    },
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: ['referrals', 'stats'],
    queryFn: async (): Promise<ReferralStats> => {
      const res = await api.get('/referrals/stats');
      return res.data.data as ReferralStats;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /referrals/:id/toggle — flips isActive. */
export function useToggleReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<ReferralCode> => {
      const res = await api.post(`/referrals/${id}/toggle`);
      return res.data.data as ReferralCode;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FLAT discounts are paise; PERCENT discounts are a plain 1-100 number. */
export function formatReward(code: ReferralCode): string {
  if (code.discountType === 'PERCENT') return `${code.discountValue}% off`;
  return `₹${(code.discountValue / 100).toLocaleString('en-IN')} off`;
}
