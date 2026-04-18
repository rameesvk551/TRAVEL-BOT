import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AdjustmentsHorizontalIcon,
  EllipsisVerticalIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { useCreateLead, useLead, useLeads, useUpdateLead } from '../hooks/useLeads';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { formatDate, formatDateTime, formatPhone, formatTime, timeAgo } from '../utils/formatters';
import { LEAD_STATUS_OPTIONS } from '../utils/leadStatuses';
import { getInitials, getStatusTone } from '../components/uiHelpers';
import LeadPipeline from '../components/LeadPipeline';

const EMPTY_CREATE_FORM = {
  customerName: '',
  customerPhone: '',
  destination: '',
  travelDates: '',
  travellers: '2',
  budget: '',
  assignedAgentId: '',
  notes: '',
};

const EMPTY_EDIT_FORM = {
  status: 'NEW',
  assignedAgentId: '',
  destination: '',
  travelDates: '',
  travellers: '',
  budget: '',
  notes: '',
  lostReason: '',
};

const EMPTY_FOLLOWUP_FORM = {
  scheduledAt: '',
  note: '',
};

const FOLLOWUP_STORAGE_KEY = 'travel-bot.lead-followups';

function toBudgetPaise(value) {
  const numeric = Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!numeric) return undefined;
  return Math.round(numeric * 100);
}

function fromBudgetPaise(value) {
  if (!value) return '';
  return String(Math.round(value / 100));
}

