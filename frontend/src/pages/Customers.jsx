import { useEffect, useMemo, useState } from 'react';
import { useLeads } from '../hooks/useLeads';
import { useMessages } from '../hooks/useMessages';
import { formatDate, formatDateTime, formatPhone } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';

function buildCustomers(leads) {
  const map = new Map();

  leads.forEach((lead) => {
    if (!lead.customer) return;
    const existing = map.get(lead.customer.id);
    if (!existing || new Date(lead.updatedAt || lead.createdAt) > new Date(existing.latestLead.updatedAt || existing.latestLead.createdAt)) {
      map.set(lead.customer.id, {
        ...lead.customer,
        latestLead: lead,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => new Date(b.latestLead.updatedAt || b.latestLead.createdAt) - new Date(a.latestLead.updatedAt || a.latestLead.createdAt));
}

export default function Customers() {
  const { data, isLoading } = useLeads({ pageSize: 200 });
  const customers = useMemo(() => buildCustomers(data?.data?.data || []), [data]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomerId || !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const latestLead = selectedCustomer?.latestLead;
  const { data: messagesResponse } = useMessages(selectedCustomer?.id, { limit: 20 });
  const messages = messagesResponse?.data || [];

  return (
    <div className="w-full">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[12px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-950">Clients</h1>
            <p className="text-sm text-slate-500">Traveler records and latest activity</p>
          </div>

          <div className="hide-scrollbar max-h-[760px] space-y-1 overflow-y-auto p-2">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-[10px] bg-slate-100" />)
            ) : customers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No customer profiles yet.</div>
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
                  <p className="mt-1 text-sm text-slate-500">{customer.latestLead?.destination || 'Destination pending'}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        {!selectedCustomer ? (
          <div className="rounded-[12px] border border-slate-200 bg-white p-8 text-sm text-slate-500">Select a client to view details.</div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-[12px] border border-slate-200 bg-white px-5 py-4">
              <h1 className="text-[24px] font-semibold tracking-tight text-slate-950">{selectedCustomer.name || 'Traveler'}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`badge ${getStatusTone(latestLead?.status)}`}>{latestLead?.status || 'NEW'}</span>
                <span className="text-sm text-slate-500">{latestLead?.destination || 'Trip brief pending'}</span>
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
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Lead owner</p>
                    <p className="mt-1 text-slate-700">{latestLead?.assignedAgent?.name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Travel dates</p>
                    <p className="mt-1 text-slate-700">{latestLead?.travelDates || 'Flexible'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Created</p>
                    <p className="mt-1 text-slate-700">{formatDateTime(latestLead?.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notes</p>
                    <p className="mt-1 text-slate-700">{latestLead?.notes || 'No notes yet.'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[12px] border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-950">Recent Messages</h2>
                </div>
                <div className="hide-scrollbar max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent messages for this client.</p>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${message.direction === 'IN' ? 'text-slate-500' : 'text-[#0f766e]'}`}>
                            {message.direction === 'IN' ? 'Incoming' : 'Outgoing'}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(message.timestamp)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{message.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
