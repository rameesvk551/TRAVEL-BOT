// FILE: mobile/src/features/visas/api.ts
// Real backend wiring. Mirrors frontend/src/api/visasApi.js.
// Envelope is { success: true, data }. Money fields are in PAISE.
//
// NOTE: the old mock had a `flag` emoji field. The Visa model has no such column
// and there is no ISO country code to derive one from, so the list renders the
// uploaded `imageUrl` (or a fallback icon) instead of a fabricated flag.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Money + error helpers
// ---------------------------------------------------------------------------

export function paiseToRupees(paise?: number | null): number {
  return Math.round((paise ?? 0) / 100);
}

export function rupeesToPaise(rupees: string | number | null | undefined): number | null {
  if (rupees === '' || rupees === null || rupees === undefined) return null;
  const n = typeof rupees === 'number' ? rupees : Number(String(rupees).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatPaise(paise?: number | null): string {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN')}`;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  const body = axiosErr?.response?.data;
  if (body?.details?.length) {
    return body.details.map((d) => `${d.field}: ${d.message}`).join('\n');
  }
  return body?.error || body?.message || axiosErr?.message || fallback;
}

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Visa.ts
// ---------------------------------------------------------------------------

export interface Visa {
  id: string;
  agencyId: string;
  country: string;
  visaType: string | null;
  /** paise */
  price: number | null;
  processingTime: string | null;
  validityPeriod: string | null;
  requiredDocuments: string[];
  description: string | null;
  imageUrl: string | null;
  eligibilityNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisaInput {
  country: string;
  visaType?: string | null;
  /** paise */
  price?: number | null;
  processingTime?: string | null;
  validityPeriod?: string | null;
  requiredDocuments?: string[];
  description?: string | null;
  imageUrl?: string | null;
  eligibilityNotes?: string | null;
  isActive?: boolean;
}

export type VisaTab = 'ALL' | 'ACTIVE' | 'INACTIVE';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVisas(tab: VisaTab = 'ALL', search?: string) {
  return useQuery({
    queryKey: ['visas', { tab, search }],
    queryFn: async () => {
      const res = await api.get('/visas', { params: { tab, search: search || undefined } });
      return res.data.data as Visa[];
    },
  });
}

export function useVisa(id?: string) {
  return useQuery({
    queryKey: ['visas', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/visas/${id}`);
      return res.data.data as Visa;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVisa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VisaInput) => {
      const res = await api.post('/visas', input);
      return res.data.data as Visa;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visas'] }),
  });
}

export function useUpdateVisa(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<VisaInput>) => {
      const res = await api.patch(`/visas/${id}`, input);
      return res.data.data as Visa;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visas'] }),
  });
}

export function useDeactivateVisa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/visas/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visas'] }),
  });
}

/** POST /visas/upload-image (multipart, field name `image`) -> { url, publicId }. */
export function useUploadVisaImage() {
  return useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'visa.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post('/visas/upload-image', form);
      return res.data.data as { url: string; publicId: string };
    },
  });
}
