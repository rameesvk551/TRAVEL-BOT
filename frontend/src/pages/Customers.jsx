import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, XMarkIcon, UserIcon, ChatBubbleLeftIcon, DocumentIcon, PhoneIcon, CalendarDaysIcon, PencilSquareIcon, ClockIcon, CheckCircleIcon, ArrowUpTrayIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline';
import { customersApi, useCustomers, useCreateCustomer, useUploadCustomerDocument } from '../api/customersApi';
import { useMessages } from '../hooks/useMessages';
import { accountsApi } from '../api/accountsApi';
import { formatDate, formatDateTime, formatPhone, formatCurrency } from '../utils/formatters';
import { getInitials } from '../components/uiHelpers';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';
import ActivityTimeline from '../components/ActivityTimeline';

const getCustomerStats = (customer) => {
  if (!customer || !customer.bookings) return { totalBilled: 0, balanceDue: 0, trips: [], services: [] };
  let totalBilled = 0;
  let balanceDue = 0;
  const trips = [];
  const services = [];

  customer.bookings.forEach(b => {
    totalBilled += b.totalAmount || 0;
    // Use the booking's settlement-aware balanceDue (COMMISSION_ONLY owes only the
    // commission; the property balance is paid directly and is not due to the agency).
    // Fall back to the legacy math only if the virtual field is missing.
    balanceDue += Math.max(0, b.balanceDue ?? ((b.totalAmount || 0) - (b.advancePaid || 0)));
    
    const itemName = b.customItemName || b.package?.name || b.property?.name || b.cruise?.name || b.service?.name || b.visa?.country || b.itemType;
    
    if (['PACKAGE', 'PROPERTY', 'CRUISE'].includes(b.itemType)) {
      trips.push({ name: itemName, date: b.createdAt, status: b.status, amount: b.totalAmount });
    } else {
      services.push({ name: itemName, type: b.itemType, date: b.createdAt, status: b.status, amount: b.totalAmount });
    }
  });
  
  return { totalBilled, balanceDue, trips, services };
};

const EMPTY_CUSTOMER_FORM = {
  name: '',
  phone: '',
  notes: '',
};

