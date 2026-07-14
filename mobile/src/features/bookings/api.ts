// FILE: mobile/src/features/bookings/api.ts
// Real backend wiring — GET/POST /api/bookings (backend/src/routes/bookings.ts).
//
// MONEY: every booking amount is an INTEGER NUMBER OF PAISE (see backend/src/models/Booking.ts).
// Never divide for display — hand the paise straight to formatCurrency().
//
// SETTLEMENT: a booking is either
//   FULL_COLLECTION — the agency collects `totalAmount`.
//   COMMISSION_ONLY — the agency books only its own commission; the customer pays the rest
//                     directly at the property. That remainder (`balanceAtProperty`) is a memo
//                     printed on the invoice and is NEVER owed to the agency, so `balanceDue`
//                     is settlement-aware and must be used instead of (total - advance).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Booking.ts
// ---------------------------------------------------------------------------

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type BookingItemType = 'PACKAGE' | 'PROPERTY' | 'CRUISE' | 'VISA' | 'SERVICE' | 'CUSTOM';
export type SettlementType = 'FULL_COLLECTION' | 'COMMISSION_ONLY';
export type PaymentMode = 'FULL' | 'ADVANCE' | 'NO_PAYMENT';

/** Derived in the client from the settlement-aware balance — the API has no such column. */
export type BookingPaymentStatus = 'PAID' | 'PARTIAL' | 'DUE';

export interface BookingCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface BookingPayment {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'REFUNDED';
  type: 'ADVANCE' | 'BALANCE' | 'FULL';
  paidAt?: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  status: BookingStatus;
  itemType: BookingItemType;
  settlementType: SettlementType;
  paymentMode: PaymentMode;

  /** paise */
  totalAmount: number;
  /** paise, per-traveller/item */
  basePrice?: number | null;
  /** paise, what the agency has actually collected */
  advancePaid: number;
  /** paise, the agency's revenue on a COMMISSION_ONLY booking. null otherwise. */
  commissionAmount?: number | null;
  /** paise, VIRTUAL — settlement-aware amount still owed TO THE AGENCY. */
  balanceDue?: number;
  /** paise, VIRTUAL — off-ledger amount the customer pays at the property. 0 unless COMMISSION_ONLY. */
  balanceAtProperty?: number;

  travelDate?: string | null;
  returnDate?: string | null;
  travellers?: number | null;
  notes?: string | null;
  createdAt: string;

  customer?: BookingCustomer | null;
  package?: { id: string; name: string; duration?: string | null } | null;
  property?: { id: string; name: string; propertyType?: string | null; location?: string | null } | null;
  cruise?: { id: string; name: string } | null;
  visa?: { id: string; country: string; visaType?: string | null } | null;
  service?: { id: string; name: string; category?: string | null } | null;
  customItemName?: string | null;
  payments?: BookingPayment[];
}

export interface BookingStats {
  totalBookings: number;
  /** paise — settlement-aware (commission counts, not the package face value) */
  totalRevenue: number;
  totalAdvancePaid: number;
  totalBalanceDue: number;
}

export interface BookingListResult {
  bookings: Booking[];
  total: number;
  stats: BookingStats;
}

