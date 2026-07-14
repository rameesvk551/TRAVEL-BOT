// FILE: mobile/src/features/quotations/api.ts
// Real backend wiring — /api/quotations (backend/src/routes/quotations.ts).
//
// MONEY — READ THIS: unlike bookings and payments, quotation amounts are WHOLE RUPEES,
// not paise. backend/src/controllers/quotationController.ts stores whatever the client
// sends and the web form (frontend/src/pages/QuotationForm.jsx) sends rupees, rendering
// them with a bare toLocaleString. So to reuse the app's paise-based formatCurrency we
// scale by 100 — an exact integer multiply, never a float divide.
//
// `subTotal`/`totalAmount` are BIGINT columns, which pg/sequelize hands back as STRINGS.
// Always run them through toNumber().

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Quotation.ts
// ---------------------------------------------------------------------------

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export interface QuotationItem {
  name: string;
  description?: string;
  quantity: number;
  /** rupees */
  price: number;
  /** rupees — quantity × price */
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  /** DATEONLY, e.g. "2026-07-14" */
  date: string;
  items: QuotationItem[];
  /** rupees (BIGINT — may arrive as a string) */
  subTotal: number | string;
  /** rupees (BIGINT — may arrive as a string) */
  totalAmount: number | string;
  amountInWords?: string | null;
  status: QuotationStatus;
  createdAt: string;
  customer?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  lead?: { id: string; destination?: string | null; customer?: { id: string; name: string } | null } | null;
  template?: { id: string; name: string } | null;
}

export interface CreateQuotationInput {
  customerId?: string;
  leadId?: string;
  templateId?: string;
  date?: string;
  items: QuotationItem[];
  /** rupees */
  subTotal: number;
  totalAmount: number;
  amountInWords?: string;
  status?: QuotationStatus;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Surfaces the backend's `{ success: false, error }` message rather than a generic axios one. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return (error as any)?.response?.data?.error || (error as any)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** BIGINT columns deserialize as strings — coerce safely. */
export function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Formats a RUPEE amount with the app's paise-based formatter (exact integer scale-up). */
export function formatRupees(value: number | string | null | undefined): string {
  return formatCurrency(Math.round(toNumber(value) * 100));
}

/** The customer's name, whether attached directly or via the lead. */
export function quotationCustomerName(q: Quotation): string {
  return q.customer?.name || q.lead?.customer?.name || 'Unknown customer';
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * GET /api/quotations — returns every quotation for the agency.
 * NOTE: the controller ignores query params, so there is no server-side status filter;
 * callers filter client-side.
 */
export function useQuotations() {
  return useQuery<Quotation[]>({
    queryKey: ['quotations'],
    queryFn: async () => {
      const res = await api.get('/quotations');
      return (res.data.data ?? []) as Quotation[];
    },
  });
}

/** GET /api/quotations/:id */
export function useQuotation(id: string | null) {
  return useQuery<Quotation>({
    queryKey: ['quotations', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/quotations/${id}`);
      return res.data.data as Quotation;
    },
  });
}

/** POST /api/quotations */
export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation<Quotation, unknown, CreateQuotationInput>({
    mutationFn: async (input) => {
      const res = await api.post('/quotations', input);
      return res.data.data as Quotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

/** PUT /api/quotations/:id */
export function useUpdateQuotation() {
  const queryClient = useQueryClient();
  return useMutation<Quotation, unknown, { id: string } & Partial<CreateQuotationInput>>({
    mutationFn: async ({ id, ...input }) => {
      const res = await api.put(`/quotations/${id}`, input);
      return res.data.data as Quotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

/**
 * POST /api/quotations/:id/send-whatsapp — renders the PDF and sends it to the customer.
 * A DRAFT quotation is flipped to SENT server-side.
 */
export function useSendQuotationWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await api.post(`/quotations/${id}/send-whatsapp`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

/** GET /api/quotation-templates — the themed templates the PDF is rendered with. */
export function useQuotationTemplates() {
  return useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['quotation-templates'],
    queryFn: async () => {
      const res = await api.get('/quotation-templates');
      const payload = res.data.data;
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      return list.map((t: any) => ({ id: t.id, name: t.name }));
    },
  });
}
