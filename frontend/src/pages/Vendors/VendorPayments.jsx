import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { accountsApi } from '../../api/accountsApi';
import { formatCurrency } from '../../utils/formatters';

function getPaymentItemName(payment) {
  if (!payment?.itemType) return '';
  if (payment.itemType === 'PACKAGE') return payment.package?.name || 'Package';
  if (payment.itemType === 'PROPERTY') return payment.property?.name || 'Property';
  if (payment.itemType === 'CRUISE') return payment.cruise?.name || 'Cruise';
  if (payment.itemType === 'VISA') return payment.visa ? `${payment.visa.country} Visa` : 'Visa';
  if (payment.itemType === 'SERVICE') return payment.service?.name || 'Service';
  return payment.customItemName || 'Custom';
}

function Field({ label, children }) {
  return (
    <label className="block w-full">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

export default function VendorPayments({ vendor, onClose, onPaymentSaved }) {
  const [entryType, setEntryType] = useState('PAYMENT'); // 'PAYMENT' or 'BILL'
  const [payNow, setPayNow] = useState(false);
  
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [balance, setBalance] = useState(0);
  const [catalog, setCatalog] = useState({
    PACKAGE: [],
    PROPERTY: [],
    CRUISE: [],
    VISA: [],
    SERVICE: [],
  });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    amount: '',
    paymentMode: 'BANK',
    paymentMethodId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    billDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    vendorBillId: '',
    itemType: '',
    packageId: '',
    propertyId: '',
    cruiseId: '',
    visaId: '',
    serviceId: '',
    customItemName: '',
    customItemDescription: '',
    notes: '', // Used as description for BILL
  });

  useEffect(() => {
    fetchData();
  }, [vendor.id]);

  useEffect(() => {
    fetchCatalog();
    fetchPaymentMethods();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, balanceRes, billsRes] = await Promise.all([
        api.get(`/vendors/${vendor.id}/payments`),
        api.get(`/vendors/${vendor.id}/balance`),
        api.get(`/vendors/${vendor.id}/bills`, { params: { outstandingOnly: true } }),
      ]);
      setPayments(paymentsRes.data);
      setBalance(balanceRes.data.balance || 0);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (error) {
      console.error('Failed to fetch vendor data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [packagesRes, propertiesRes, cruisesRes, visasRes, servicesRes] = await Promise.all([
        api.get('/packages'),
        api.get('/properties'),
        api.get('/cruises'),
        api.get('/visas'),
        api.get('/services'),
      ]);
      const list = (res) => Array.isArray(res.data?.data?.data)
        ? res.data.data.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
      setCatalog({
        PACKAGE: list(packagesRes),
        PROPERTY: list(propertiesRes),
        CRUISE: list(cruisesRes),
        VISA: list(visasRes),
        SERVICE: list(servicesRes),
      });
    } catch (error) {
      console.error('Failed to fetch catalog for vendor payments', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await accountsApi.paymentMethods();
      const methods = Array.isArray(response?.data) ? response.data : [];
      setPaymentMethods(methods);
      const defaultMethod = methods.find((method) => method.isDefault) || methods[0];
      if (defaultMethod) {
        setFormData((current) => current.paymentMethodId ? current : {
          ...current,
          paymentMethodId: defaultMethod.id,
          paymentMode: defaultMethod.methodType || current.paymentMode,
        });
      }
    } catch (error) {
      console.error('Failed to fetch payment methods', error);
    }
  };

  const updateItemType = (itemType) => {
    setFormData({
      ...formData,
      itemType,
      packageId: '',
      propertyId: '',
      cruiseId: '',
      visaId: '',
      serviceId: '',
      customItemName: '',
      customItemDescription: '',
    });
  };

  const itemIdKey = formData.itemType ? `${formData.itemType.toLowerCase()}Id` : '';
  const selectedOptions = catalog[formData.itemType] || [];
  const selectedBill = bills.find((bill) => bill.id === formData.vendorBillId);
  const selectedBillOutstanding = selectedBill
    ? Math.max(0, Number(selectedBill.amount || 0) - Number(selectedBill.paidAmount || 0))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const basePayload = {
        ...formData,
        amount: Math.round(Number(formData.amount || 0) * 100),
      };

      if (entryType === 'BILL') {
        basePayload.payNow = payNow;
        basePayload.description = formData.notes;
        if (payNow) {
          basePayload.paymentMode = paymentMethods.find((method) => method.id === formData.paymentMethodId)?.methodType || formData.paymentMode;
        }
        await api.post(`/vendors/${vendor.id}/bills`, basePayload);
      } else {
        if (!basePayload.vendorBillId) {
          alert('Select a vendor bill for bill-wise payment');
          setSaving(false);
          return;
        }
        if (selectedBillOutstanding > 0 && basePayload.amount > selectedBillOutstanding) {
          alert('Payment cannot exceed selected bill outstanding amount');
          setSaving(false);
          return;
        }
        basePayload.paymentMode = paymentMethods.find((method) => method.id === formData.paymentMethodId)?.methodType || formData.paymentMode;
        await api.post(`/vendors/${vendor.id}/payments`, basePayload);
      }

      setFormData({
        ...formData,
        amount: '',
        referenceNumber: '',
        vendorBillId: '',
        itemType: '',
        packageId: '',
        propertyId: '',
        cruiseId: '',
        visaId: '',
        serviceId: '',
        customItemName: '',
        customItemDescription: '',
        notes: '',
      });
      setPayNow(false);
      fetchData(); // refresh list and balance
      onPaymentSaved?.();
    } catch (error) {
      console.error('Failed to post entry', error);
      alert('Failed to post entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{vendor.name} - Finance</h2>
            <p className="text-sm text-neutral-500">
              Current Balance: <span className={balance >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatCurrency(Math.abs(balance))} {balance < 0 ? '(Cr)' : '(Dr)'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Form */}
          <div className="w-[45%] border-r border-neutral-200 bg-neutral-50 p-6 overflow-y-auto">
            <div className="flex rounded-lg bg-neutral-200/50 p-1 mb-6">
              <button
                type="button"
                onClick={() => setEntryType('PAYMENT')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition-all ${entryType === 'PAYMENT' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Record Payment
              </button>
              <button
                type="button"
                onClick={() => setEntryType('BILL')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition-all ${entryType === 'BILL' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Add Bill
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {entryType === 'PAYMENT' && (
                <Field label="Against Bill *">
                  <select
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                    value={formData.vendorBillId}
                    onChange={(e) => {
                      const bill = bills.find((item) => item.id === e.target.value);
                      const outstanding = bill ? Math.max(0, Number(bill.amount || 0) - Number(bill.paidAmount || 0)) : 0;
                      setFormData({
                        ...formData,
                        vendorBillId: e.target.value,
                        amount: formData.amount || (outstanding ? String(outstanding / 100) : ''),
                      });
                    }}
                  >
                    <option value="">Select unpaid bill...</option>
                    {bills.map((bill) => {
                      const outstanding = Math.max(0, Number(bill.amount || 0) - Number(bill.paidAmount || 0));
                      return (
                        <option key={bill.id} value={bill.id}>
                          {bill.referenceNumber || bill.description || `Bill ${bill.id.slice(0, 8)}`} - Due {formatCurrency(outstanding)}
                        </option>
                      );
                    })}
                  </select>
                  {bills.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">No unpaid bills found. Add a bill first, or mark it paid while creating the bill.</p>
                  )}
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount *">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-neutral-500">₹</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={entryType === 'PAYMENT' && selectedBillOutstanding ? selectedBillOutstanding / 100 : undefined}
                      required
                      className="w-full rounded-lg border border-neutral-300 pl-8 pr-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                </Field>
                
                {entryType === 'BILL' ? (
                  <Field label="Bill Date *">
                    <input
                      type="date"
                      required
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                      value={formData.billDate}
                      onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                    />
                  </Field>
                ) : (
                  <Field label="Payment Date *">
                    <input
                      type="date"
                      required
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    />
                  </Field>
                )}
              </div>

              {/* Domain & Item Mapping UI */}
              {entryType === 'BILL' && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Service Mapping</h4>
                <div className="space-y-4">
                  <Field label="Domain (Item Type)">
                    <select
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                      value={formData.itemType}
                      onChange={(e) => updateItemType(e.target.value)}
                    >
                      <option value="">Unmapped / General</option>
                      <option value="PACKAGE">Package</option>
                      <option value="PROPERTY">Property</option>
                      <option value="CRUISE">Cruise</option>
                      <option value="VISA">Visa</option>
                      <option value="SERVICE">Service</option>
                      <option value="CUSTOM">Custom Item</option>
                    </select>
                  </Field>

                  {formData.itemType && formData.itemType !== 'CUSTOM' && (
                    <Field label={`Select ${formData.itemType.charAt(0) + formData.itemType.slice(1).toLowerCase()} (optional)`}>
                      <select
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                        value={formData[itemIdKey] || ''}
                        onChange={(e) => setFormData({ ...formData, [itemIdKey]: e.target.value })}
                      >
                        <option value="">Choose item... (optional)</option>
                        {selectedOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name || item.country || item.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {formData.itemType === 'CUSTOM' && (
                    <>
                      <Field label="Custom Item Name *">
                        <input
                          type="text"
                          required
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                          value={formData.customItemName}
                          onChange={(e) => setFormData({ ...formData, customItemName: e.target.value })}
                        />
                      </Field>
                      <Field label="Custom Description">
                        <textarea
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                          rows="2"
                          value={formData.customItemDescription}
                          onChange={(e) => setFormData({ ...formData, customItemDescription: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
              )}

              {entryType === 'BILL' && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="h-5 w-5 rounded border-neutral-300 text-[#00A884] focus:ring-[#00A884]"
                      checked={payNow}
                      onChange={(e) => setPayNow(e.target.checked)}
                    />
                    <span className="font-semibold text-neutral-900">Mark as Paid</span>
                  </label>
                </div>
              )}

              {(entryType === 'PAYMENT' || (entryType === 'BILL' && payNow)) && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Payment Details</h4>
                  
                  <Field label="Paid From *">
                    <select
                      required
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                      value={formData.paymentMethodId}
                      onChange={(e) => {
                        const method = paymentMethods.find((item) => item.id === e.target.value);
                        setFormData({ ...formData, paymentMethodId: e.target.value, paymentMode: method?.methodType || formData.paymentMode });
                      }}
                    >
                      <option value="">Select account...</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}{method.ledger?.name ? ` · ${method.ledger.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {entryType === 'BILL' && payNow && (
                    <Field label="Payment Date *">
                      <input
                        type="date"
                        required
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                        value={formData.paymentDate}
                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
              )}

              <Field label="Reference No.">
                <input
                  type="text"
                  placeholder="Txn ID, Cheque No, Bill No..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </Field>

              <Field label={entryType === 'BILL' ? 'Description' : 'Notes'}>
                <textarea
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </Field>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-[#00A884] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#008f6f] disabled:opacity-50"
              >
                {saving ? 'Posting...' : entryType === 'BILL' ? 'Save Bill' : 'Post Payment'}
              </button>
            </form>
          </div>

          {/* Right: Payment History */}
          <div className="w-[55%] overflow-y-auto p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">Transaction History</h3>
            
            {loading ? (
              <div className="text-sm text-neutral-500">Loading history...</div>
            ) : payments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
                <p className="text-sm text-neutral-500">No transactions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                    <div>
                      <div className="font-bold text-neutral-900">{formatCurrency(payment.amount)}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {payment.paymentDate} • {payment.paymentMode || 'BILL'}
                        {payment.referenceNumber && ` • Ref: ${payment.referenceNumber}`}
                      </div>
                      {payment.notes && (
                        <div className="mt-2 text-sm text-neutral-600">{payment.notes}</div>
                      )}
                      {payment.itemType && (
                        <div className="mt-2 inline-flex items-center rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          {payment.itemType}: {getPaymentItemName(payment)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Posted
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
