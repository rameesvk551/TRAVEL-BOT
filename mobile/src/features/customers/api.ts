// FILE: mobile/src/features/customers/api.ts
// Real endpoints only — no mock fallbacks. Errors reach react-query so screens
// can render ErrorState instead of inventing customers.
//
// Backend envelope: { success: true, data: <payload> }.
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { TimelineEvent } from '../leads/api';

/* ------------------------------------------------------------------ types -- */

export interface CustomerBooking {
  id: string;
  bookingRef: string | null;
  itemType: 'PACKAGE' | 'PROPERTY' | 'CRUISE' | 'VISA' | 'SERVICE' | 'CUSTOM';
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  /** All money is paise. */
  totalAmount: number | null;
  advancePaid: number | null;
  /** Settlement-aware virtual: COMMISSION_ONLY owes only the commission. */
  balanceDue?: number | null;
  travelDate: string | null;
  createdAt: string;
  customItemName: string | null;
  package?: { id: string; name: string } | null;
  property?: { id: string; name: string; propertyType?: string; location?: string } | null;
  service?: { id: string; name: string } | null;
  cruise?: { id: string; name: string } | null;
  visa?: { id: string; country: string } | null;
}

export interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  isCustomer: boolean;
  /** Uploaded document URLs. */
  documents: string[] | null;
  createdAt: string;
  updatedAt: string;
  /** GET /customers embeds every booking; the financials are derived from these. */
  bookings?: CustomerBooking[];
}

export interface CustomerMessage {
  id: string;
  customerId: string;
  direction: 'inbound' | 'outbound';
  content: string | null;
  type: string;
  status: string | null;
  timestamp: string;
}

export interface CustomerActivity {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'source' | 'createdAt'>;
  enquiries: { id: string; label: string; status: string | null; createdAt: string }[];
  timeline: TimelineEvent[];
}

export interface LedgerRow {
  id: string;
  date: string;
  referenceNumber: string | null;
  type: string | null;
  description: string | null;
  /** Paise. */
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface PartyStatement {
  data: LedgerRow[];
  summary: { debit: number; credit: number; balance: number };
}

/* ---------------------------------------------------------------- helpers -- */

export interface CustomerStats {
  totalBilled: number;
  balanceDue: number;
}

/**
 * The API stores no lifetime totals on a customer — the web derives them from the
 * embedded bookings, and so do we (frontend/src/pages/Customers.jsx).
 */
export function customerStats(customer: Pick<Customer, 'bookings'> | undefined | null): CustomerStats {
  const bookings = customer?.bookings ?? [];
  return bookings.reduce<CustomerStats>(
    (acc, booking) => {
      const total = booking.totalAmount ?? 0;
      const advance = booking.advancePaid ?? 0;
      acc.totalBilled += total;
      // Prefer the settlement-aware virtual; fall back to the legacy maths.
      acc.balanceDue += Math.max(0, booking.balanceDue ?? total - advance);
      return acc;
    },
    { totalBilled: 0, balanceDue: 0 },
  );
}

export function bookingItemName(booking: CustomerBooking): string {
  return (
    booking.customItemName ||
    booking.package?.name ||
    booking.property?.name ||
    booking.cruise?.name ||
    booking.service?.name ||
    booking.visa?.country ||
    booking.itemType
  );
}

/* ---------------------------------------------------------------- queries -- */

/**
 * GET /customers returns every customer with their bookings. It accepts no query
 * params — no server-side search or pagination — so callers filter client-side.
 */
export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async (): Promise<Customer[]> => {
      const res = await api.get('/customers');
      return res.data.data;
    },
  });
}

/**
 * There is no GET /customers/:id on the backend. The list is the only source of a
 * customer record, so the detail screen selects out of it rather than calling a
 * route that does not exist.
 */
export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ['customers'],
    enabled: !!id,
    queryFn: async (): Promise<Customer[]> => {
      const res = await api.get('/customers');
      return res.data.data;
    },
    select: (customers: Customer[]) => customers.find((c) => c.id === id),
  });
}

/**
 * Unified lead/enquiry/call/payment history for a customer.
 * `enabled` lets the detail screen defer the call until its tab is opened.
 */
export function useCustomerActivity(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['customers', id, 'activity'],
    enabled: !!id && enabled,
    queryFn: async (): Promise<CustomerActivity> => {
      const res = await api.get(`/customers/${id}/activity`);
      return res.data.data;
    },
  });
}

/** WhatsApp history. Requires the messages permission — a 403 surfaces as isError. */
export function useCustomerMessages(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['customers', id, 'messages'],
    enabled: !!id && enabled,
    queryFn: async (): Promise<CustomerMessage[]> => {
      const res = await api.get('/messages', { params: { customerId: id, limit: 30 } });
      return res.data.data;
    },
  });
}

/** Accounting ledger. Requires the accounts-reports permission. */
export function useCustomerLedger(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['customers', id, 'ledger'],
    enabled: !!id && enabled,
    queryFn: async (): Promise<PartyStatement> => {
      const res = await api.get('/accounts/reports/party-statement', {
        params: { partyType: 'CUSTOMER', partyId: id },
      });
      return res.data.data;
    },
  });
}
