import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { FunnelIcon, CurrencyRupeeIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import VendorPayments from './VendorPayments';

function getPaymentItemName(payment) {
  if (!payment?.itemType) return '-';
  if (payment.itemType === 'PACKAGE') return payment.package?.name || 'Package';
  if (payment.itemType === 'PROPERTY') return payment.property?.name || 'Property';
  if (payment.itemType === 'CRUISE') return payment.cruise?.name || 'Cruise';
  if (payment.itemType === 'VISA') return payment.visa ? `${payment.visa.country} Visa` : 'Visa';
  if (payment.itemType === 'SERVICE') return payment.service?.name || 'Service';
  return payment.customItemName || 'Custom';
}

export default function GlobalVendorPayments() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    vendorId: '',
    vendorType: '',
    itemType: '',
    startDate: '',
    endDate: '',
  });
  const [selectedPaymentVendor, setSelectedPaymentVendor] = useState(null);
  const [showVendorPicker, setShowVendorPicker] = useState(false);

  // Fetch vendors for dropdown
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => api.get('/vendors').then((res) => res.data),
  });

  const vendors = vendorsData || [];

  // Fetch vendor types dynamically
  const { data: vendorTypesData } = useQuery({
    queryKey: ['vendor-types-active'],
    queryFn: () => api.get('/vendor-types', { params: { isActive: true } }).then((res) => res.data),
  });
  const vendorTypes = (vendorTypesData || []).map((t) => t.name);

  // Fetch all payments based on filters
  const { data: payments, isLoading } = useQuery({
    queryKey: ['vendor-payments-all', filters],
    queryFn: () => api.get('/vendors/payments/all', { params: filters }).then((res) => res.data),
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const refreshPayments = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor-payments-all'] });
  };

  const openAddPayment = () => {
    const filteredVendor = vendors.find((vendor) => vendor.id === filters.vendorId);
    if (filteredVendor) {
      setSelectedPaymentVendor(filteredVendor);
      return;
    }
    setShowVendorPicker(true);
  };

  const selectPaymentVendor = (vendor) => {
    setSelectedPaymentVendor(vendor);
    setShowVendorPicker(false);
  };

  const closePaymentModal = () => {
    setSelectedPaymentVendor(null);
    refreshPayments();
  };

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Accounts</p>
          <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">Vendor Payments</h1>
          <p className="mt-2 text-sm text-slate-500">Track all your outgoing payments to suppliers and vendors.</p>
        </div>
        <button
          type="button"
          onClick={openAddPayment}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={vendors.length === 0}
        >
          <PlusIcon className="h-5 w-5" />
          Add Payment
        </button>
      </section>

      {/* Filters Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Filters:</span>
          </div>
          
          <div className="grid w-full grid-cols-1 gap-4 sm:w-auto sm:grid-cols-5">
            <select
              name="vendorId"
              value={filters.vendorId}
              onChange={handleFilterChange}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <select
              name="itemType"
              value={filters.itemType}
              onChange={handleFilterChange}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">All Items</option>
              <option value="PACKAGE">Packages</option>
              <option value="PROPERTY">Properties</option>
              <option value="CRUISE">Cruises</option>
              <option value="VISA">Visas</option>
              <option value="SERVICE">Services</option>
              <option value="CUSTOM">Custom</option>
            </select>

            <select
              name="vendorType"
              value={filters.vendorType}
              onChange={handleFilterChange}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">All Types</option>
              {vendorTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              title="Start Date"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              title="End Date"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_22px_70px_-48px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-extrabold text-slate-950">Payment History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Date</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Vendor</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Type</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Mapped Item</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Mode</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Loading...</td>
                </tr>
              ) : payments?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">
                    <CurrencyRupeeIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    No vendor payments found matching your filters.
                  </td>
                </tr>
              ) : (
                payments?.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{formatDate(payment.paymentDate)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-900">{payment.vendor?.name}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{payment.vendor?.type}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {payment.itemType ? `${payment.itemType}: ${getPaymentItemName(payment)}` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {payment.paymentMode}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{payment.referenceNumber || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showVendorPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">Select Vendor</h2>
                <p className="mt-1 text-sm text-slate-500">Choose which vendor this payment is for.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVendorPicker(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {vendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => selectPaymentVendor(vendor)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{vendor.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{vendor.type || 'Vendor'}</span>
                  </span>
                  <CurrencyRupeeIcon className="h-5 w-5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPaymentVendor && (
        <VendorPayments
          vendor={selectedPaymentVendor}
          onClose={closePaymentModal}
          onPaymentSaved={refreshPayments}
        />
      )}
    </div>
  );
}