export interface CreateBookingInput {
  customerId?: string;
  newCustomer?: { name: string; phone: string; email?: string };
  itemType: BookingItemType;
  packageId?: string;
  propertyId?: string;
  cruiseId?: string;
  visaId?: string;
  serviceId?: string;
  customItemName?: string;
  paymentMode: PaymentMode;
  settlementType: SettlementType;
  /** paise */
  basePrice?: number;
  totalAmount: number;
  advanceAmount?: number;
  commissionAmount?: number;
  travelDate?: string;
  travellers?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Surfaces the backend's `{ success: false, error }` message rather than a generic axios one. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return (error as any)?.response?.data?.error || (error as any)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Settlement-aware money helpers
// ---------------------------------------------------------------------------

/** Amount still owed TO THE AGENCY, in paise. Zero on a settled commission-only booking. */
export function bookingBalanceDue(b: Booking): number {
  if (b.balanceDue != null) return b.balanceDue;
  // Fallback mirrors the model's VIRTUAL getter when the server omits it.
  if (b.settlementType === 'COMMISSION_ONLY') {
    const commission = b.commissionAmount ?? b.advancePaid ?? 0;
    return Math.max(0, commission - (b.advancePaid || 0));
  }
  return Math.max(0, (b.totalAmount || 0) - (b.advancePaid || 0));
}

/** Off-ledger amount the customer still pays at the property, in paise. */
export function bookingBalanceAtProperty(b: Booking): number {
  if (b.balanceAtProperty != null) return b.balanceAtProperty;
  if (b.settlementType !== 'COMMISSION_ONLY') return 0;
  return Math.max(0, (b.totalAmount || 0) - (b.advancePaid || 0));
}

/** What the agency actually earns, in paise: commission on COMMISSION_ONLY, else the full sell price. */
export function bookingAgencyRevenue(b: Booking): number {
  if (b.settlementType === 'COMMISSION_ONLY') {
    return b.commissionAmount ?? b.advancePaid ?? 0;
  }
  return b.totalAmount || 0;
}

export function isCommissionOnly(b: Booking): boolean {
  return b.settlementType === 'COMMISSION_ONLY';
}

export function bookingPaymentStatus(b: Booking): BookingPaymentStatus {
  if (bookingBalanceDue(b) <= 0) return 'PAID';
  return (b.advancePaid || 0) > 0 ? 'PARTIAL' : 'DUE';
}

/** The booked item's display name, whichever catalog association is populated. */
export function bookingItemName(b: Booking): string {
  return (
    b.package?.name ||
    b.property?.name ||
    b.cruise?.name ||
    b.service?.name ||
    (b.visa ? `${b.visa.country} ${b.visa.visaType || 'Visa'}`.trim() : '') ||
    b.customItemName ||
    '—'
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * GET /api/bookings — the controller wraps the service result, so the array sits at
 * `data.data.data` with `stats` alongside it.
 */
export function useBookings(status?: BookingStatus) {
  return useQuery<BookingListResult>({
    queryKey: ['bookings', { status: status ?? 'ALL' }],
    queryFn: async () => {
      const res = await api.get('/bookings', {
        params: { status, pageSize: 100 },
      });
      const payload = res.data.data;
      return {
        bookings: (payload?.data ?? []) as Booking[],
        total: payload?.total ?? 0,
        stats: payload?.stats ?? {
          totalBookings: 0,
          totalRevenue: 0,
          totalAdvancePaid: 0,
          totalBalanceDue: 0,
        },
      };
    },
  });
}

/** GET /api/bookings/:id — full booking incl. customer, catalog item and payments. */
export function useBooking(id: string | null) {
  return useQuery<Booking>({
    queryKey: ['bookings', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/bookings/${id}`);
      return res.data.data as Booking;
    },
  });
}

/** POST /api/bookings */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation<Booking, unknown, CreateBookingInput>({
    mutationFn: async (input) => {
      const res = await api.post('/bookings', input);
      return res.data.data as Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Pickers — catalog + customer lookups the booking form needs
// ---------------------------------------------------------------------------

/** List endpoints differ in whether they paginate, so unwrap defensively (as the web does). */
function unwrapList<T>(payload: any): T[] {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export interface PickerOption {
  id: string;
  name: string;
  /** paise — the catalog price, used to prefill the booking's base price. */
  price?: number;
}

/** GET /api/customers */
export function useCustomerOptions() {
  return useQuery<PickerOption[]>({
    queryKey: ['customers', 'options'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return unwrapList<any>(res.data).map((c) => ({ id: c.id, name: c.name }));
    },
  });
}

const CATALOG_ENDPOINT: Record<Exclude<BookingItemType, 'CUSTOM'>, string> = {
  PACKAGE: '/packages',
  PROPERTY: '/properties',
  CRUISE: '/cruises',
  VISA: '/visas',
  SERVICE: '/services',
};

/** Catalog items for the chosen item type. Disabled for CUSTOM (the name is typed by hand). */
export function useCatalogOptions(itemType: BookingItemType) {
  return useQuery<PickerOption[]>({
    queryKey: ['catalog', itemType],
    enabled: itemType !== 'CUSTOM',
    queryFn: async () => {
      const endpoint = CATALOG_ENDPOINT[itemType as Exclude<BookingItemType, 'CUSTOM'>];
      const res = await api.get(endpoint);
      return unwrapList<any>(res.data).map((item) => ({
        id: item.id,
        name:
          item.name ||
          (item.country ? `${item.country} ${item.visaType || 'Visa'}`.trim() : '') ||
          'Untitled',
        price: item.basePrice ?? item.price ?? item.pricePerNight ?? item.fee ?? undefined,
      }));
    },
  });
}
