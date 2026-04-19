import { useState } from 'react';
import { PlusIcon, XMarkIcon, UserIcon, ChatBubbleLeftIcon, DocumentIcon, PhoneIcon, CalendarDaysIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useCustomers, useCreateCustomer } from '../api/customersApi';
import { useMessages } from '../hooks/useMessages';
import { formatDate, formatDateTime, formatPhone } from '../utils/formatters';
import { getInitials } from '../components/uiHelpers';

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
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="page-heading">Customers</h1>
          <p className="page-subtext">View CONVERTED leads and manually created customers.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="shell-button-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Customer
        </button>
      </div>

      {/* Customer Table */}
      <div className="data-table-wrapper">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="data-table-head">
                <th className="data-table-th w-16">SL NO</th>
                <th className="data-table-th">CUSTOMER</th>
                <th className="data-table-th">PHONE</th>
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
                customers.map((customer, i) => (
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
                ))
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
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

  if (!customer) return null;

  const DRAWER_TABS = [
    { key: 'Profile', icon: UserIcon },
    { key: 'Messages', icon: ChatBubbleLeftIcon },
    { key: 'Documents', icon: DocumentIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-neutral-200 bg-white shadow-2xl flex flex-col transform transition-transform duration-300">

        {/* Drawer Header */}
        <div className="p-6 border-b border-neutral-100 flex items-start justify-between">
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
        <div className="px-6 py-4 grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-b border-neutral-100">
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
        <div className="border-b border-neutral-100 px-6 flex gap-6 overflow-x-auto hide-scrollbar shrink-0">
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
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-neutral-50/50 hide-scrollbar">

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

              {customer.notes && (
                <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-neutral-800 mb-3">Notes</h3>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
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
          )}
        </div>

      </aside>
    </div>
  );
}
