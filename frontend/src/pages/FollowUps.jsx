import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  XCircleIcon,
  FunnelIcon,
  BanknotesIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { useAddFollowUp, useFollowUps, useUpdateFollowUp } from '../hooks/useLeads';
import { useAuthStore } from '../store/authStore';
import { formatDateTime, formatPhone } from '../utils/formatters';
import { getInitials, getStatusTone } from '../components/uiHelpers';
import FollowUpCard from '../components/FollowUpCard';
import FollowUpTimeline from '../components/FollowUpTimeline';
import Pagination from '../components/Pagination';
import CompleteFollowUpModal from '../components/CompleteFollowUpModal';

const FILTERS = ['All', 'Upcoming', 'Overdue', 'Today', 'Done', 'Cancelled'];
const PAGE_SIZE = 12;

function getFollowUpTone(status) {
  const tones = {
    Scheduled: 'bg-indigo-100 text-indigo-700',
    Done: 'bg-emerald-100 text-emerald-700',
    Cancelled: 'bg-rose-100 text-rose-700',
  };
  return tones[status] || 'bg-slate-100 text-slate-600';
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function isOverdue(followUp) {
  return followUp?.status === 'Scheduled' && new Date(followUp.scheduledAt).getTime() < Date.now();
}

function getDefaultFollowupDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function FollowUps() {
  const agent = useAuthStore((state) => state.agent);
  const isAdmin = agent?.role === 'ADMIN';
  const [activeFilter, setActiveFilter] = useState('Today');
  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isStatsDrawerOpen, setIsStatsDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDoneFollowUp, setSelectedDoneFollowUp] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLeadSearch, setCreateLeadSearch] = useState('');
  const [createLeadId, setCreateLeadId] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createAgentId, setCreateAgentId] = useState('');

  const statusParam = ['Done', 'Cancelled'].includes(activeFilter)
    ? activeFilter
    : activeFilter === 'Upcoming' || activeFilter === 'Overdue' || activeFilter === 'Today'
      ? 'Scheduled'
      : undefined;

  const followUpsQuery = useFollowUps({
    page: currentPage,
    pageSize: activeFilter === 'Today' ? 1000 : PAGE_SIZE,
    status: statusParam,
    due: activeFilter === 'Overdue' ? 'overdue' : activeFilter === 'Today' ? 'today' : undefined,
    search: search || undefined,
    agentId: isAdmin && agentId ? agentId : undefined,
  });

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((r) => r.data),
    enabled: isAdmin,
  });

  const updateFollowUp = useUpdateFollowUp();
  const addFollowUp = useAddFollowUp();
  const agents = agentsResponse?.data || [];

  const createLeadsQuery = useQuery({
    queryKey: ['followup-create-leads', createLeadSearch],
    queryFn: () => client.get('/leads', {
      params: {
        page: 1,
        pageSize: 8,
        search: createLeadSearch.trim() || undefined,
        sortBy: 'newest',
      },
    }).then((r) => r.data),
    enabled: isCreateModalOpen,
  });

  const followUpsResponse = followUpsQuery.data?.data || {};
  const visibleFollowUps = followUpsResponse.data || [];
  const createLeadOptions = createLeadsQuery.data?.data?.data || [];
  const totalItems = Number(followUpsResponse.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const metrics = useMemo(() => {
    if (followUpsResponse.metrics) return followUpsResponse.metrics;
    return {
      scheduled: visibleFollowUps.filter((item) => item.status === 'Scheduled').length,
      overdue: visibleFollowUps.filter(isOverdue).length,
      today: visibleFollowUps.filter((item) => item.status === 'Scheduled' && isToday(item.scheduledAt)).length,
      done: visibleFollowUps.filter((item) => item.status === 'Done').length,
    };
  }, [followUpsResponse.metrics, visibleFollowUps]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, agentId, search]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [currentPage, safeCurrentPage]);

  function markStatus(followUp, status) {
    if (!followUp?.leadId || !followUp?.id) return;
    if (status === 'Done') {
      setSelectedDoneFollowUp(followUp);
      return;
    }
    updateFollowUp.mutate({
      id: followUp.leadId,
      followUpId: followUp.id,
      data: { status },
    });
  }

  function openCreateModal() {
    setIsCreateModalOpen(true);
    setCreateLeadSearch('');
    setCreateLeadId('');
    setCreateDate(getDefaultFollowupDateTime());
    setCreateNote('');
    setCreateAgentId(isAdmin && agentId ? agentId : '');
  }

  function closeCreateModal() {
    if (addFollowUp.isPending) return;
    setIsCreateModalOpen(false);
    setCreateLeadSearch('');
    setCreateLeadId('');
    setCreateDate('');
    setCreateNote('');
    setCreateAgentId('');
  }

  function handleCreateFollowUp(event) {
    event.preventDefault();
    if (!createLeadId || !createDate || !createNote.trim()) return;

    addFollowUp.mutate(
      {
        id: createLeadId,
        data: {
          scheduledAt: new Date(createDate).toISOString(),
          note: createNote.trim(),
          ...(isAdmin && createAgentId ? { agentId: createAgentId } : {}),
        },
      },
      {
        onSuccess: closeCreateModal,
      }
    );
  }

  return (
    <div className="w-full pb-10">
      {/* ── Header ── */}
      <div className="mb-4 md:mb-8">
        <div className="sr-only">Follow-ups</div>

        {/* Mobile Action Bar */}
        <div className="mb-3 flex items-center gap-2 md:hidden">
          <button
            onClick={() => setIsStatsDrawerOpen(true)}
            className="shell-button-secondary h-10 px-4 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50"
          >
            Summary
          </button>

          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className="relative shell-button-secondary h-10 px-4 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50"
          >
            <FunnelIcon className="h-4 w-4 inline mr-2" />
            Filter
            {agentId && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="shell-button-primary h-10 flex-1 justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold shadow-sm hover:bg-black flex items-center gap-1 ml-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Follow-ups</h1>
            <p className="mt-1.5 text-sm font-medium text-neutral-500">
              {isAdmin ? 'Track every scheduled lead follow-up across the agency.' : 'Track your scheduled lead follow-ups.'}
            </p>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAdmin && (
              <select
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className="shell-input-rect h-11 bg-white sm:w-52"
              >
                <option value="">All users</option>
                {agents.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="shell-button-primary h-11 px-4 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Add Follow-up
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 hidden md:grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="kpi-icon bg-indigo-50 text-indigo-600"><ClockIcon className="h-5 w-5" /></div>
            <div>
              <div className="text-2xl font-bold leading-none text-neutral-900">{metrics.scheduled}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Scheduled</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="kpi-icon bg-rose-50 text-rose-600"><XCircleIcon className="h-5 w-5" /></div>
            <div>
              <div className="text-2xl font-bold leading-none text-neutral-900">{metrics.overdue}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Overdue</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="kpi-icon bg-amber-50 text-amber-600"><CalendarDaysIcon className="h-5 w-5" /></div>
            <div>
              <div className="text-2xl font-bold leading-none text-neutral-900">{metrics.today}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Today</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="kpi-icon bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-5 w-5" /></div>
            <div>
              <div className="text-2xl font-bold leading-none text-neutral-900">{metrics.done}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Done</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Tabs ── */}
      <div className="mb-4 flex flex-col gap-3 md:mb-6">
        <div className="relative w-full group md:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search name, phone, destination..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="shell-input-rect h-10 rounded-xl border-neutral-200 bg-white pl-10 text-sm shadow-sm focus:border-neutral-400 focus:ring-0 md:h-12 md:pl-11"
          />
        </div>
        
        <div className="flex gap-0.5 overflow-x-auto hide-scrollbar border-b border-neutral-100">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors md:px-4 md:text-sm ${
                activeFilter === filter
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic View based on filter */}
      {activeFilter === 'Today' ? (
        <div className="flex justify-center w-full py-4 md:py-8">
          <FollowUpTimeline followUps={visibleFollowUps} onStatusChange={markStatus} />
        </div>
      ) : (
        <>
      {/* Mobile Card List */}
      <div className="md:hidden">
        {followUpsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full bg-neutral-100" />
                  <div className="flex-1 space-y-1.5"><div className="h-3.5 w-2/3 rounded bg-neutral-100" /><div className="h-2.5 w-1/3 rounded bg-neutral-100" /></div>
                </div>
                <div className="space-y-2"><div className="h-3 w-full rounded bg-neutral-100" /><div className="h-3 w-1/2 rounded bg-neutral-100" /></div>
              </div>
            ))}
          </div>
        ) : visibleFollowUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-neutral-200 bg-white">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50">
              <ClockIcon className="h-8 w-8 text-neutral-300" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">No follow-ups found</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500">Try a different filter, user, or search term.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFollowUps.map((followUp) => (
              <FollowUpCard 
                key={followUp.id} 
                followUp={followUp} 
                onStatusChange={markStatus} 
                agents={agents}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block data-table-wrapper">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="data-table-head">
                <th className="data-table-th">Due</th>
                <th className="data-table-th">Lead</th>
                <th className="data-table-th">Trip</th>
                <th className="data-table-th">Note</th>
                <th className="data-table-th">Assigned</th>
                <th className="data-table-th">Status</th>
                <th className="data-table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {followUpsQuery.isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-sm text-neutral-400">Loading follow-ups...</td>
                </tr>
              ) : visibleFollowUps.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50">
                        <ClockIcon className="h-8 w-8 text-neutral-300" />
                      </div>
                      <h3 className="text-lg font-bold text-neutral-900">No follow-ups found</h3>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Try a different filter, user, or search term.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleFollowUps.map((followUp) => {
                  const lead = followUp.lead || {};
                  const customer = lead.customer || {};
                  const overdue = isOverdue(followUp);

                  return (
                    <tr key={followUp.id} className="data-table-row cursor-default">
                      <td className="data-table-td">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${overdue ? 'text-rose-600' : 'text-neutral-800'}`}>
                            {formatDateTime(followUp.scheduledAt)}
                          </span>
                          {overdue && <span className="mt-1 text-xs font-semibold text-rose-500">Overdue</span>}
                        </div>
                      </td>
                      <td className="data-table-td">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
                            {getInitials(customer.name, 'L')}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">{customer.name || 'Unnamed Lead'}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">{formatPhone(customer.phone) || customer.email || 'No contact'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="data-table-td">
                        <div className="max-w-[190px]">
                          <p className="truncate text-sm font-medium text-neutral-700">{lead.destination || 'Not specified'}</p>
                          <span className={`badge ${getStatusTone(lead.status)} mt-1 px-2 py-0.5 text-[9px]`}>
                            {lead.status?.replace(/_/g, ' ') || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="data-table-td">
                        <p className="line-clamp-2 max-w-[280px] text-sm leading-6 text-neutral-600">{followUp.note || '-'}</p>
                      </td>
                      <td className="data-table-td">
                        <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                          <UserCircleIcon className="h-5 w-5 text-neutral-300" />
                          {followUp.agent?.name || lead.assignedAgent?.name || 'Unassigned'}
                        </div>
                      </td>
                      <td className="data-table-td">
                        <span className={`badge ${getFollowUpTone(followUp.status)}`}>{followUp.status}</span>
                      </td>
                      <td className="data-table-td">
                        <div className="flex justify-end gap-2">
                          {followUp.status === 'Scheduled' && (
                            <>
                              <button
                                onClick={() => markStatus(followUp, 'Done')}
                                disabled={updateFollowUp.isPending}
                                className="shell-button-secondary px-3 py-1.5 text-xs"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                Done
                              </button>
                              <button
                                onClick={() => markStatus(followUp, 'Cancelled')}
                                disabled={updateFollowUp.isPending}
                                className="shell-button-ghost px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {!followUpsQuery.isLoading && !followUpsQuery.isError && totalItems > 0 && activeFilter !== 'Today' && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="follow-ups"
        />
      )}

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        agentId={agentId}
        setAgentId={setAgentId}
        clearFilters={() => { setSearch(''); setActiveFilter('Upcoming'); setAgentId(''); setIsFilterDrawerOpen(false); }}
        agents={agents}
      />

      <StatsDrawer isOpen={isStatsDrawerOpen} onClose={() => setIsStatsDrawerOpen(false)} metrics={metrics} />

      <CreateFollowUpModal
        agents={agents}
        agentId={createAgentId}
        date={createDate}
        isAdmin={isAdmin}
        isLoadingLeads={createLeadsQuery.isLoading}
        isOpen={isCreateModalOpen}
        isSaving={addFollowUp.isPending}
        leadId={createLeadId}
        leads={createLeadOptions}
        note={createNote}
        search={createLeadSearch}
        onAgentChange={setCreateAgentId}
        onClose={closeCreateModal}
        onDateChange={setCreateDate}
        onLeadChange={setCreateLeadId}
        onNoteChange={setCreateNote}
        onSearchChange={setCreateLeadSearch}
        onSubmit={handleCreateFollowUp}
      />

      <CompleteFollowUpModal
        isOpen={!!selectedDoneFollowUp}
        onClose={() => setSelectedDoneFollowUp(null)}
        followUp={selectedDoneFollowUp}
        lead={selectedDoneFollowUp?.lead}
        agentId={agentId || agent?.id}
      />
    </div>
  );
}

function CreateFollowUpModal({
  agents,
  agentId,
  date,
  isAdmin,
  isLoadingLeads,
  isOpen,
  isSaving,
  leadId,
  leads,
  note,
  search,
  onAgentChange,
  onClose,
  onDateChange,
  onLeadChange,
  onNoteChange,
  onSearchChange,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Create Follow-up</h3>
            <p className="mt-1 text-sm text-neutral-500">Choose a lead and schedule the next action.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Find Lead</span>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="shell-input-rect h-11 w-full bg-neutral-50 pl-10 text-sm"
                placeholder="Search customer, phone, destination..."
              />
            </div>
          </label>

          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Lead</span>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-2">
              {isLoadingLeads ? (
                <p className="px-3 py-6 text-center text-sm text-neutral-400">Loading leads...</p>
              ) : leads.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-neutral-400">No matching leads found.</p>
              ) : (
                leads.map((lead) => {
                  const customer = lead.customer || {};
                  const selected = String(lead.id) === String(leadId);
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => onLeadChange(lead.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-neutral-900 bg-white shadow-sm'
                          : 'border-transparent bg-white hover:border-neutral-200'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                        {getInitials(customer.name, 'L')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{customer.name || 'Unnamed Lead'}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {[formatPhone(customer.phone), lead.destination].filter(Boolean).join(' - ') || customer.email || 'No contact'}
                        </p>
                      </div>
                      <span className={`h-3 w-3 rounded-full border ${selected ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300'}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Date & Time</span>
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="shell-input-rect h-11 w-full bg-neutral-50 text-sm"
            />
          </label>

          {isAdmin && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Assign To</span>
              <select
                value={agentId}
                onChange={(event) => onAgentChange(event.target.value)}
                className="shell-input-rect h-11 w-full bg-neutral-50 text-sm"
              >
                <option value="">Lead owner</option>
                {agents.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Note</span>
            <textarea
              required
              rows="3"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              className="shell-input-rect w-full resize-none bg-neutral-50 py-2 text-sm"
              placeholder="Call back regarding package, pricing, or availability"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 bg-neutral-50/60 p-5">
          <button type="button" onClick={onClose} className="shell-button-secondary h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !leadId || !date || !note.trim()}
            className="shell-button-primary h-10 px-5 text-sm disabled:opacity-60"
          >
            {isSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FilterDrawer({ isOpen, onClose, agentId, setAgentId, clearFilters, agents }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-white max-h-[85vh] flex flex-col shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-neutral-500" /> Filters
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Staff</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="shell-input-rect w-full h-11 bg-neutral-50 text-sm">
              <option value="">All Staff</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-neutral-100 p-4 flex gap-3 bg-neutral-50/50">
          <button onClick={clearFilters} className="flex-1 shell-button-secondary h-11 text-sm bg-white">Clear All</button>
          <button onClick={onClose} className="flex-1 shell-button-primary h-11 text-sm">Show Results</button>
        </div>
      </div>
    </div>
  );
}

function StatsDrawer({ isOpen, onClose, metrics }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-neutral-50 max-h-[85vh] flex flex-col shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-neutral-500" /> Follow-up Stats
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="kpi-card w-full bg-white">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="kpi-icon bg-indigo-50 text-indigo-600"><ClockIcon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-none text-neutral-900 md:text-2xl">{metrics.scheduled}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Scheduled</div>
              </div>
            </div>
          </div>
          <div className="kpi-card w-full bg-white">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="kpi-icon bg-rose-50 text-rose-600"><XCircleIcon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-none text-neutral-900 md:text-2xl">{metrics.overdue}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Overdue</div>
              </div>
            </div>
          </div>
          <div className="kpi-card w-full bg-white">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="kpi-icon bg-amber-50 text-amber-600"><CalendarDaysIcon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-none text-neutral-900 md:text-2xl">{metrics.today}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Today</div>
              </div>
            </div>
          </div>
          <div className="kpi-card w-full bg-white">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="kpi-icon bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-none text-neutral-900 md:text-2xl">{metrics.done}</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Done</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
