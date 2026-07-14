// FILE: mobile/src/features/itineraries/api.ts
// Real backend wiring. Mirrors frontend/src/api/itinerariesApi.js.
// Envelope is { success: true, data }.
//
// MONEY IS MIXED HERE — read carefully:
//   • itinerary.totalPrice / totalCost / totalProfit are in PAISE (columns).
//   • itinerary.pricing.* and priceRooms[].amount are in RUPEES (JSONB blobs).
//   The backend recomputes totalPrice from pricing.grossTotal (rupees × 100) on
//   every write — see itineraryService.resolveTotalPrice().
//
// GET /itineraries takes NO filters (listItineraries only receives agencyId), so
// status filtering is done client-side.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Money + error helpers
// ---------------------------------------------------------------------------

export function paiseToRupees(paise?: number | null): number {
  return Math.round((paise ?? 0) / 100);
}

export function rupeesToNumber(rupees: string | number | null | undefined): number {
  if (rupees === '' || rupees === null || rupees === undefined) return 0;
  const n = typeof rupees === 'number' ? rupees : Number(String(rupees).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
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

/**
 * Gross margin %. totalProfit is a VIRTUAL column = totalPrice - totalCost.
 * totalCost is only populated by the desktop cost editor, so this is often 0.
 */
export function marginPercent(it: Pick<Itinerary, 'totalPrice' | 'totalCost'>): number {
  const price = it.totalPrice ?? 0;
  if (price <= 0) return 0;
  const profit = price - (it.totalCost ?? 0);
  return Math.round((profit / price) * 100);
}

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Itinerary.ts
// ---------------------------------------------------------------------------

export type ItineraryStatus = 'DRAFT' | 'SENT' | 'CONFIRMED';

export const ITINERARY_STATUSES: ItineraryStatus[] = ['DRAFT', 'SENT', 'CONFIRMED'];

export const STATUS_LABELS: Record<ItineraryStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  CONFIRMED: 'Confirmed',
};

export interface ItineraryDay {
  id?: string;
  title: string;
  description?: string;
  date?: string | null;
}

export interface ItineraryHotel {
  name: string;
  category?: string;
  city?: string;
  nights?: number;
  roomType?: string;
  mealPlan?: string;
  imageUrl?: string;
}

export interface ItineraryVehicle {
  type?: string;
  features?: string[];
}

/** Price breakup row — amounts here are RUPEES, not paise. */
export interface PriceRoom {
  label: string;
  rate?: number;
  pax?: number;
  amount?: number;
}

/** All figures in RUPEES. */
export interface ItineraryPricing {
  currency?: string;
  packageTotal?: number;
  gstPercent?: number;
  gstAmount?: number;
  grossTotal?: number;
}

export interface ItineraryCustomer {
  id: string;
  name: string | null;
  phone: string | null;
}

export interface Itinerary {
  id: string;
  agencyId: string;
  customerId: string | null;
  packageId: string | null;
  leadId: string | null;
  templateId: string | null;
  name: string;
  destination: string | null;
  productCode: string | null;
  summary: string | null;
  status: ItineraryStatus;
  adults: number;
  children: number;
  travelStartDate: string | null;
  travelEndDate: string | null;
  /** paise */
  totalCost: number;
  /** paise */
  totalPrice: number;
  /** paise (virtual: totalPrice - totalCost) */
  totalProfit: number;
  days: ItineraryDay[];
  hotels: ItineraryHotel[];
  vehicle: ItineraryVehicle;
  priceRooms: PriceRoom[];
  pricing: ItineraryPricing;
  inclusions: string[];
  exclusions: string[];
  pdfUrl: string | null;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  /** Included by itineraryRepository. */
  customer?: ItineraryCustomer | null;
}

/**
 * Only these keys survive validateBody(itinerarySchema) — anything else is
 * silently stripped. NOTE: `totalCost` is NOT in the schema, so cost/margin
 * cannot be set from the mobile app.
 */
export interface ItineraryInput {
  name: string;
  customerId?: string | null;
  packageId?: string | null;
  leadId?: string | null;
  templateId?: string | null;
  destination?: string | null;
  productCode?: string | null;
  summary?: string | null;
  status?: ItineraryStatus;
  adults?: number;
  children?: number;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  days?: ItineraryDay[];
  hotels?: ItineraryHotel[];
  vehicle?: ItineraryVehicle;
  priceRooms?: PriceRoom[];
  pricing?: ItineraryPricing;
  inclusions?: string[];
  exclusions?: string[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** `status` is applied client-side: the list route accepts no query params. */
export function useItineraries(status?: ItineraryStatus | 'ALL') {
  return useQuery({
    queryKey: ['itineraries'],
    queryFn: async () => {
      const res = await api.get('/itineraries');
      return res.data.data as Itinerary[];
    },
    select: (rows: Itinerary[]) =>
      !status || status === 'ALL' ? rows : rows.filter((row) => row.status === status),
  });
}

export function useItinerary(id?: string) {
  return useQuery({
    queryKey: ['itineraries', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/itineraries/${id}`);
      return res.data.data as Itinerary;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateItinerary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ItineraryInput) => {
      const res = await api.post('/itineraries', input);
      return res.data.data as Itinerary;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });
}

export function useUpdateItinerary(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ItineraryInput>) => {
      const res = await api.patch(`/itineraries/${id}`, input);
      return res.data.data as Itinerary;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });
}

export function useDeleteItinerary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/itineraries/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });
}

/** POST /itineraries/:id/send-whatsapp — renders the themed PDF and sends it. */
export function useSendItineraryWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/itineraries/${id}/send-whatsapp`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });
}

// ---------------------------------------------------------------------------
// Customers — the builder needs to attach one. GET /customers -> { success, data }.
// ---------------------------------------------------------------------------

export interface CustomerOption {
  id: string;
  name: string | null;
  phone: string | null;
}

export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: ['customers', { search }],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { search: search || undefined } });
      return res.data.data as CustomerOption[];
    },
  });
}
