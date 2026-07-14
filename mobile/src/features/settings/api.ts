// FILE: mobile/src/features/settings/api.ts
// Real agency/settings wiring. Source of truth: backend/src/routes/agencies.ts
// (GET /agencies/me, PATCH /agencies/me). Envelope is { success: true, data }.
// No mocks — errors propagate so screens render the real ErrorState.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { setObject, StorageKeys } from '../../lib/storage';

// ---------------------------------------------------------------------------
// Types — the Agency row the backend returns (razorpayKeySecret stripped)
// ---------------------------------------------------------------------------

export interface BusinessProfile {
  id: string;
  name: string;
  /** Set at signup; the update schema does not accept it, so it is read-only here. */
  email: string | null;
  phone: string | null;
  industry: string | null;
  plan: 'FREE' | 'STARTER' | 'PRO';
  whatsappNumber: string | null;
  whatsappDisplayPhoneNumber: string | null;
  whatsappConnectionStatus: string | null;
  googleReviewLink: string | null;
  companyLogoUrl: string | null;
  companySealUrl: string | null;
  authorizedSignatureUrl: string | null;
  gstin: string | null;
  upiId: string | null;
  stateCode: string | null;
  subdomain: string | null;
  customDomain: string | null;
  isActive: boolean;
}

/** Only fields the backend's updateAgencySchema actually accepts. */
export interface UpdateBusinessProfileInput {
  name?: string;
  phone?: string;
  googleReviewLink?: string;
  gstin?: string | null;
  upiId?: string | null;
  stateCode?: string | null;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: { error?: string; message?: string } } })?.response;
  if (res?.status === 403) {
    return res?.data?.error || 'You do not have permission to change these settings.';
  }
  return res?.data?.error || res?.data?.message || (err as Error)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBusinessProfile() {
  return useQuery({
    queryKey: ['agency', 'me'],
    queryFn: async (): Promise<BusinessProfile> => {
      const res = await api.get('/agencies/me');
      return res.data.data;
    },
  });
}

export function useUpdateBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBusinessProfileInput): Promise<BusinessProfile> => {
      const res = await api.patch('/agencies/me', body);
      return res.data.data;
    },
    onSuccess: (agency) => {
      // Keep the cached agency (used for branding/labels) in step with the server.
      setObject(StorageKeys.AGENCY, agency);
      queryClient.invalidateQueries({ queryKey: ['agency', 'me'] });
    },
  });
}
