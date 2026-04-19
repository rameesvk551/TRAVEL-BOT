import { useEffect, useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCustomers, useCreateCustomer } from '../api/customersApi';
import { useMessages } from '../hooks/useMessages';
import { formatDate, formatDateTime, formatPhone } from '../utils/formatters';

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

  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomerId || !customers.some((c) => c.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const { data: messagesResponse } = useMessages(selectedCustomer?.id, { limit: 20 });
  const messages = messagesResponse?.data || [];

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
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Customers</h1>
          <p className="text-sm text-slate-500">View CONVERTED leads and manually created customers.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="shell-button-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Customer
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[12px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-950">Customers List</h1>
          </div>

          <div className="hide-scrollbar max-h-[760px] space-y-1 overflow-y-auto p-2">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-[10px] bg-slate-100" />)
            ) : customers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No customers yet.</div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`w-full rounded-[10px] px-3 py-3 text-left transition ${
                    customer.id === selectedCustomerId ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900">{customer.name || 'Traveler'}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatPhone(customer.phone)}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        {!selectedCustomer ? (
          <div className="rounded-[12px] border border-slate-200 bg-white p-8 text-sm text-slate-500">Select a customer to view details.</div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-[12px] border border-slate-200 bg-white px-5 py-4">
              <h1 className="text-[24px] font-semibold tracking-tight text-slate-950">{selectedCustomer.name || 'Traveler'}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge bg-[#ebebeb] text-[#2d2d2d]">CUSTOMER</span>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[12px] border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-950">Profile</h2>
                </div>
                <div className="space-y-4 px-4 py-4 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Phone</p>
                    <p className="mt-1 text-slate-700">{formatPhone(selectedCustomer.phone)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Created</p>
                    <p className="mt-1 text-slate-700">{formatDateTime(selectedCustomer.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notes</p>
                    <p className="mt-1 text-slate-700">{selectedCustomer.notes || 'No notes yet.'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[12px] border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-950">Recent Messages</h2>
                  </div>
                  <div className="hide-scrollbar max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
                    {messages.length === 0 ? (
                      <p className="text-sm text-slate-500">No recent messages for this customer.</p>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${message.direction === 'IN' ? 'text-slate-500' : 'text-[#0f766e]'}`}>
                              {message.direction === 'IN' ? 'Incoming' : 'Outgoing'}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(message.timestamp)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{message.content || 'Media message'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-[12px] border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-950">Documents</h2>
                  </div>
                  <div className="hide-scrollbar max-h-[300px] space-y-3 overflow-y-auto px-4 py-4">
                    {!selectedCustomer.documents || selectedCustomer.documents.length === 0 ? (
                      <p className="text-sm text-slate-500">No documents uploaded.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {selectedCustomer.documents.map((doc, idx) => (
                                <a key={idx} href={doc} target="_blank" rel="noreferrer" className="text-sm text-[#0f766e] hover:underline break-all">
                                    Document {idx + 1}
                                </a>
                            ))}
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">New Customer</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create Customer</h2>
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
