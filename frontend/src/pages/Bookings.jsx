import { useState } from 'react';
import { ListBulletIcon, PlusIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCreateLead, useLeads } from '../hooks/useLeads';
import { formatCurrency } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';
import { LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';

const EMPTY_CREATE_FORM = {
  customerName: '',
  customerPhone: '',
  destination: '',
  travelDates: '',
  travellers: '2',
  budget: '',
  notes: '',
};

function toBudgetPaise(value) {
  const numeric = Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!numeric) return undefined;
  return Math.round(numeric * 100);
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function Bookings() {
  const [viewMode, setViewMode] = useState('kanban');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const createLead = useCreateLead();
  const leads = data?.data?.data || [];
  const viewModes = [
    { key: 'kanban', label: 'Kanban', icon: Squares2X2Icon },
    { key: 'list', label: 'List', icon: ListBulletIcon },
  ];

  async function handleCreateLead(event) {
    event.preventDefault();

    await createLead.mutateAsync({
      customerName: createForm.customerName.trim(),
      customerPhone: createForm.customerPhone.trim(),
      destination: createForm.destination.trim() || undefined,
      travelDates: createForm.travelDates.trim() || undefined,
      travellers: createForm.travellers ? Number(createForm.travellers) : undefined,
      budgetPerPerson: toBudgetPaise(createForm.budget),
      notes: createForm.notes.trim() || undefined,
    });

    setCreateForm(EMPTY_CREATE_FORM);
    setIsCreateOpen(false);
  }

  return (
    <div className="w-full space-y-4">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Leads</h1>
          <p className="text-sm text-slate-500">Track every lead in Kanban view or listing view.</p>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="shell-button-primary inline-flex w-full items-center justify-center gap-2 md:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            New Lead
          </button>

          <div className="inline-flex w-full rounded-[14px] border border-slate-200 bg-white p-1 md:w-auto">
            {viewModes.map(({ key, label, icon: Icon }) => {
              const active = viewMode === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition md:flex-none ${
                    active ? 'bg-[#0d6a5f] text-white shadow-[0_8px_18px_-14px_rgba(13,106,95,0.55)]' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {viewMode === 'kanban' ? (
        <section className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
          {LEAD_PIPELINE_COLUMNS.map((column) => {
            const items = leads.filter((lead) => lead.status === column.key);

            return (
              <div key={column.key} className="min-h-[420px] w-[280px] shrink-0 rounded-[12px] border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{column.label}</p>
                  <span className={`badge ${getStatusTone(column.key)}`}>{items.length}</span>
                </div>

                <div className="space-y-2 p-3">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-28 animate-pulse rounded-[10px] bg-slate-100" />
                    ))
                  ) : items.length === 0 ? (
                    <div className="rounded-[10px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">No leads here.</div>
                  ) : (
                    items.map((lead) => (
                      <div key={lead.id} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-900">{lead.customer?.name || 'Guest lead'}</p>
                        <p className="mt-1 text-sm text-slate-600">{lead.destination || lead.package?.name || 'Trip brief pending'}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400">{lead.travelDates || 'Dates pending'}</span>
                          <span className="text-sm font-semibold text-slate-700">
                            {lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : 'Budget TBD'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Lead', 'Trip', 'Status', 'Travel Dates', 'Budget'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 5 }).map((_, cell) => (
                        <td key={cell} className="px-4 py-4">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-slate-500">No leads found.</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{lead.customer?.name || 'Guest lead'}</p>
                        <p className="mt-1 text-sm text-slate-500">{lead.customer?.phone || lead.customer?.email || 'No contact details'}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{lead.destination || lead.package?.name || 'Trip brief pending'}</td>
                      <td className="px-4 py-4">
                        <span className={`badge ${getStatusTone(lead.status || 'NEW')}`}>{lead.status || 'NEW'}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{lead.travelDates || 'Dates pending'}</td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">
                        {lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : 'Budget TBD'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">New Lead</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create manual inquiry</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-[10px] p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer name">
                  <input
                    required
                    value={createForm.customerName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, customerName: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>

                <Field label="Customer phone">
                  <input
                    required
                    value={createForm.customerPhone}
                    onChange={(event) => setCreateForm((current) => ({ ...current, customerPhone: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>

                <Field label="Destination">
                  <input
                    value={createForm.destination}
                    onChange={(event) => setCreateForm((current) => ({ ...current, destination: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>

                <Field label="Travel dates">
                  <input
                    value={createForm.travelDates}
                    onChange={(event) => setCreateForm((current) => ({ ...current, travelDates: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>

                <Field label="Travelers">
                  <input
                    type="number"
                    min="1"
                    value={createForm.travellers}
                    onChange={(event) => setCreateForm((current) => ({ ...current, travellers: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>

                <Field label="Budget per person">
                  <input
                    type="number"
                    min="0"
                    value={createForm.budget}
                    onChange={(event) => setCreateForm((current) => ({ ...current, budget: event.target.value }))}
                    className="shell-input-rect"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  rows="4"
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                  className="shell-input-rect rounded-[14px]"
                />
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="shell-button-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={createLead.isPending} className="shell-button-primary">
                  {createLead.isPending ? 'Creating...' : 'Create lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
