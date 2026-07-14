// FILE: mobile/src/features/cruises/api.ts
// Real backend wiring. Mirrors frontend/src/api/cruisesApi.js.
// Envelope is { success: true, data }. Money fields are in PAISE.

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
// Types — mirror backend/src/models/Cruise.ts
// ---------------------------------------------------------------------------

export interface CabinType {
  name: string;
  /** paise */
  price?: number | null;
  description?: string | null;
}

export interface Cruise {
  id: string;
  agencyId: string;
  name: string;
  cruiseLine: string | null;
  departurePort: string | null;
  destinations: string[];
  duration: string | null;
  cabinTypes: CabinType[];
  inclusions: string[];
  exclusions: string[];
  /** paise */
  basePrice: number | null;
  imageUrl: string | null;
  departureDate: string | null;
  capacity: number | null;
  summary: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CruiseInput {
  name: string;
  cruiseLine?: string | null;
  departurePort?: string | null;
  destinations?: string[];
  duration?: string | null;
  cabinTypes?: CabinType[];
  inclusions?: string[];
  exclusions?: string[];
  /** paise */
  basePrice?: number | null;
  imageUrl?: string | null;
  departureDate?: string | null;
  capacity?: number | null;
  summary?: string | null;
  isActive?: boolean;
}

export type CruiseTab = 'ALL' | 'ACTIVE' | 'INACTIVE';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCruises(tab: CruiseTab = 'ALL', search?: string) {
  return useQuery({
    queryKey: ['cruises', { tab, search }],
    queryFn: async () => {
      const res = await api.get('/cruises', { params: { tab, search: search || undefined } });
      return res.data.data as Cruise[];
    },
  });
}

export function useCruise(id?: string) {
  return useQuery({
    queryKey: ['cruises', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/cruises/${id}`);
      return res.data.data as Cruise;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCruise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CruiseInput) => {
      const res = await api.post('/cruises', input);
      return res.data.data as Cruise;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cruises'] }),
  });
}

export function useUpdateCruise(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CruiseInput>) => {
      const res = await api.patch(`/cruises/${id}`, input);
      return res.data.data as Cruise;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cruises'] }),
  });
}

export function useDeactivateCruise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cruises/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cruises'] }),
  });
}

/** POST /cruises/upload-image (multipart, field name `image`) -> { url, publicId }. */
export function useUploadCruiseImage() {
  return useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'cover.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post('/cruises/upload-image', form);
      return res.data.data as { url: string; publicId: string };
    },
  });
}
