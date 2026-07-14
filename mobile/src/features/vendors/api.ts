// FILE: mobile/src/features/vendors/api.ts
//
// Vendors are supplier master-data plus their bills and payouts. Creating a
// vendor bill or payment posts a journal entry into the control ledgers, which
// are governed by immutability + period locks — so mobile is READ-ONLY here
// too: it lists vendors, their outstanding balances and their payouts, and
// never writes.
//
// ENVELOPE GOTCHA: unlike the rest of the API, the vendors and vendor-types
// controllers return BARE arrays (res.json(rows)) — there is no
// { success, data } wrapper. Read res.data directly, not res.data.data.
//
// Money: every amount below is integer PAISE.

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface VendorType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  /** Free-text type name, matched against the agency's VendorType list. */
  type: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  ledgerId: string | null;
  isActive: boolean;
}

/** A vendor plus the outstanding total derived from its unpaid bills (paise). */
export interface VendorWithOutstanding extends Vendor {
  outstanding: number;
}

export interface VendorBill {
  id: string;
  vendorId: string;
  /** Paise. */
  amount: number;
  /** Paise. */
  paidAmount: number;
  status: string;
  billDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  description: string | null;
}

export type VendorItemType =
  | 'PACKAGE'
  | 'PROPERTY'
  | 'CRUISE'
  | 'VISA'
  | 'SERVICE'
  | 'CUSTOM';

export interface VendorPayment {
  id: string;
  vendorId: string;
  /** Paise. */
  amount: number;
  /** DATEONLY — "YYYY-MM-DD". */
  paymentDate: string;
  paymentMode: string | null;
  referenceNumber: string | null;
  notes: string | null;
  itemType: VendorItemType | null;
  customItemName: string | null;
  vendor?: { id: string; name: string; type: string | null } | null;
  package?: { id: string; name: string } | null;
  property?: { id: string; name: string } | null;
  cruise?: { id: string; name: string } | null;
  visa?: { id: string; country: string; visaType: string } | null;
  service?: { id: string; name: string } | null;
  paymentMethod?: { id: string; name: string } | null;
}

/** GET /vendor-types — drives the vendor type filter. Bare array. */
export function useVendorTypes() {
  return useQuery({
    queryKey: ['vendorTypes'],
    queryFn: async (): Promise<VendorType[]> => {
      const res = await api.get('/vendor-types', { params: { isActive: true } });
      return res.data ?? [];
    },
  });
}

/**
 * GET /vendors (+ GET /vendors/bills/all?outstandingOnly=true).
 *
 * The vendor list itself carries no balance — the controller deliberately skips
 * it. The real outstanding per vendor is therefore summed from the unpaid bills
 * (amount - paidAmount), in integer paise.
 */
export function useVendors(type?: string) {
  return useQuery({
    queryKey: ['vendors', type ?? 'ALL'],
    queryFn: async (): Promise<VendorWithOutstanding[]> => {
      const [vendorsRes, billsRes] = await Promise.all([
        api.get('/vendors', { params: type ? { type } : undefined }),
        api.get('/vendors/bills/all', { params: { outstandingOnly: true } }),
      ]);

      const vendors: Vendor[] = vendorsRes.data ?? [];
      const bills: VendorBill[] = billsRes.data ?? [];

      const dueByVendor = new Map<string, number>();
      for (const bill of bills) {
        const due = (bill.amount ?? 0) - (bill.paidAmount ?? 0);
        if (due <= 0) continue;
        dueByVendor.set(bill.vendorId, (dueByVendor.get(bill.vendorId) ?? 0) + due);
      }

      return vendors.map((v) => ({ ...v, outstanding: dueByVendor.get(v.id) ?? 0 }));
    },
  });
}

/**
 * GET /vendors/payments/all — payouts already made, newest first.
 *
 * NOTE: a VendorPayment has no status. It is a record of money that moved, so
 * there is no Pending/Paid split to filter on; the supported facet is itemType
 * (what the payout was for).
 */
export function useVendorPayments(itemType?: VendorItemType) {
  return useQuery({
    queryKey: ['vendorPayments', itemType ?? 'ALL'],
    queryFn: async (): Promise<VendorPayment[]> => {
      const res = await api.get('/vendors/payments/all', {
        params: itemType ? { itemType } : undefined,
      });
      return res.data ?? [];
    },
  });
}

/** What a payout was for. Mirrors the web's getPaymentItemName. */
export function paymentItemName(payment: VendorPayment): string | null {
  switch (payment.itemType) {
    case 'PACKAGE':
      return payment.package?.name ?? 'Package';
    case 'PROPERTY':
      return payment.property?.name ?? 'Property';
    case 'CRUISE':
      return payment.cruise?.name ?? 'Cruise';
    case 'VISA':
      return payment.visa ? `${payment.visa.country} Visa` : 'Visa';
    case 'SERVICE':
      return payment.service?.name ?? 'Service';
    case 'CUSTOM':
      return payment.customItemName ?? 'Custom';
    default:
      return null;
  }
}

export const VENDOR_ITEM_TYPES: { key: VendorItemType; label: string }[] = [
  { key: 'PACKAGE', label: 'Package' },
  { key: 'PROPERTY', label: 'Property' },
  { key: 'CRUISE', label: 'Cruise' },
  { key: 'VISA', label: 'Visa' },
  { key: 'SERVICE', label: 'Service' },
  { key: 'CUSTOM', label: 'Custom' },
];