export default function Customers() {
  const { data, isLoading } = useCustomers();
  const customers = data?.data || [];
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CUSTOMER_FORM);
  const createCustomer = useCreateCustomer();

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  async function handleCreateCustomer(e) {
    e.preventDefault();
    await createCustomer.mutateAsync({
      name: createForm.name.trim(),
      phone: createForm.phone.trim(),
      notes: createForm.notes.trim() || undefined,
    });
    setCreateForm(EMPTY_CUSTOMER_FORM);
    setIsCreateOpen(false);
  }

  return (
    <div className="w-full pb-10">
      {/* Actions */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setIsCreateOpen(true)}
          className="shell-button-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Customer
        </button>
      </div>

      {/* Customer Table */}
      <div className="mobile-card-list">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="mobile-record-card">
              <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, cell) => <div key={cell} className="h-10 animate-pulse rounded bg-neutral-100" />)}
              </div>
            </div>
          ))
        ) : customers.length === 0 ? (
          <div className="mobile-record-card text-center text-sm text-neutral-400">
            <div className="mb-2">No customers yet.</div>
            <button onClick={() => setIsCreateOpen(true)} className="font-semibold text-neutral-800 underline underline-offset-2">Create your first customer</button>
          </div>
        ) : (
          customers.map((customer) => {
            const stats = getCustomerStats(customer);
            return (
            <MobileRecordCard
              key={customer.id}
              title={customer.name || 'Traveler'}
              subtitle={formatPhone(customer.phone)}
              onClick={() => setSelectedCustomerId(customer.id)}
              avatar={
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
                  {getInitials(customer.name, 'C')}
                </div>
              }
              badge={customer.documents?.length > 0 ? <span className="badge bg-emerald-50 text-emerald-700">{customer.documents.length} file{customer.documents.length > 1 ? 's' : ''}</span> : null}
            >
              <MobileField label="Billed" value={formatCurrency(stats.totalBilled)} />
              <MobileField label="Due" value={<span className="text-rose-600 font-medium">{formatCurrency(stats.balanceDue)}</span>} />
              <MobileField label="Created" value={formatDate(customer.createdAt)} />
            </MobileRecordCard>
            );
          })
        )}
      </div>

      <div className="data-table-wrapper desktop-table">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="data-table-head">
                <th className="data-table-th w-16">SL NO</th>
                <th className="data-table-th">CUSTOMER</th>
                <th className="data-table-th">PHONE</th>
                <th className="data-table-th text-right">BILLED</th>
                <th className="data-table-th text-right">DUE</th>
                <th className="data-table-th">NOTES</th>
                <th className="data-table-th">CREATED</th>
                <th className="data-table-th">DOCUMENTS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-neutral-400">Loading customers...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center">
                    <div className="text-neutral-400 mb-2">No customers yet.</div>
                    <button onClick={() => setIsCreateOpen(true)} className="text-sm text-neutral-600 hover:text-neutral-900 font-medium underline underline-offset-2">Create your first customer</button>
                  </td>
                </tr>
              ) : (
                customers.map((customer, i) => {
                  const stats = getCustomerStats(customer);
                  return (
                  <tr
                    key={customer.id}
                    className="data-table-row group cursor-pointer"
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <td className="data-table-td text-neutral-400 font-medium">#{i + 1}</td>
                    <td className="data-table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-neutral-200">
                          {getInitials(customer.name, 'C')}
                        </div>
                        <span className="font-semibold text-neutral-900 text-sm">{customer.name || 'Traveler'}</span>
                      </div>
                    </td>
                    <td className="data-table-td text-neutral-500 text-sm">{formatPhone(customer.phone)}</td>
                    <td className="data-table-td text-neutral-900 font-medium text-sm text-right">{formatCurrency(stats.totalBilled)}</td>
                    <td className="data-table-td text-rose-600 font-medium text-sm text-right">{formatCurrency(stats.balanceDue)}</td>
                    <td className="data-table-td text-neutral-500 text-sm max-w-[200px] truncate">{customer.notes || <span className="text-neutral-300">—</span>}</td>
                    <td className="data-table-td text-neutral-500 text-sm">{formatDate(customer.createdAt)}</td>
                    <td className="data-table-td text-neutral-500 text-sm">
                      {customer.documents?.length > 0 ? (
                        <span className="badge bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5">{customer.documents.length} file{customer.documents.length > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Drawer */}
      <CustomerDrawer
        customer={selectedCustomer}
        onClose={() => setSelectedCustomerId(null)}
      />

      {/* Create Customer Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[18px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] sm:max-w-md sm:rounded-[18px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">New Customer</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Create Customer</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-[10px] p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Name</span>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="shell-input-rect"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Phone (+91...)</span>
                <input
                  required
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="shell-input-rect"
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Notes</span>
                <textarea
                  rows="3"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="shell-input-rect rounded-[14px]"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="shell-button-secondary">Cancel</button>
                <button type="submit" disabled={createCustomer.isPending} className="shell-button-primary">
                  {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


function CustomerDrawer({ customer, onClose }) {
  const [activeTab, setActiveTab] = useState('Profile');
  const { data: messagesResponse } = useMessages(customer?.id, { limit: 20 });
  const messages = messagesResponse?.data || [];
  const { data: ledgerResponse, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['customer-ledger', customer?.id],
    queryFn: () => accountsApi.report('party-statement', { partyType: 'CUSTOMER', partyId: customer.id }),
    enabled: Boolean(customer?.id),
  });
  const ledger = ledgerResponse?.data || { data: [], summary: { debit: 0, credit: 0, balance: 0 } };
  const { data: serviceReportResponse, isLoading: isServiceReportLoading } = useQuery({
    queryKey: ['customer-service-report', customer?.id],
    queryFn: () => customersApi.getServiceReport(customer.id),
    enabled: Boolean(customer?.id),
  });
  const serviceReport = serviceReportResponse?.data || {
    summary: { totalServices: 0, totalBilled: 0, totalReceived: 0, totalBalance: 0 },
    byCategory: [],
    services: [],
  };
  const { data: activityResponse, isLoading: isActivityLoading } = useQuery({
    queryKey: ['customer-activity', customer?.id],
    queryFn: () => customersApi.getActivity(customer.id),
    enabled: Boolean(customer?.id),
  });
  const activity = activityResponse?.data || { enquiries: [], timeline: [] };
  const uploadDocMutation = useUploadCustomerDocument();
  const fileInputRef = useRef(null);

  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    const formData = new FormData();
    formData.append('document', file);

    try {
      await uploadDocMutation.mutateAsync({ id: customer.id, formData });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to upload document', err);
      alert('Failed to upload document');
    }
  };

  if (!customer) return null;

  const DRAWER_TABS = [
    { key: 'Profile', icon: UserIcon },
    { key: 'Services', icon: CurrencyRupeeIcon },
    { key: 'Messages', icon: ChatBubbleLeftIcon },
    { key: 'Documents', icon: DocumentIcon },
    { key: 'Ledger', icon: CurrencyRupeeIcon },
    { key: 'Timeline', icon: ClockIcon },
  ];

  const stats = getCustomerStats(customer);

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full transform flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 sm:max-w-[520px]">

        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 p-4 sm:p-6">
          <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-600 font-bold flex items-center justify-center text-lg shrink-0 ring-2 ring-neutral-200">
              {getInitials(customer.name, 'C')}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 truncate">
                {customer.name || 'Traveler'}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge bg-emerald-50 text-emerald-700">CUSTOMER</span>
                <span className="text-neutral-300">•</span>
                <span className="text-xs text-neutral-400">{formatPhone(customer.phone)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-1 gap-y-4 gap-x-6 border-b border-neutral-100 px-4 py-4 text-sm sm:grid-cols-2 sm:px-6">
          <div>
            <div className="text-neutral-400 text-xs mb-1 font-medium flex items-center gap-1.5">
              <PhoneIcon className="w-3.5 h-3.5" />Phone
            </div>
            <div className="font-medium text-neutral-900">{formatPhone(customer.phone)}</div>
          </div>
          <div>
            <div className="text-neutral-400 text-xs mb-1 font-medium flex items-center gap-1.5">
              <CalendarDaysIcon className="w-3.5 h-3.5" />Created
            </div>
            <div className="font-medium text-neutral-900">{formatDateTime(customer.createdAt)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-neutral-400 text-xs mb-1 font-medium flex items-center gap-1.5">
              <PencilSquareIcon className="w-3.5 h-3.5" />Notes
            </div>
            <div className="font-medium text-neutral-900">{customer.notes || 'No notes yet.'}</div>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex shrink-0 gap-6 overflow-x-auto border-b border-neutral-100 px-4 sm:px-6 hide-scrollbar">
          {DRAWER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.key}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-4 sm:px-6 sm:py-6 hide-scrollbar">

          {/* Profile Tab */}
          {activeTab === 'Profile' && (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-5 shadow-sm">
                <h3 className="text-sm font-bold text-neutral-800 mb-4">Customer Information</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                    <span className="text-neutral-400 font-medium">Full Name</span>
                    <span className="text-neutral-900 font-medium">{customer.name || 'Traveler'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                    <span className="text-neutral-400 font-medium">Phone</span>
                    <span className="text-neutral-900 font-medium">{formatPhone(customer.phone)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                    <span className="text-neutral-400 font-medium">Created</span>
                    <span className="text-neutral-900 font-medium">{formatDateTime(customer.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                    <span className="text-neutral-400 font-medium">Source</span>
                    <span className="text-neutral-900 font-medium">{customer.source || 'Manual'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-neutral-400 font-medium">Documents</span>
                    <span className="text-neutral-900 font-medium">{customer.documents?.length || 0} files</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-5 shadow-sm">
                <h3 className="text-sm font-bold text-neutral-800 mb-4">Financial Overview</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                    <span className="text-neutral-400 font-medium">Total Billed</span>
                    <span className="text-neutral-900 font-medium">{formatCurrency(stats.totalBilled)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-neutral-400 font-medium">Total Due</span>
                    <span className="text-rose-600 font-medium">{formatCurrency(stats.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {(stats.trips.length > 0 || stats.services.length > 0) && (
                <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-neutral-800 mb-4">Booking History</h3>
                  <div className="space-y-4">
                    {stats.trips.map((trip, idx) => (
                      <div key={'trip-'+idx} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0 last:pb-0">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{trip.name}</div>
                          <div className="text-xs text-neutral-400 mt-0.5">{formatDate(trip.date)} • {trip.status}</div>
                        </div>
                        <div className="text-sm font-medium text-neutral-900">{formatCurrency(trip.amount)}</div>
                      </div>
                    ))}
                    {stats.services.map((service, idx) => (
                      <div key={'service-'+idx} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0 last:pb-0">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{service.name} <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded ml-1">{service.type}</span></div>
                          <div className="text-xs text-neutral-400 mt-0.5">{formatDate(service.date)} • {service.status}</div>
                        </div>
                        <div className="text-sm font-medium text-neutral-900">{formatCurrency(service.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customer.notes && (
                <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-neutral-800 mb-3">Notes</h3>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'Services' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Services</div>
                  <div className="mt-1 text-sm font-bold text-neutral-900">{serviceReport.summary.totalServices}</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Billed</div>
                  <div className="mt-1 text-sm font-bold text-neutral-900">{formatCurrency(serviceReport.summary.totalBilled)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Received</div>
                  <div className="mt-1 text-sm font-bold text-emerald-700">{formatCurrency(serviceReport.summary.totalReceived)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Balance</div>
                  <div className="mt-1 text-sm font-bold text-rose-600">{formatCurrency(serviceReport.summary.totalBalance)}</div>
                </div>
              </div>

              {serviceReport.byCategory.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-neutral-800">Service Category Summary</h3>
                  <div className="space-y-2">
                    {serviceReport.byCategory.map((category) => (
                      <div key={category.category} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                        <div>
                          <div className="font-semibold text-neutral-900">{category.category}</div>
                          <div className="text-xs text-neutral-400">{category.count} service{category.count === 1 ? '' : 's'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-neutral-900">{formatCurrency(category.totalAmount)}</div>
                          <div className="text-xs text-rose-500">Due {formatCurrency(category.balance)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    <tr>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {isServiceReportLoading ? (
                      <tr><td colSpan="4" className="px-3 py-8 text-center text-neutral-400">Loading service report...</td></tr>
                    ) : serviceReport.services.length === 0 ? (
                      <tr><td colSpan="4" className="px-3 py-8 text-center text-neutral-400">No standalone services for this customer.</td></tr>
                    ) : (
                      serviceReport.services.map((service) => (
                        <tr key={service.bookingId}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-neutral-800">{service.serviceName}</div>
                            <div className="text-xs text-neutral-400">{service.bookingRef} - {service.status}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{formatDate(service.serviceDate)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-neutral-900">{formatCurrency(service.totalAmount)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-rose-600">{formatCurrency(service.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'Messages' && (
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-10 bg-white border border-neutral-200 rounded-[var(--radius-md)]">
                  <ChatBubbleLeftIcon className="w-8 h-8 mx-auto text-neutral-300 mb-3" />
                  <div className="text-neutral-400 text-sm">No recent messages for this customer.</div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        message.direction === 'IN'
                          ? 'bg-sky-50 text-sky-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {message.direction === 'IN' ? 'Incoming' : 'Outgoing'}
                      </span>
                      <span className="text-xs text-neutral-400">{formatDateTime(message.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 break-words">{message.content || 'Media message'}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'Documents' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleUploadDocument}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDocMutation.isPending}
                  className="shell-button-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  {uploadDocMutation.isPending ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
              <div className="space-y-3">
                {!customer.documents || customer.documents.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-neutral-200 rounded-[var(--radius-md)]">
                    <DocumentIcon className="w-8 h-8 mx-auto text-neutral-300 mb-3" />
                    <div className="text-neutral-400 text-sm">No documents uploaded.</div>
                  </div>
              ) : (
                customer.documents.map((doc, idx) => (
                  <a
                    key={idx}
                    href={doc}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 bg-white border border-neutral-200 rounded-[var(--radius-md)] p-4 shadow-sm hover:border-neutral-300 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0 group-hover:bg-neutral-200 transition-colors">
                      <DocumentIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">Document {idx + 1}</p>
                      <p className="text-xs text-neutral-400 truncate">{doc}</p>
                    </div>
                  </a>
                ))
              )}
              </div>
            </div>
          )}

          {/* Ledger Tab */}
          {activeTab === 'Ledger' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Billed</div>
                  <div className="mt-1 text-sm font-bold text-neutral-900">{formatCurrency(ledger.summary?.debit || 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Received</div>
                  <div className="mt-1 text-sm font-bold text-neutral-900">{formatCurrency(ledger.summary?.credit || 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Balance</div>
                  <div className={`mt-1 text-sm font-bold ${(ledger.summary?.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(Math.abs(ledger.summary?.balance || 0))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Particulars</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {isLedgerLoading ? (
                      <tr><td colSpan="5" className="px-3 py-8 text-center text-neutral-400">Loading ledger...</td></tr>
                    ) : (ledger.data || []).length === 0 ? (
                      <tr><td colSpan="5" className="px-3 py-8 text-center text-neutral-400">No ledger entries yet.</td></tr>
                    ) : (
                      ledger.data.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{formatDate(row.date)}</td>
                          <td className="px-3 py-2 text-neutral-700">
                            <div className="font-medium">{row.description || row.type}</div>
                            <div className="text-xs text-neutral-400">{row.referenceNumber || row.type}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-700">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                          <td className="px-3 py-2 text-right text-neutral-700">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-neutral-900">{formatCurrency(Math.abs(row.runningBalance || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timeline Tab — unified lead/enquiry activity story */}
          {activeTab === 'Timeline' && (
            <div>
              {activity.enquiries.length > 1 && (
                <div className="mb-4 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500 shadow-sm">
                  This customer has <span className="font-bold text-neutral-800">{activity.enquiries.length} enquiries</span>. Their whole journey is merged below, newest first.
                </div>
              )}
              {isActivityLoading ? (
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white py-12 text-center text-sm text-neutral-400 shadow-sm">
                  Loading activity…
                </div>
              ) : (
                <ActivityTimeline
                  events={activity.timeline}
                  grouped={activity.enquiries.length > 1}
                  emptyText="No lead activity recorded for this customer yet."
                />
              )}
            </div>
          )}
        </div>

      </aside>
    </div>
  );
}
