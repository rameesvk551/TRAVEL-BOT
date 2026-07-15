// FILE: mobile/src/features/services/api.ts
// Real backend wiring. Mirrors frontend/src/api/servicesApi.js.
// Envelope is { success: true, data }. Money fields are in PAISE.
//
// NOTE: `icon` is an icon IDENTIFIER (e.g. 'plane', 'shield'), not an emoji —
// see the web's ICON_MAP in frontend/src/pages/Services.jsx. The mobile list maps
// the identifier to a lucide icon, matching the design system.
// NOTE: `imageUrl` is uploaded via POST /services/upload-image (multipart, field
// name `image`) — see useUploadServiceImage below, mirroring packages/properties.

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
// Types — mirror backend/src/models/Service.ts
// ---------------------------------------------------------------------------

/** Backend zod enum — anything else is rejected with a 400. */
export const SERVICE_CATEGORIES = [
  'TICKETING',
  'DOCUMENTATION',
  'VISA',
  'INSURANCE',
  'OTHER',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const PRICING_TYPES = ['FIXED', 'STARTING_FROM', 'VARIABLE'] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

/** Icon identifier vocabulary — must match the web's ICON_MAP keys. */
export const SERVICE_ICON_KEYS = [
  'plane',
  'train',
  'document',
  'globe',
  'shield',
  'car',
  'hotel',
  'stamp',
  'file',
  'default',
] as const;
export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number];

export interface AddonService {
  id: string;
  agencyId: string;
  name: string;
  category: ServiceCategory | null;
  description: string | null;
  /** Icon identifier, not an emoji. */
  icon: string | null;
  /** paise */
  basePrice: number | null;
  imageUrl: string | null;
  pricingType: PricingType;
  features: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceInput {
  name: string;
  category?: ServiceCategory | null;
  description?: string | null;
  icon?: string | null;
  /** paise */
  basePrice?: number | null;
  imageUrl?: string | null;
  pricingType?: PricingType;
  features?: string[];
  isActive?: boolean;
}

/** Chip filters -> the `tab` param. A category name filters by category (iLike). */
export type ServiceTab = 'ALL' | 'INACTIVE' | ServiceCategory;

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  FIXED: 'Fixed',
  STARTING_FROM: 'Starting from',
  VARIABLE: 'Variable',
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useServices(tab: ServiceTab = 'ALL', search?: string) {
  return useQuery({
    queryKey: ['services', { tab, search }],
    queryFn: async () => {
      const res = await api.get('/services', { params: { tab, search: search || undefined } });
      return res.data.data as AddonService[];
    },
  });
}

export function useService(id?: string) {
  return useQuery({
    queryKey: ['services', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/services/${id}`);
      return res.data.data as AddonService;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceInput) => {
      const res = await api.post('/services', input);
      return res.data.data as AddonService;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ServiceInput>) => {
      const res = await api.patch(`/services/${id}`, input);
      return res.data.data as AddonService;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

/** POST /services/upload-image (multipart, field name `image`) -> { url, publicId }. */
export function useUploadServiceImage() {
  return useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'service.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post('/services/upload-image', form);
      return res.data.data as { url: string; publicId: string };
    },
  });
}
