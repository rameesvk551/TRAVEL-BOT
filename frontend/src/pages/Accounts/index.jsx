import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BookOpenIcon,
  CheckCircleIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  DocumentTextIcon,
  ChartBarIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import client from '../../api/client';
import { accountsApi } from '../../api/accountsApi';
import { bookingsApi } from '../../api/bookingsApi';
import { formatDate } from '../../utils/formatters';
import {
  Card, EmptyState, Stat, Tabs, money, asArray, unwrap, toPaise, today, humanize, primaryBtn, Modal,
} from './ui';
import ChartOfAccounts from './ChartOfAccounts';
import Journals from './Journals';
import Invoices from './Invoices';
import Reports from './Reports';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Squares2X2Icon },
  { key: 'chart', label: 'Chart of Accounts', icon: RectangleStackIcon },
  { key: 'journals', label: 'Journals', icon: ListBulletIcon },
  { key: 'invoices', label: 'Invoices', icon: DocumentTextIcon },
  { key: 'reports', label: 'Reports', icon: ChartBarIcon },
];

export default function Accounts() {
  const [tab, setTab] = useState('overview');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isVendorOpen, setIsVendorOpen] = useState(false);

  return (
    <div className="w-full space-y-5">
      <div>
        <p className="eyebrow">Accounting</p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-950">Accounts</h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsReceiptOpen(true)} className={primaryBtn}>
            <PlusIcon className="h-4 w-4" /> Receipt
          </button>
          <button type="button" onClick={() => setIsVendorOpen(true)} className={primaryBtn}>
            <PlusIcon className="h-4 w-4" /> Payment
          </button>
        </div>
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'chart' && <ChartOfAccounts />}
      {tab === 'journals' && <Journals />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'reports' && <Reports />}

      {isReceiptOpen && <CustomerReceiptModal open={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} />}
      {isVendorOpen && <VendorEntryModal open={isVendorOpen} onClose={() => setIsVendorOpen(false)} />}
    </div>
  );
}

