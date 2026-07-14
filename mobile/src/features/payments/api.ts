// FILE: mobile/src/features/payments/api.ts
// Real backend wiring — /api/payments (backend/src/routes/payments.ts).
//
// MONEY: `amount` is an INTEGER NUMBER OF PAISE. Pass it straight to formatCurrency().
//
// IMPORTANT — there is NO "record a manual payment" endpoint.
// A Payment row is only ever created by POST /payments/request, which asks the backend to
// mint a Razorpay payment link and WhatsApp it to the customer; the row then flips to PAID
// via the Razorpay webhook. The backend derives the amount itself (booking.totalAmount -
// booking.advancePaid) and accepts NOTHING but a bookingId — no amount, no method, no
// reference. Cash/UPI-in-hand cannot be recorded from the app today.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Payment.ts
// ---------------------------------------------------------------------------

export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'REFUNDED';
export type PaymentType = 'ADVANCE' | 'BALANCE' | 'FULL';

export interface Payment {
  id: string;
  bookingId: string;
  /** paise */
  amount: number;
  status: PaymentStatus;
  type: PaymentType;
  paymentLinkUrl?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  booking?: {
    id: string;
    bookingRef: string;
    totalAmount: number;
    advancePaid: number;
    customer?: { id: string; name: string; phone?: string | null } | null;
  } | null;
}

export interface PaymentListResult {
  payments: Payment[];
  total: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Surfaces the backend's `{ success: false, error }` message rather than a generic axios one. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return (error as any)?.response?.data?.error || (error as any)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * GET /api/payments — the controller spreads the service result, so the rows sit at
 * `data.data` with `total` as a sibling. `status` is filtered server-side.
 */
export function usePayments(status?: PaymentStatus) {
  return useQuery<PaymentListResult>({
    queryKey: ['payments', { status: status ?? 'ALL' }],
    queryFn: async () => {
      const res = await api.get('/payments', { params: { status, pageSize: 100 } });
      return {
        payments: (res.data.data ?? []) as Payment[],
        total: res.data.total ?? 0,
      };
    },
  });
}

/**
 * POST /api/payments/request — mints a Razorpay payment link for the booking's outstanding
 * balance and sends it to the customer. Fails with a server message when the agency has no
 * Razorpay keys, when the booking status forbids it, or when nothing is due.
 */
export function useRequestPaymentLink() {
  const queryClient = useQueryClient();
  return useMutation<Payment, unknown, { bookingId: string }>({
    mutationFn: async ({ bookingId }) => {
      const res = await api.post('/payments/request', { bookingId });
      return res.data.data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

/** POST /api/payments/:id/receipt/send-whatsapp — sends the receipt PDF to the customer. */
export function useSendReceipt() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, { paymentId: string }>({
    mutationFn: async ({ paymentId }) => {
      const res = await api.post(`/payments/${paymentId}/receipt/send-whatsapp`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
