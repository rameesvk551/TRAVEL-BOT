// FILE: mobile/src/features/accounting/api.ts
//
// READ-ONLY over the accounting module.
//
// The backend accounting module posts to consolidated control ledgers and
// enforces hard governance rules — journal immutability, period locks and
// gap-free voucher numbering. Mobile therefore only ever READS: it lists and
// views invoices and reports, and never creates, edits or voids a journal
// entry, invoice or voucher. Any write path belongs on the web app, where the
// full validation UI lives.
//
// Envelope: these routes return { success: true, data: ... }.
// Money: every amount below is integer PAISE — render with formatCurrency /
// formatCurrencyCompact from lib/formatters, never with float math.

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

/** AccountInvoice.status — the real lifecycle stored by the backend. */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export interface InvoiceCustomer {
  id: string;
  name: string | null;
  phone: string | null;
}

export interface InvoiceBooking {
  id: string;
  bookingRef: string | null;
  travelDate: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  /** Paise. */
  totalAmount: number;
  /** Paise. */
  paidAmount: number;
  customer?: InvoiceCustomer | null;
  booking?: InvoiceBooking | null;
}

/**
 * GET /accounts/invoices — newest first, capped server-side at 200.
 * Errors propagate so react-query reports isError and the screen shows ErrorState.
 */
export function useInvoices(status?: InvoiceStatus) {
  return useQuery({
    queryKey: ['accounts', 'invoices', status ?? 'ALL'],
    queryFn: async (): Promise<Invoice[]> => {
      const res = await api.get('/accounts/invoices', {
        params: status ? { status } : undefined,
      });
      return res.data.data ?? [];
    },
  });
}

export interface LedgerBalance {
  ledgerId: string;
  debit: number;
  credit: number;
  /** Paise. */
  balance: number;
}

export interface PayablesReceivables {
  receivables: LedgerBalance;
  payables: LedgerBalance;
}

/** GET /accounts/reports/payables-receivables — the two control-ledger balances. */
export function usePayablesReceivables() {
  return useQuery({
    queryKey: ['accounts', 'payables-receivables'],
    queryFn: async (): Promise<PayablesReceivables> => {
      const res = await api.get('/accounts/reports/payables-receivables');
      return res.data.data;
    },
  });
}

export interface ProfitLossSummary {
  /** Paise. */
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  otherIncome: number;
  netProfit: number;
  totalIncome: number;
  totalExpenses: number;
  /** Percent, 2dp. */
  grossMargin: number;
  netMargin: number;
}

export interface ProfitLoss {
  summary: ProfitLossSummary;
}

/**
 * GET /accounts/reports/profit-loss — inception-to-date when no range is given.
 * Amounts are exact integer paise.
 */
export function useProfitLoss(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['accounts', 'profit-loss', dateFrom ?? null, dateTo ?? null],
    queryFn: async (): Promise<ProfitLoss> => {
      const res = await api.get('/accounts/reports/profit-loss', {
        params: { dateFrom, dateTo },
      });
      return res.data.data;
    },
  });
}

/** Amount still owed on an invoice, in paise. Integer math only. */
export function invoiceOutstanding(invoice: Invoice): number {
  return Math.max(0, (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0));
}

/** Derived from the real dueDate — the backend has no OVERDUE status. */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'PAID' || invoice.status === 'VOID') return false;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate).getTime() < Date.now();
}

/** Human label for an invoice status. */
export function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'PARTIALLY_PAID':
      return 'Part paid';
    case 'DRAFT':
      return 'Draft';
    case 'ISSUED':
      return 'Issued';
    case 'PAID':
      return 'Paid';
    case 'VOID':
      return 'Void';
    default:
      return status;
  }
}