function loadFollowups() {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.localStorage.getItem(FOLLOWUP_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function LeadDrawer({
  isOpen,
  lead,
  agents,
  quickFacts,
  editForm,
  setEditForm,
  onClose,
  onSaveLead,
  isSaving,
  followups,
  followupForm,
  setFollowupForm,
  onAddFollowup,
  onToggleFollowup,
  onDeleteFollowup,
}) {
  const sortedFollowups = useMemo(
    () => [...followups].sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt)),
    [followups]
  );

  if (!lead) return null;

  return (
    <div className={`fixed inset-0 z-50 transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="Close lead drawer"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[540px] flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)] transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Lead Details</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{lead.customer?.name || 'Traveler'}</h2>
              <p className="mt-1 text-sm text-slate-500">Open lead context, ownership, and scheduled follow-ups.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-[18px] border border-slate-200 bg-[#fbfcfd] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${getStatusTone(lead.status)}`}>{lead.status}</span>
              {lead.package?.name ? <span className="badge bg-slate-100 text-slate-600">{lead.package.name}</span> : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow icon={PhoneIcon} label="Phone" value={formatPhone(lead.customer?.phone) || 'Phone pending'} />
              <InfoRow icon={UserCircleIcon} label="Assigned to" value={lead.assignedAgent?.name || 'Unassigned concierge'} />
              <InfoRow icon={CalendarDaysIcon} label="Created" value={formatDateTime(lead.createdAt)} />
              <InfoRow label="Travel" value={lead.travelDates || 'Dates flexible'} />
            </div>

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <InfoRow label="Destination" value={lead.destination || 'Not specified'} />
              <InfoRow label="Travelers" value={lead.travellers ? `${lead.travellers} Person(s)` : 'Not specified'} />
              <InfoRow label="Budget per person" value={lead.budgetPerPerson ? `₹${fromBudgetPaise(lead.budgetPerPerson)}` : 'Not specified'} />
              <InfoRow label="Interest" value={lead.interest || 'Not specified'} />
            </div>

            <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Trip Notes</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{lead.notes || 'No notes added for this lead yet.'}</p>
            </div>

            <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Trip Brief</p>
              <div className="mt-3 space-y-3">
                {quickFacts.map((item) => (
                  <div key={item} className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={onSaveLead} className="mt-5 space-y-4 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Lead Controls</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950">Assign user and update status</h3>
              </div>
              <span className="text-xs text-slate-400">Saved through CRM</span>
            </div>

            <Field label="Status">
              <select
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                className="shell-input-rect"
              >
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </Field>

            <Field label="Assigned user">
              <select
                value={editForm.assignedAgentId}
                onChange={(event) => setEditForm((current) => ({ ...current, assignedAgentId: event.target.value }))}
                className="shell-input-rect"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Destination">
                <input
                  type="text"
                  value={editForm.destination}
                  onChange={(event) => setEditForm((current) => ({ ...current, destination: event.target.value }))}
                  className="shell-input-rect"
                />
              </Field>

              <Field label="Travel dates">
                <input
                  type="text"
                  value={editForm.travelDates}
                  onChange={(event) => setEditForm((current) => ({ ...current, travelDates: event.target.value }))}
                  className="shell-input-rect"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Budget per person">
                <input
                  type="number"
                  value={editForm.budget}
                  onChange={(event) => setEditForm((current) => ({ ...current, budget: event.target.value }))}
                  className="shell-input-rect"
                />
              </Field>

              <Field label="Travelers">
                <input
                  type="number"
                  min="1"
                  value={editForm.travellers}
                  onChange={(event) => setEditForm((current) => ({ ...current, travellers: event.target.value }))}
                  className="shell-input-rect"
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                rows="4"
                value={editForm.notes}
                onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                className="shell-input-rect rounded-[14px]"
              />
            </Field>

            <button type="submit" disabled={isSaving} className="shell-button-primary w-full">
              {isSaving ? 'Saving...' : 'Save lead changes'}
            </button>
          </form>

          <section className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Follow-ups</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950">Schedule next touchpoints</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                {sortedFollowups.length} scheduled
              </div>
            </div>

            <form onSubmit={onAddFollowup} className="mt-4 space-y-4">
              <Field label="Follow-up date & time">
                <input
                  type="datetime-local"
                  value={followupForm.scheduledAt}
                  onChange={(event) => setFollowupForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                  className="shell-input-rect"
                />
              </Field>

              <Field label="Follow-up note">
                <textarea
                  rows="3"
                  value={followupForm.note}
                  onChange={(event) => setFollowupForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Call back with updated package options, confirm budget, share quote..."
                  className="shell-input-rect rounded-[14px]"
                />
              </Field>

              <button type="submit" className="shell-button-primary w-full">
                Schedule follow-up
              </button>
            </form>

            <div className="mt-4 space-y-3">
              {sortedFollowups.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  No follow-ups scheduled for this lead yet.
                </div>
              ) : (
                sortedFollowups.map((followup) => (
                  <div key={followup.id} className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {followup.status}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{formatDateTime(followup.scheduledAt)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{followup.note || 'Follow-up note not provided.'}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {followup.status !== 'Done' ? (
                          <button
                            type="button"
                            onClick={() => onToggleFollowup(followup.id)}
                            className="rounded-[10px] p-2 text-emerald-600 transition hover:bg-emerald-50"
                            aria-label="Mark follow-up as done"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDeleteFollowup(followup.id)}
                          className="rounded-[10px] p-2 text-rose-500 transition hover:bg-rose-50"
                          aria-label="Delete follow-up"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 text-slate-400" /> : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const incoming = message.direction === 'IN';

  return (
    <div className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[720px] rounded-[16px] px-4 py-3 text-[15px] leading-7 ${
          incoming
            ? 'border border-slate-200 bg-white text-slate-700'
            : 'bg-[#0f766e] text-white'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`mt-2 text-[11px] font-medium ${incoming ? 'text-slate-400' : 'text-emerald-100/85'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function ConversationRow({ lead, selected, onSelect, agents, onStatusChange, onAssignAgent }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[14px] border px-4 py-3 text-left transition ${
        selected
          ? 'border-[#99ddd2] bg-[#f7fffd]'
          : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#34b6aa,#0f766e)] text-sm font-bold text-white">
          {getInitials(lead.customer?.name, 'TR')}
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${lead.status === 'CONVERTED' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{lead.customer?.name || 'Unnamed lead'}</p>
            <p className="shrink-0 text-[11px] font-medium text-slate-400">{timeAgo(lead.updatedAt || lead.createdAt)}</p>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{lead.destination || 'Trip details pending'}</p>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <select
                value={lead.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onStatusChange(lead.id, e.target.value)}
                className={`badge ${getStatusTone(lead.status)} border-transparent outline-none cursor-pointer hover:opacity-80 appearance-none text-center pb-[2px] pt-[2px]`}
            >
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            
            <select
                value={lead.assignedAgentId || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onAssignAgent(lead.id, e.target.value)}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 border-none outline-none cursor-pointer hover:bg-slate-200 appearance-none"
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>

            {lead.package?.name ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {lead.package.name}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Leads() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 50, status: '', search: '' });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [view, setView] = useState('list');
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [followupForm, setFollowupForm] = useState(EMPTY_FOLLOWUP_FORM);
  const [followupsByLeadId, setFollowupsByLeadId] = useState(() => loadFollowups());
  const [draftMessage, setDraftMessage] = useState('');

  const leadsQuery = useLeads(filters);
  const leadRows = leadsQuery.data?.data?.data || [];

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const activeLeadQuery = useLead(selectedLeadId);
  const activeLead = activeLeadQuery.data?.data;
  const customerId = activeLead?.customer?.id;
  const messagesQuery = useMessages(customerId, { limit: 50 });
  const sendMessage = useSendMessage();

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((response) => response.data),
  });

  const agents = agentsResponse?.data || [];
  const messages = messagesQuery.data?.data || activeLead?.messages || [];
  const activeFollowups = followupsByLeadId[activeLead?.id] || [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(followupsByLeadId));
  }, [followupsByLeadId]);

  useEffect(() => {
    if (!leadRows.length) {
      setSelectedLeadId(null);
      return;
    }

    const visible = leadRows.some((lead) => lead.id === selectedLeadId);
    if (!selectedLeadId || !visible) {
      setSelectedLeadId(leadRows[0].id);
    }
  }, [leadRows, selectedLeadId]);

  useEffect(() => {
    if (!activeLead) return;

    setEditForm({
      status: activeLead.status || 'NEW',
      assignedAgentId: activeLead.assignedAgentId || '',
      destination: activeLead.destination || '',
      travelDates: activeLead.travelDates || '',
      travellers: activeLead.travellers ? String(activeLead.travellers) : '',
      budget: fromBudgetPaise(activeLead.budgetPerPerson),
      notes: activeLead.notes || '',
      lostReason: activeLead.lostReason || '',
    });
    setFollowupForm(EMPTY_FOLLOWUP_FORM);
  }, [activeLead]);

  function handleSelectLead(leadId) {
    setSelectedLeadId(leadId);
    setIsDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
  }

  function handleAddFollowup(event) {
    event.preventDefault();
    if (!activeLead || !followupForm.scheduledAt.trim()) return;

    const nextFollowup = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      scheduledAt: new Date(followupForm.scheduledAt).toISOString(),
      note: followupForm.note.trim(),
      status: 'Scheduled',
      createdAt: new Date().toISOString(),
    };

    setFollowupsByLeadId((current) => ({
      ...current,
      [activeLead.id]: [...(current[activeLead.id] || []), nextFollowup],
    }));
    setFollowupForm(EMPTY_FOLLOWUP_FORM);
  }

  function handleToggleFollowup(followupId) {
    if (!activeLead) return;

    setFollowupsByLeadId((current) => ({
      ...current,
      [activeLead.id]: (current[activeLead.id] || []).map((followup) =>
        followup.id === followupId
          ? { ...followup, status: followup.status === 'Done' ? 'Scheduled' : 'Done' }
          : followup
      ),
    }));
  }

  function handleDeleteFollowup(followupId) {
    if (!activeLead) return;

    setFollowupsByLeadId((current) => ({
      ...current,
      [activeLead.id]: (current[activeLead.id] || []).filter((followup) => followup.id !== followupId),
    }));
  }

  const quickFacts = useMemo(() => {
    if (!activeLead) return [];
    return [
      activeLead.destination || 'Destination not yet defined',
      activeLead.travelDates || 'Dates flexible',
      activeLead.travellers ? `${activeLead.travellers} travelers` : 'Traveler count pending',
      activeLead.package?.name || 'Custom itinerary',
    ];
  }, [activeLead]);

  async function handleSaveLead(event) {
    event.preventDefault();
    if (!selectedLeadId) return;

    await updateLead.mutateAsync({
      id: selectedLeadId,
      data: {
        status: editForm.status,
        assignedAgentId: editForm.assignedAgentId || null,
        destination: editForm.destination.trim() || null,
        travelDates: editForm.travelDates.trim() || null,
        travellers: editForm.travellers ? Number(editForm.travellers) : null,
        budgetPerPerson: toBudgetPaise(editForm.budget) || null,
        notes: editForm.notes.trim() || null,
        lostReason: editForm.lostReason.trim() || null,
      },
    });
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!customerId || !draftMessage.trim()) return;

    await sendMessage.mutateAsync({
      customerId,
      content: draftMessage.trim(),
    });
    setDraftMessage('');
  }

  async function handleCreateLead(event) {
    event.preventDefault();

    const payload = {
      customerName: createForm.customerName.trim(),
      customerPhone: createForm.customerPhone.trim(),
      destination: createForm.destination.trim() || undefined,
      travelDates: createForm.travelDates.trim() || undefined,
      travellers: createForm.travellers ? Number(createForm.travellers) : undefined,
      budgetPerPerson: toBudgetPaise(createForm.budget),
      assignedAgentId: createForm.assignedAgentId || undefined,
      notes: createForm.notes.trim() || undefined,
    };

    const result = await createLead.mutateAsync(payload);
    setCreateForm(EMPTY_CREATE_FORM);
    setIsCreateOpen(false);
    setSelectedLeadId(result?.data?.id || null);
    setIsDrawerOpen(true);
  }

  async function handleQuickStatusChange(leadId, newStatus) {
    if (!leadId) return;
    await updateLead.mutateAsync({
      id: leadId,
      data: { status: newStatus },
    });
  }

  async function handleQuickAssignAgent(leadId, agentId) {
    if (!leadId) return;
    await updateLead.mutateAsync({
      id: leadId,
      data: { assignedAgentId: agentId || null },
    });
  }

  return (
    <div className="w-full">
      <section className="grid min-h-[calc(100vh-6.25rem)] overflow-hidden rounded-[16px] border border-slate-200 bg-white xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#fbfcfd] xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-[20px] font-bold tracking-tight text-slate-950">Inbox</h1>
                <div className="rounded-lg bg-slate-50 p-1 flex items-center text-sm">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={`px-3 py-1 rounded ${view === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('kanban')}
                    className={`px-3 py-1 rounded ${view === 'kanban' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Kanban
                  </button>
                </div>
              </div>

              <button type="button" className="rounded-[10px] p-2 text-slate-400 transition hover:bg-white hover:text-slate-700">
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{leadRows.length} active conversations</p>
          </div>

          <div className="hide-scrollbar max-h-[calc(100vh-14rem)] space-y-2 overflow-y-auto p-3">
            {leadsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
              ))
            ) : leadRows.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No conversations found.
              </div>
            ) : (
              leadRows.map((lead) => (
                <ConversationRow
                  key={lead.id}
                  lead={lead}
                  selected={lead.id === selectedLeadId}
                  onSelect={() => handleSelectLead(lead.id)}
                  agents={agents}
                  onStatusChange={handleQuickStatusChange}
                  onAssignAgent={handleQuickAssignAgent}
                />
              ))
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <button type="button" onClick={() => setIsCreateOpen(true)} className="shell-button-primary w-full">
              <PlusIcon className="h-4 w-4" />
              New Lead
            </button>
          </div>
        </aside>

        <div className="flex min-h-[calc(100vh-6.25rem)] flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            {!activeLead ? (
              <div className="text-sm text-slate-500">Select a conversation to begin.</div>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#34b6aa,#0f766e)] text-sm font-bold text-white">
                      {getInitials(activeLead.customer?.name, 'TR')}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[18px] font-semibold text-slate-950">{activeLead.customer?.name || 'Lead'}</h2>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Status: <span className="text-slate-700">{activeLead.status}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" className="shell-button-secondary">CRM Notes</button>
                  <button type="button" className="shell-button-primary">Create Booking</button>
                  <button type="button" className="rounded-[10px] p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </header>

          <div className="hide-scrollbar flex-1 overflow-y-auto bg-[#fcfcfd] px-5 py-5">
            {view === 'kanban' ? (
              <LeadPipeline onLeadClick={handleSelectLead} />
            ) : (
              (!activeLead ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No conversation selected.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                      {formatDate(activeLead.createdAt)}
                    </span>
                  </div>

                  {messages.length === 0 ? (
                    <div className="rounded-[14px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
                      No WhatsApp messages yet for this lead.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))
                  )}
                </div>
              ))
            )}
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-4">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={activeLead ? `Type a message to ${activeLead.customer?.name || 'this lead'}...` : 'Select a conversation to send messages'}
                disabled={!activeLead || sendMessage.isPending}
                className="flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!activeLead || !draftMessage.trim() || sendMessage.isPending}
                className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#0f766e] text-white transition hover:bg-[#0b5d54] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </form>
          </footer>
        </div>
      </section>

      <LeadDrawer
        isOpen={isDrawerOpen && !!activeLead}
        lead={activeLead}
        agents={agents}
        quickFacts={quickFacts}
        editForm={editForm}
        setEditForm={setEditForm}
        onClose={handleCloseDrawer}
        onSaveLead={handleSaveLead}
        isSaving={updateLead.isPending}
        followups={activeFollowups}
        followupForm={followupForm}
        setFollowupForm={setFollowupForm}
        onAddFollowup={handleAddFollowup}
        onToggleFollowup={handleToggleFollowup}
        onDeleteFollowup={handleDeleteFollowup}
      />

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">New Lead</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create manual inquiry</h2>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-[10px] p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
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

                <Field label="Assign agent">
                  <select
                    value={createForm.assignedAgentId}
                    onChange={(event) => setCreateForm((current) => ({ ...current, assignedAgentId: event.target.value }))}
                    className="shell-input-rect"
                  >
                    <option value="">Leave unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
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
