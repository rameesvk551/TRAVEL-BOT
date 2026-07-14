// FILE: mobile/src/features/properties/api.ts
// Real backend wiring. Mirrors frontend/src/api/propertiesApi.js.
// GOTCHA: propertyController responds with { status: 'success', data } — NOT the
// { success: true, data } envelope the other catalog routes use. `data` is in the
// same place, so response.data.data still works, but don't test on `success`.
// Money fields are in PAISE.

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
// Types — mirror backend/src/models/Property.ts
// ---------------------------------------------------------------------------

export interface Property {
  id: string;
  agencyId: string;
  name: string;
  /** Hotel | Resort | Villa | Apartment | … (agency-defined, free text). */
  propertyType: string;
  location: string | null;
  address: string | null;
  amenities: string[];
  description: string | null;
  /** paise */
  pricePerNight: number | null;
  imageUrl: string | null;
  images: string[];
  brochureUrl: string | null;
  brochureFileName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyInput {
  name: string;
  propertyType: string;
  location?: string | null;
  address?: string | null;
  amenities?: string[];
  description?: string | null;
  /** paise */
  pricePerNight?: number | null;
  imageUrl?: string | null;
  images?: string[];
  isActive?: boolean;
}

export const PROPERTY_TYPES = ['Hotel', 'Resort', 'Villa', 'Apartment'] as const;

/**
 * Backend listProperties() understands tab=ALL|INACTIVE and active=true.
 * (It also has FOR_SALE/FOR_RENT branches, but FOR_RENT is `where.id = null`,
 * i.e. it can never match — properties are stays, not sale/rent listings.)
 */
export type PropertyTab = 'ALL' | 'ACTIVE' | 'INACTIVE';

function tabParams(tab: PropertyTab) {
  if (tab === 'ACTIVE') return { active: 'true' };
  if (tab === 'INACTIVE') return { tab: 'INACTIVE' };
  return {};
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useProperties(tab: PropertyTab = 'ALL', search?: string) {
  return useQuery({
    queryKey: ['properties', { tab, search }],
    queryFn: async () => {
      const res = await api.get('/properties', {
        params: { ...tabParams(tab), search: search || undefined },
      });
      return res.data.data as Property[];
    },
  });
}

export function useProperty(id?: string) {
  return useQuery({
    queryKey: ['properties', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/properties/${id}`);
      return res.data.data as Property;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PropertyInput) => {
      const res = await api.post('/properties', input);
      return res.data.data as Property;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PropertyInput>) => {
      const res = await api.patch(`/properties/${id}`, input);
      return res.data.data as Property;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/properties/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

/** POST /properties/upload-image (multipart, field name `image`) -> { url, publicId }. */
export function useUploadPropertyImage() {
  return useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'cover.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post('/properties/upload-image', form);
      return res.data.data as { url: string; publicId: string };
    },
  });
}
