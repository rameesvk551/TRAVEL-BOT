import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserIcon, 
  BriefcaseIcon, 
  CreditCardIcon, 
  DocumentTextIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { bookingsApi } from '../api/bookingsApi';
import { accountsApi } from '../api/accountsApi';

const EMPTY_BOOKING_FORM = {
  customerId: '',
  newCustomer: { name: '', phone: '', email: '' },
  itemType: 'PACKAGE',
  packageId: '',
  propertyId: '',
  cruiseId: '',
  visaId: '',
  serviceId: '',
  customItemName: '',
  customItemDescription: '',
  paymentMode: 'FULL',
  settlementType: 'FULL_COLLECTION',
  commissionAmount: '',
  paymentMethodId: '',
  basePrice: '',
  totalAmount: '',
  advanceAmount: '',
  travelDate: '',
  returnDate: '',
  travellers: '2',
  notes: '',
};

function getListPayload(response) {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

function Field({ label, children }) {
  return (
    <label className="block w-full">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function calculateTotal(basePrice, travellers) {
  const base = Number(basePrice || 0);
  const count = Math.max(1, Number(travellers || 1));
  return base > 0 ? String(base * count) : '';
}

function resetItemFields(next) {
  return {
    ...next,
    packageId: '',
    propertyId: '',
    cruiseId: '',
    visaId: '',
    serviceId: '',
    customItemName: '',
    customItemDescription: '',
    basePrice: '',
    totalAmount: '',
  };
}

export default function BookingForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerMode, setCustomerMode] = useState('existing');
  const [form, setForm] = useState(EMPTY_BOOKING_FORM);
  const [error, setError] = useState('');

  const { data: customersResponse } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.get('/customers').then((r) => r.data),
  });
  const customers = getListPayload(customersResponse);

  const { data: packagesResponse } = useQuery({
    queryKey: ['packages'],
    queryFn: () => client.get('/packages').then((r) => r.data),
    enabled: form.itemType === 'PACKAGE',
  });
  const packages = getListPayload(packagesResponse);

  const { data: cruisesResponse } = useQuery({
    queryKey: ['cruises'],
    queryFn: () => client.get('/cruises').then((r) => r.data),
    enabled: form.itemType === 'CRUISE',
  });
  const cruises = getListPayload(cruisesResponse);

  const { data: propertiesResponse } = useQuery({
    queryKey: ['properties'],
    queryFn: () => client.get('/properties').then((r) => r.data),
    enabled: form.itemType === 'PROPERTY',
  });
  const properties = getListPayload(propertiesResponse);

  const { data: visasResponse } = useQuery({
    queryKey: ['visas'],
    queryFn: () => client.get('/visas').then((r) => r.data),
    enabled: form.itemType === 'VISA',
  });
  const visas = getListPayload(visasResponse);

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => client.get('/services').then((r) => r.data),
    enabled: form.itemType === 'SERVICE',
  });
  const services = getListPayload(servicesResponse);

  const { data: paymentMethodsResponse } = useQuery({
    queryKey: ['account-payment-methods'],
    queryFn: () => accountsApi.paymentMethods(),
  });
  const paymentMethods = getListPayload(paymentMethodsResponse);
  const defaultPaymentMethodId = paymentMethods.find((method) => method.isDefault)?.id || paymentMethods[0]?.id || '';

  const createBooking = useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/bookings');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to create booking');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      itemType: form.itemType,
      paymentMode: form.paymentMode,
      settlementType: form.settlementType,
      basePrice: Number(form.basePrice || 0) * 100,
      totalAmount: Number(form.totalAmount) * 100,
      travellers: form.travellers ? Number(form.travellers) : undefined,
      travelDate: form.travelDate || undefined,
      returnDate: form.returnDate || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (customerMode === 'existing') {
      if (!form.customerId) return setError('Please select a customer.');
      payload.customerId = form.customerId;
    } else {
      if (!form.newCustomer.name || !form.newCustomer.phone) {
        return setError('New customer name and phone are required.');
      }
      payload.newCustomer = form.newCustomer;
    }

    if (form.paymentMode === 'ADVANCE') {
      payload.advanceAmount = Number(form.advanceAmount) * 100;
    }
    if (form.settlementType === 'COMMISSION_ONLY') {
      payload.commissionAmount = Number(form.commissionAmount || 0) * 100;
    }
    if (form.paymentMode !== 'NO_PAYMENT') {
      payload.paymentMethodId = form.paymentMethodId || defaultPaymentMethodId || undefined;
    }

    if (form.itemType === 'PACKAGE') payload.packageId = form.packageId || undefined;
    if (form.itemType === 'PROPERTY') payload.propertyId = form.propertyId || undefined;
    if (form.itemType === 'CRUISE') payload.cruiseId = form.cruiseId || undefined;
    if (form.itemType === 'VISA') payload.visaId = form.visaId || undefined;
    if (form.itemType === 'SERVICE') payload.serviceId = form.serviceId || undefined;
    if (form.itemType === 'CUSTOM') {
      payload.customItemName = form.customItemName;
      payload.customItemDescription = form.customItemDescription;
      if (!form.customItemName) return setError('Custom item name is required.');
    }

    await createBooking.mutateAsync(payload);
  };

  const handleItemSelectChange = (e) => {
    const val = e.target.value;
    const type = form.itemType;
    let price = 0;

    if (type === 'PACKAGE') {
      const p = packages.find(x => x.id === val);
      if (p) price = p.basePrice;
    } else if (type === 'PROPERTY') {
      const p = properties.find(x => x.id === val);
      if (p) price = p.pricePerNight;
    } else if (type === 'CRUISE') {
      const c = cruises.find(x => x.id === val);
      if (c) price = c.basePrice;
    } else if (type === 'VISA') {
      const v = visas.find(x => x.id === val);
      if (v) price = v.price;
    } else if (type === 'SERVICE') {
      const s = services.find(x => x.id === val);
      if (s) price = s.basePrice;
    }

    const nextBasePrice = price ? String(price / 100) : form.basePrice;

    setForm({
      ...form,
      [`${type.toLowerCase()}Id`]: val,
      basePrice: nextBasePrice,
      totalAmount: calculateTotal(nextBasePrice, form.travellers),
    });
  };

  const updateBasePrice = (value) => {
    setForm((prev) => ({
      ...prev,
      basePrice: value,
      totalAmount: calculateTotal(value, prev.travellers),
    }));
  };

  const updateTravellers = (value) => {
    setForm((prev) => ({
      ...prev,
      travellers: value,
      totalAmount: calculateTotal(prev.basePrice, value),
    }));
  };

  return (
    <div className="mx-auto max-w-7xl pb-12 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 mt-4">
        <h1 className="page-heading">New Booking</h1>
        <p className="page-subtext mt-1">Configure customer details, travel services, and payment terms.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-600 border border-red-100 shadow-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* CUSTOMER DETAILS PANEL */}
        <div className="shell-panel mb-6 p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <UserIcon className="h-6 w-6 text-neutral-900" />
              <h2 className="text-lg font-bold text-neutral-900">Customer Details</h2>
            </div>
            
            <div className="flex rounded-[var(--radius-sm)] bg-neutral-100 p-1">
              <button 
                type="button" 
                onClick={() => setCustomerMode('existing')} 
                className={`flex-1 sm:flex-none rounded-[6px] px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${customerMode === 'existing' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Existing
              </button>
              <button 
                type="button" 
                onClick={() => setCustomerMode('new')} 
                className={`flex-1 sm:flex-none rounded-[6px] px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${customerMode === 'new' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                New Customer
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customerMode === 'existing' ? (
              <div className="md:col-span-2">
                <Field label="Select Customer">
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="shell-input-rect"
                  >
                    <option value="" disabled>Choose an existing customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <>
                <Field label="Full Name">
                  <input
                    type="text"
                    value={form.newCustomer.name}
                    onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, name: e.target.value } })}
                    className="shell-input-rect"
                    placeholder="E.g. John Doe"
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="text"
                    value={form.newCustomer.phone}
                    onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, phone: e.target.value } })}
                    className="shell-input-rect"
                    placeholder="+1 234 567 890"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Email Address (Optional)">
                    <input
                      type="email"
                      value={form.newCustomer.email}
                      onChange={(e) => setForm({ ...form, newCustomer: { ...form.newCustomer, email: e.target.value } })}
                      className="shell-input-rect"
                      placeholder="john@example.com"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TRAVEL SERVICE PANEL */}
        <div className="shell-panel mb-6 p-6">
          <div className="mb-6 flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <BriefcaseIcon className="h-6 w-6 text-neutral-900" />
              <h2 className="text-lg font-bold text-neutral-900">Travel Service</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Item Type">
              <select
                value={form.itemType}
                onChange={(e) => setForm(resetItemFields({ ...form, itemType: e.target.value }))}
                className="shell-input-rect"
              >
                <option value="PACKAGE">Package</option>
                <option value="PROPERTY">Property</option>
                <option value="CRUISE">Cruise</option>
                <option value="VISA">Visa</option>
                <option value="SERVICE">Service</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </Field>

            {form.itemType !== 'CUSTOM' ? (
              <Field label={`Select ${form.itemType.charAt(0) + form.itemType.slice(1).toLowerCase()}`}>
                <select
                  value={form[`${form.itemType.toLowerCase()}Id`] || ''}
                  onChange={handleItemSelectChange}
                  className="shell-input-rect"
                >
                  <option value="">No specific item (optional)</option>
                  {form.itemType === 'PACKAGE' && packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {form.itemType === 'PROPERTY' && properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {form.itemType === 'CRUISE' && cruises.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {form.itemType === 'VISA' && visas.map(v => <option key={v.id} value={v.id}>{v.country} - {v.visaType}</option>)}
                  {form.itemType === 'SERVICE' && services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Custom Item Name">
                  <input
                    type="text"
                    value={form.customItemName}
                    onChange={(e) => setForm({ ...form, customItemName: e.target.value })}
                    className="shell-input-rect"
                    placeholder="E.g., Special European Tour"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Custom Item Description">
                    <textarea
                      value={form.customItemDescription}
                      onChange={(e) => setForm({ ...form, customItemDescription: e.target.value })}
                      rows={2}
                      className="shell-input-rect py-3 min-h-[80px] resize-y"
                      placeholder="Enter specific details about this custom booking..."
                    ></textarea>
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>
        </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* PAYMENT & DATES PANEL */}
            <div className="shell-panel p-6">
          <div className="mb-6 flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <CreditCardIcon className="h-6 w-6 text-neutral-900" />
              <h2 className="text-lg font-bold text-neutral-900">Payment & Dates</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label="Base Price (Rs)">
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => updateBasePrice(e.target.value)}
                className="shell-input-rect font-semibold text-neutral-900"
                placeholder="0.00"
              />
            </Field>

            <Field label="No. of Travellers">
              <input
                type="number"
                min="1"
                value={form.travellers}
                onChange={(e) => updateTravellers(e.target.value)}
                className="shell-input-rect"
              />
            </Field>

            <Field label="Total Amount (Rs)">
              <input
                type="number"
                required
                value={form.totalAmount}
                readOnly
                className="shell-input-rect bg-neutral-50 font-semibold text-neutral-900"
                placeholder="0.00"
              />
            </Field>

            <Field label="Settlement">
              <select
                value={form.settlementType}
                onChange={(e) => setForm({ ...form, settlementType: e.target.value })}
                className="shell-input-rect"
              >
                <option value="FULL_COLLECTION">Agency collects full amount</option>
                <option value="COMMISSION_ONLY">Commission only (balance paid at property)</option>
              </select>
            </Field>

            {form.settlementType === 'COMMISSION_ONLY' ? (
              <Field label="Commission / Advance to agency (Rs)">
                <input
                  type="number"
                  required
                  value={form.commissionAmount}
                  onChange={(e) => setForm({ ...form, commissionAmount: e.target.value })}
                  className="shell-input-rect font-semibold text-neutral-900"
                  placeholder="0.00"
                />
              </Field>
            ) : (
              <Field label="Payment Terms">
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                  className="shell-input-rect"
                >
                  <option value="FULL">Full Payment</option>
                  <option value="ADVANCE">Advance Payment</option>
                  <option value="NO_PAYMENT">No Payment Yet</option>
                </select>
              </Field>
            )}

            {form.paymentMode !== 'NO_PAYMENT' ? (
              <Field label="Received In">
                <select
                  required
                  value={form.paymentMethodId || defaultPaymentMethodId}
                  onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
                  className="shell-input-rect"
                >
                  <option value="">Select account...</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}{method.ledger?.name ? ` · ${method.ledger.name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {form.paymentMode === 'ADVANCE' ? (
              <Field label="Advance Amount (₹)">
                <input
                  type="number"
                  required
                  value={form.advanceAmount}
                  onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
                  className="shell-input-rect font-semibold text-neutral-900"
                  placeholder="0.00"
                />
              </Field>
            ) : (
              <div className="hidden md:block"></div>
            )}

          </div>
        </div>

        {/* NOTES PANEL */}
        <div className="shell-panel mb-8 p-6">
          <div className="mb-6 flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="h-6 w-6 text-neutral-900" />
              <h2 className="text-lg font-bold text-neutral-900">Additional Notes</h2>
            </div>
          </div>

          <Field label="Booking Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              className="shell-input-rect py-3 min-h-[120px] resize-y"
              placeholder="Any special requests, dietary requirements, or extra details..."
            ></textarea>
            </Field>
          </div>
        </div>
        </div>

        {/* ACTIONS */}
        <div className="mt-8 flex justify-end gap-3 border-t border-neutral-200 pt-6">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="shell-button-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="shell-button-primary"
            disabled={createBooking.isPending}
          >
            {createBooking.isPending ? 'Saving...' : 'Save Booking'}
          </button>
        </div>

      </form>
    </div>
  );
}
