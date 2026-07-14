// FILE: mobile/src/features/packages/api.ts
// Real backend wiring. Endpoints mirror frontend/src/api/packagesApi.js +
// itemFinanceApi.js. Envelope is { success: true, data }.
// NOTE: every money field on the wire is in PAISE (₹1 = 100 paise).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Money + error helpers
// ---------------------------------------------------------------------------

/** Wire (paise) -> display (rupees). */
export function paiseToRupees(paise?: number | null): number {
  return Math.round((paise ?? 0) / 100);
}

/** Form input (rupee string) -> wire (paise). Returns null for empty input. */
export function rupeesToPaise(rupees: string | number | null | undefined): number | null {
  if (rupees === '' || rupees === null || rupees === undefined) return null;
  const n = typeof rupees === 'number' ? rupees : Number(String(rupees).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Formats paise as ₹1,23,456 for display. */
export function formatPaise(paise?: number | null): string {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN')}`;
}

/** Compact money for KPI tiles: ₹1.5L / ₹80K. */
export function formatPaiseCompact(paise?: number | null): string {
  const rupees = paiseToRupees(paise);
  if (Math.abs(rupees) >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (Math.abs(rupees) >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (Math.abs(rupees) >= 1000) return `₹${Math.round(rupees / 1000)}K`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

/** Pulls the server's message out of an axios error so failures are never silent. */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  const body = axiosErr?.response?.data;
  if (body?.details?.length) {
    return body.details.map((d) => `${d.field}: ${d.message}`).join('\n');
  }
  return body?.error || body?.message || axiosErr?.message || fallback;
}

// ---------------------------------------------------------------------------
// Types — mirror backend/src/models/Package.ts
// ---------------------------------------------------------------------------

export interface PackageItineraryDay {
  day: number;
  title: string;
  description?: string;
  activities?: string[];
}

export interface Package {
  id: string;
  agencyId: string;
  name: string;
  category: string | null;
  tourType: string | null;
  duration: string | null;
  destinations: string[];
  inclusions: string[];
  exclusions: string[];
  /** paise */
  basePrice: number | null;
  imageUrl: string | null;
  summary: string | null;
  brochureUrl: string | null;
  brochureFileName: string | null;
  itinerary: PackageItineraryDay[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackageInput {
  name: string;
  category?: string | null;
  tourType?: string | null;
  duration?: string | null;
  destinations?: string[];
  inclusions?: string[];
  exclusions?: string[];
  /** paise */
  basePrice?: number | null;
  imageUrl?: string | null;
  summary?: string | null;
  isActive?: boolean;
}

/** Segmented tabs -> the `tab` query param the backend's listPackages() understands. */
export type PackageTab = 'ALL' | 'DOMESTIC' | 'INTERNATIONAL' | 'INACTIVE';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePackages(tab: PackageTab = 'ALL', search?: string) {
  return useQuery({
    queryKey: ['packages', { tab, search }],
    queryFn: async () => {
      const res = await api.get('/packages', { params: { tab, search: search || undefined } });
      return res.data.data as Package[];
    },
  });
}

export function usePackage(id?: string) {
  return useQuery({
    queryKey: ['packages', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/packages/${id}`);
      return res.data.data as Package;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PackageInput) => {
      const res = await api.post('/packages', input);
      return res.data.data as Package;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useUpdatePackage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PackageInput>) => {
      const res = await api.patch(`/packages/${id}`, input);
      return res.data.data as Package;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useDeactivatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/packages/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

/** POST /packages/upload-image (multipart, field name `image`) -> { url, publicId }. */
export function useUploadPackageImage() {
  return useMutation({
    mutationFn: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'cover.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob);
      const res = await api.post('/packages/upload-image', form);
      return res.data.data as { url: string; publicId: string };
    },
  });
}

// ---------------------------------------------------------------------------
// Item finance — GET /item-finance/PACKAGE/:id (the generic per-item ledger).
// The legacy /packages/:id/finance returns the same report; item-finance is the
// route the web finance page uses and the only one that generalizes to
// properties/cruises/visas/services.
// ---------------------------------------------------------------------------

export interface FinanceReceivable {
  bookingId: string;
  bookingRef: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  /** paise */
  itemAmount: number;
  paid: number;
  balance: number;
  status: string;
  travellers: number;
  travelDate: string | null;
  ageDays: number;
  agingBucket: string;
}

export interface FinancePayable {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorType: string | null;
  service: string;
  /** paise */
  cost: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  notes: string | null;
  source: 'VENDOR_BILL' | 'ITEM_COST';
  /** VendorBill rows are managed on the Vendors page and can't be deleted here. */
  deletable: boolean;
}

export interface FinanceVendorWise {
  vendorId: string;
  vendorName: string;
  vendorType: string | null;
  totalCost: number;
  paid: number;
  balance: number;
  services: string[];
}

export interface FinanceAgingRow {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface ItemFinanceReport {
  itemType: string;
  itemLabel: string;
  item: { id: string; name: string; unitPrice: number; [k: string]: unknown };
  summary: {
    itemPrice: number;
    totalCustomers: number;
    expectedRevenue: number;
    totalCost: number;
    expectedGrossProfit: number;
  };
  revenue: { expectedRevenue: number; receivedRevenue: number; pendingRevenue: number };
  costs: { totalCost: number; paidCost: number; unpaidCost: number };
  profitability: { grossProfit: number; netProfit: number; profitPercent: number };
  cashPosition: { customerCollections: number; vendorPayments: number; currentCashBalance: number };
  operations: {
    paxCount: number;
    confirmedPax: number;
    cancelledPax: number;
    occupancy: number;
    bookingCount: number;
    cancelledBookingCount: number;
  };
  receivables: FinanceReceivable[];
  agingReport: FinanceAgingRow[];
  payables: FinancePayable[];
  vendorWise: FinanceVendorWise[];
  dueDateTracking: Array<{
    vendorId: string;
    vendorName: string;
    service: string;
    dueDate: string | null;
    balance: number;
  }>;
}

export type ItemType = 'PACKAGE' | 'PROPERTY' | 'CRUISE' | 'VISA' | 'SERVICE';

export function useItemFinance(itemType: ItemType, id?: string) {
  return useQuery({
    queryKey: ['item-finance', itemType, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/item-finance/${itemType}/${id}`);
      return res.data.data as ItemFinanceReport;
    },
  });
}

export interface VendorCostInput {
  vendorId: string;
  serviceLabel: string;
  /** paise, must be > 0 */
  amount: number;
  /** YYYY-MM-DD */
  dueDate?: string | null;
  notes?: string | null;
}

export function useCreateVendorCost(itemType: ItemType, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VendorCostInput) => {
      const res = await api.post(`/item-finance/${itemType}/${id}/vendor-costs`, input);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-finance', itemType, id] }),
  });
}

export function useDeleteVendorCost(itemType: ItemType, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (costId: string) => {
      await api.delete(`/item-finance/${itemType}/${id}/vendor-costs/${costId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-finance', itemType, id] }),
  });
}

// ---------------------------------------------------------------------------
// Vendors — needed to attach a payable. GOTCHA: GET /vendors returns a BARE
// ARRAY, not the { success, data } envelope every other route uses.
// ---------------------------------------------------------------------------

export interface Vendor {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await api.get('/vendors', { params: { isActive: 'true' } });
      return (Array.isArray(res.data) ? res.data : res.data?.data ?? []) as Vendor[];
    },
  });
}