function Overview() {
  const invoicesQuery = useQuery({ queryKey: ['accounts-invoices'], queryFn: () => accountsApi.invoices({ limit: 200 }) });
  const journalsQuery = useQuery({ queryKey: ['accounts-journals'], queryFn: () => accountsApi.journals({ pageSize: 30 }) });
  const bookingsQuery = useQuery({ queryKey: ['accounts-bookings'], queryFn: () => bookingsApi.list({ pageSize: 200, limit: 200 }), retry: false });
  const vendorPaymentsQuery = useQuery({ queryKey: ['vendor-payments-all'], queryFn: () => client.get('/vendors/payments/all').then((res) => res.data) });
  const trialQuery = useQuery({ queryKey: ['accounts-trial-balance'], queryFn: () => accountsApi.report('trial-balance') });

  const invoices = asArray(unwrap(invoicesQuery.data, []));
  const journals = asArray(unwrap(journalsQuery.data, { data: [] }).data);
  const bookingsPayload = unwrap(bookingsQuery.data, { data: [] });
  const bookings = asArray(bookingsPayload.data || bookingsPayload.rows || bookingsPayload);
  const vendorPayments = asArray(vendorPaymentsQuery.data);
  const trialRows = asArray(unwrap(trialQuery.data, { data: [] }).data);

  const totals = useMemo(() => {
    const receivable = invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)), 0);
    const received = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
    const payable = trialRows
      .filter((row) => row.ledger?.type === 'LIABILITY' && /vendor|creditor/i.test(row.ledger?.name || ''))
      .reduce((sum, row) => sum + Number(row.credit || 0) - Number(row.debit || 0), 0);
    const vendorPaid = vendorPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { receivable, received, payable: Math.max(0, payable), vendorPaid };
  }, [invoices, trialRows, vendorPayments]);

  const bookingOptions = useMemo(() => {
    return bookings.map((booking) => {
      const invoice = invoices.find((item) => item.bookingId === booking.id);
      const total = Number(invoice?.totalAmount ?? booking.totalAmount ?? 0);
      const paid = Number(invoice?.paidAmount ?? booking.advancePaid ?? 0);
      return {
        ...booking,
        due: Math.max(0, total - paid),
        label: `${booking.bookingRef || 'Booking'} - ${booking.customer?.name || booking.customerName || 'Customer'}`,
      };
    }).filter((booking) => booking.due > 0);
  }, [bookings, invoices]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customer Due" value={money(totals.receivable)} note={`${bookingOptions.length} unpaid bookings`} icon={ArrowDownTrayIcon} tone="blue" />
        <Stat label="Customer Received" value={money(totals.received)} note="Against booking receipts" icon={BanknotesIcon} tone="green" />
        <Stat label="Vendor Payable" value={money(totals.payable)} note="Vendor bills not settled" icon={ArrowUpTrayIcon} tone="amber" />
        <Stat label="Vendor Paid" value={money(totals.vendorPaid)} note={`${vendorPayments.length} payments`} icon={CheckCircleIcon} tone="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="mb-3">
            <p className="eyebrow">Customer dues</p>
            <h2 className="mt-1 text-lg font-extrabold text-neutral-950">Unpaid bookings</h2>
          </div>
          <div className="space-y-2">
            {bookingOptions.slice(0, 8).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-neutral-950">{booking.label}</p>
                  <p className="text-xs text-neutral-500">{formatDate(booking.travelDate)} · {humanize(booking.status)}</p>
                </div>
                <span className="shrink-0 font-extrabold text-neutral-950">{money(booking.due)}</span>
              </div>
            ))}
            {bookingOptions.length === 0 && <EmptyState text="No unpaid bookings." />}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Register</p>
              <h2 className="mt-1 text-lg font-extrabold text-neutral-950">Recent account entries</h2>
            </div>
            <BookOpenIcon className="h-5 w-5 text-neutral-300" />
          </div>
          <div className="space-y-2">
            {journals.slice(0, 10).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-neutral-950">{entry.referenceNumber}</p>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold uppercase text-neutral-500">{humanize(entry.type)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-neutral-500">{formatDate(entry.date)} · {entry.description || 'No narration'}</p>
              </div>
            ))}
            {journals.length === 0 && <EmptyState text="No account entries yet." />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CustomerReceiptModal({ open, onClose }) {
  const qc = useQueryClient();
  const [receiptForm, setReceiptForm] = useState({ bookingId: '', amount: '', paymentMethodId: '', receiptDate: today(), referenceNumber: '', notes: '' });

  const invoicesQuery = useQuery({ queryKey: ['accounts-invoices'], queryFn: () => accountsApi.invoices({ limit: 200 }) });
  const bookingsQuery = useQuery({ queryKey: ['accounts-bookings'], queryFn: () => bookingsApi.list({ pageSize: 200, limit: 200 }), retry: false });
  const paymentMethodsQuery = useQuery({ queryKey: ['account-payment-methods'], queryFn: () => accountsApi.paymentMethods() });

  const invoices = asArray(unwrap(invoicesQuery.data, []));
  const bookingsPayload = unwrap(bookingsQuery.data, { data: [] });
  const bookings = asArray(bookingsPayload.data || bookingsPayload.rows || bookingsPayload);
  const paymentMethods = asArray(unwrap(paymentMethodsQuery.data, []));
  const defaultPaymentMethodId = paymentMethods.find((method) => method.isDefault)?.id || paymentMethods[0]?.id || '';

  const bookingOptions = useMemo(() => {
    return bookings.map((booking) => {
      const invoice = invoices.find((item) => item.bookingId === booking.id);
      const total = Number(invoice?.totalAmount ?? booking.totalAmount ?? 0);
      const paid = Number(invoice?.paidAmount ?? booking.advancePaid ?? 0);
      return {
        ...booking,
        due: Math.max(0, total - paid),
        label: `${booking.bookingRef || 'Booking'} - ${booking.customer?.name || booking.customerName || 'Customer'}`,
      };
    }).filter((booking) => booking.due > 0);
  }, [bookings, invoices]);

  const invalidateAccounts = () => {
    ['accounts-invoices', 'accounts-journals', 'accounts-bookings', 'vendor-payments-all', 'accounts-trial-balance'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const receiptMutation = useMutation({
    mutationFn: (data) => accountsApi.createCustomerReceipt({
      bookingId: data.bookingId, amount: toPaise(data.amount), paymentMethodId: data.paymentMethodId || defaultPaymentMethodId || undefined, receiptDate: data.receiptDate, referenceNumber: data.referenceNumber || undefined,
    }),
    onSuccess: () => { setReceiptForm({ bookingId: '', amount: '', paymentMethodId: defaultPaymentMethodId, receiptDate: today(), referenceNumber: '', notes: '' }); invalidateAccounts(); onClose(); },
  });

  const selectedBooking = bookingOptions.find((booking) => booking.id === receiptForm.bookingId);

  return (
    <Modal open={open} onClose={onClose} title="Customer Receipts" width="max-w-5xl">
      <div className="flex flex-col md:flex-row h-[600px] -mx-5 -my-4 overflow-hidden rounded-b-2xl">
        <div className="w-full md:w-1/2 p-6 flex flex-col h-full">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-6">Record Receipt</h4>
          <form className="flex-1 overflow-y-auto pr-4 space-y-4" onSubmit={(event) => { event.preventDefault(); receiptMutation.mutate(receiptForm, { onError: (error) => window.alert(error?.response?.data?.error || error?.message || 'Could not record receipt') }); }}>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Unpaid Booking *</label>
              <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" value={receiptForm.bookingId} onChange={(e) => setReceiptForm({ ...receiptForm, bookingId: e.target.value })} required>
                <option value="">Select unpaid booking</option>
                {bookingOptions.map((booking) => <option key={booking.id} value={booking.id}>{booking.label} - due {money(booking.due)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Amount *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500">₹</span>
                <input className="w-full rounded-lg border border-neutral-200 pl-8 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" inputMode="decimal" placeholder={selectedBooking ? `due ${money(selectedBooking.due)}` : ''} value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Received In *</label>
              <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" value={receiptForm.paymentMethodId || defaultPaymentMethodId} onChange={(e) => setReceiptForm({ ...receiptForm, paymentMethodId: e.target.value })} required>
                <option value="">Select account...</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}{method.ledger?.name ? ` · ${method.ledger.name}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Date *</label>
              <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" type="date" value={receiptForm.receiptDate} onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Reference No.</label>
              <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" placeholder="Txn ID, Cheque No..." value={receiptForm.referenceNumber} onChange={(e) => setReceiptForm({ ...receiptForm, referenceNumber: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Notes</label>
              <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" rows="3" value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}></textarea>
            </div>
            <button type="submit" disabled={receiptMutation.isPending || !receiptForm.bookingId || toPaise(receiptForm.amount) <= 0} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed">
              Post Receipt
            </button>
          </form>
        </div>
        
        <div className="w-full md:w-1/2 p-6 bg-neutral-50 flex flex-col h-full border-l border-neutral-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Outstanding Bookings</h4>
            <span className="text-xs font-bold bg-neutral-200 text-neutral-600 px-2 py-1 rounded-full">{bookingOptions.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {bookingOptions.map((b) => (
              <div key={b.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm transition hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm text-neutral-950">{b.label}</p>
                  <p className="font-extrabold text-sm text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{money(b.due)} Due</p>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                  <span>Total: {money(b.totalAmount)}</span>
                  <span>{formatDate(b.travelDate)}</span>
                </div>
              </div>
            ))}
            {bookingOptions.length === 0 && <div className="py-10"><EmptyState text="No outstanding bookings" /></div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function VendorEntryModal({ open, onClose }) {
  const qc = useQueryClient();
  const [vendorForm, setVendorForm] = useState({
    entryType: 'BILL', vendorId: '', vendorBillId: '', amount: '', billDate: today(), paymentDate: today(), description: '', referenceNumber: '', payNow: true, paymentMode: 'BANK', paymentMethodId: '', notes: ''
  });

  const vendorsQuery = useQuery({ queryKey: ['vendors'], queryFn: () => client.get('/vendors').then((res) => res.data) });
  const paymentMethodsQuery = useQuery({ queryKey: ['account-payment-methods'], queryFn: () => accountsApi.paymentMethods() });
  const vendorPaymentsQuery = useQuery({ queryKey: ['vendor-payments-all'], queryFn: () => client.get('/vendors/payments/all').then((res) => res.data) });
  const vendorBillsQuery = useQuery({ queryKey: ['vendor-bills-outstanding'], queryFn: () => client.get('/vendors/bills/all', { params: { outstandingOnly: true } }).then((res) => res.data) });

  const vendors = asArray(vendorsQuery.data);
  const paymentMethods = asArray(unwrap(paymentMethodsQuery.data, []));
  const vendorPayments = asArray(vendorPaymentsQuery.data);
  const vendorBills = asArray(vendorBillsQuery.data);
  const defaultPaymentMethodId = paymentMethods.find((method) => method.isDefault)?.id || paymentMethods[0]?.id || '';

  const invalidateAccounts = () => {
    ['accounts-invoices', 'accounts-journals', 'accounts-bookings', 'vendor-payments-all', 'vendor-bills-outstanding', 'accounts-trial-balance'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const vendorEntryMutation = useMutation({
    mutationFn: (data) => {
      if (data.entryType === 'PAYMENT') {
        return client.post(`/vendors/${data.vendorId}/payments`, {
          vendorBillId: data.vendorBillId,
          amount: toPaise(data.amount),
          paymentDate: data.paymentDate,
          referenceNumber: data.referenceNumber || undefined,
          paymentMode: data.paymentMode,
          paymentMethodId: data.paymentMethodId || defaultPaymentMethodId || undefined,
          notes: data.notes || undefined,
        }).then((res) => res.data);
      }
      return client.post(`/vendors/${data.vendorId}/bills`, {
        amount: toPaise(data.amount), billDate: data.billDate, description: data.notes || undefined,
        referenceNumber: data.referenceNumber || undefined, payNow: data.payNow, paymentMode: data.paymentMode, paymentMethodId: data.paymentMethodId || defaultPaymentMethodId || undefined,
      }).then((res) => res.data);
    },
    onSuccess: () => { setVendorForm({ entryType: 'BILL', vendorId: '', vendorBillId: '', amount: '', billDate: today(), paymentDate: today(), description: '', referenceNumber: '', payNow: true, paymentMode: 'BANK', paymentMethodId: defaultPaymentMethodId, notes: '' }); invalidateAccounts(); onClose(); },
  });

  const selectedVendorPayments = vendorForm.vendorId
    ? vendorPayments.filter((vp) => vp.vendorId === vendorForm.vendorId)
    : vendorPayments;
  const selectedVendorBills = vendorForm.vendorId
    ? vendorBills.filter((bill) => bill.vendorId === vendorForm.vendorId)
    : [];
  const selectedBill = selectedVendorBills.find((bill) => bill.id === vendorForm.vendorBillId);
  const selectedBillDue = selectedBill ? Math.max(0, Number(selectedBill.amount || 0) - Number(selectedBill.paidAmount || 0)) : 0;

  const selectedVendor = vendors.find(v => v.id === vendorForm.vendorId);
  const title = selectedVendor ? `${selectedVendor.name} - Payments` : 'Vendor Payments';

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-5xl">
      <div className="flex flex-col md:flex-row h-[600px] -mx-5 -my-4 overflow-hidden rounded-b-2xl">
        <div className="w-full md:w-1/2 p-6 flex flex-col h-full">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-6">Vendor Entry</h4>
          <form className="flex-1 overflow-y-auto pr-4 space-y-4" onSubmit={(event) => { event.preventDefault(); vendorEntryMutation.mutate(vendorForm, { onError: (error) => window.alert(error?.response?.data?.error || error?.message || 'Could not record vendor entry') }); }}>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
              {[
                ['BILL', 'Add Bill'],
                ['PAYMENT', 'Pay Bill'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVendorForm({ ...vendorForm, entryType: value, vendorBillId: '', amount: '' })}
                  className={`rounded-md px-3 py-2 text-sm font-bold ${vendorForm.entryType === value ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Vendor *</label>
              <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" value={vendorForm.vendorId} onChange={(e) => setVendorForm({ ...vendorForm, vendorId: e.target.value, vendorBillId: '', amount: '' })} required>
                <option value="">Select vendor</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </div>
            {vendorForm.entryType === 'PAYMENT' && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Against Bill *</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  value={vendorForm.vendorBillId}
                  onChange={(e) => {
                    const bill = selectedVendorBills.find((item) => item.id === e.target.value);
                    const due = bill ? Math.max(0, Number(bill.amount || 0) - Number(bill.paidAmount || 0)) : 0;
                    setVendorForm({ ...vendorForm, vendorBillId: e.target.value, amount: due ? String(due / 100) : '' });
                  }}
                  required
                >
                  <option value="">Select unpaid bill</option>
                  {selectedVendorBills.map((bill) => {
                    const due = Math.max(0, Number(bill.amount || 0) - Number(bill.paidAmount || 0));
                    return <option key={bill.id} value={bill.id}>{bill.referenceNumber || bill.description || `Bill ${bill.id.slice(0, 8)}`} - due {money(due)}</option>;
                  })}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Amount *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500">₹</span>
                <input className="w-full rounded-lg border border-neutral-200 pl-8 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" inputMode="decimal" max={vendorForm.entryType === 'PAYMENT' && selectedBillDue ? selectedBillDue / 100 : undefined} value={vendorForm.amount} onChange={(e) => setVendorForm({ ...vendorForm, amount: e.target.value })} required />
              </div>
            </div>
            
            {vendorForm.entryType === 'BILL' && (
            <div className="flex items-center gap-2 mt-2 mb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100">
              <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-600" checked={vendorForm.payNow} onChange={(e) => setVendorForm({ ...vendorForm, payNow: e.target.checked })} id="payNowCheckbox" /> 
              <label htmlFor="payNowCheckbox" className="text-sm font-bold text-neutral-700 cursor-pointer">Post as paid instantly</label>
            </div>
            )}

            {(vendorForm.entryType === 'PAYMENT' || vendorForm.payNow) && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Paid From *</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  value={vendorForm.paymentMethodId || defaultPaymentMethodId}
                  onChange={(e) => {
                    const method = paymentMethods.find((item) => item.id === e.target.value);
                    setVendorForm({ ...vendorForm, paymentMethodId: e.target.value, paymentMode: method?.methodType || vendorForm.paymentMode });
                  }}
                  required={vendorForm.entryType === 'PAYMENT' || vendorForm.payNow}
                >
                  <option value="">Select account...</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>{method.name}{method.ledger?.name ? ` · ${method.ledger.name}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Date *</label>
              <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" type="date" value={vendorForm.entryType === 'PAYMENT' ? vendorForm.paymentDate : vendorForm.billDate} onChange={(e) => setVendorForm({ ...vendorForm, [vendorForm.entryType === 'PAYMENT' ? 'paymentDate' : 'billDate']: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Reference No.</label>
              <input className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" placeholder="Txn ID, Cheque No..." value={vendorForm.referenceNumber} onChange={(e) => setVendorForm({ ...vendorForm, referenceNumber: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Notes</label>
              <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none" rows="3" value={vendorForm.notes} onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}></textarea>
            </div>
            <button type="submit" disabled={vendorEntryMutation.isPending || !vendorForm.vendorId || (vendorForm.entryType === 'PAYMENT' && !vendorForm.vendorBillId) || toPaise(vendorForm.amount) <= 0} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed">
              {vendorForm.entryType === 'PAYMENT' || vendorForm.payNow ? 'Post Payment' : 'Post Bill'}
            </button>
          </form>
        </div>
        
        <div className="w-full md:w-1/2 p-6 bg-neutral-50 flex flex-col h-full border-l border-neutral-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Payment History</h4>
            <span className="text-xs font-bold bg-neutral-200 text-neutral-600 px-2 py-1 rounded-full">{selectedVendorPayments.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {selectedVendorPayments.map((vp) => (
              <div key={vp.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm transition hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm text-neutral-950">{vp.vendor?.name || selectedVendor?.name || 'Vendor'}</p>
                  <p className="font-extrabold text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{money(vp.amount)} Paid</p>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                  <span>{formatDate(vp.date)} · {vp.paymentMode}</span>
                  {vp.referenceNumber && <span>Ref: {vp.referenceNumber}</span>}
                </div>
              </div>
            ))}
            {selectedVendorPayments.length === 0 && <div className="py-10"><EmptyState text="No payment history" /></div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
