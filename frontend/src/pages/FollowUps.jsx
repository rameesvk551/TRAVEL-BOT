import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { useFollowUps, useUpdateFollowUp } from '../hooks/useLeads';
import { useAuthStore } from '../store/authStore';
import { formatDateTime, formatPhone } from '../utils/formatters';
import { getInitials, getStatusTone } from '../components/uiHelpers';

const FILTERS = ['All', 'Upcoming', 'Overdue', 'Today', 'Done', 'Cancelled'];

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

export default function FollowUps() {
  const agent = useAuthStore((state) => state.agent);
  const isAdmin = agent?.role === 'ADMIN';
  const [activeFilter, setActiveFilter] = useState('Upcoming');
  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState('');

  const statusParam = ['Done', 'Cancelled'].includes(activeFilter)
    ? activeFilter
    : activeFilter === 'Upcoming' || activeFilter === 'Overdue' || activeFilter === 'Today'
      ? 'Scheduled'
      : undefined;

  const followUpsQuery = useFollowUps({
    pageSize: 200,
    status: statusParam,
    search: search || undefined,
    agentId: isAdmin && agentId ? agentId : undefined,
  });

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((r) => r.data),
    enabled: isAdmin,
  });

  const updateFollowUp = useUpdateFollowUp();
  const agents = agentsResponse?.data || [];
  const followUps = followUpsQuery.data?.data?.data || [];

  const visibleFollowUps = useMemo(() => {
    if (activeFilter === 'Overdue') return followUps.filter(isOverdue);
    if (activeFilter === 'Today') return followUps.filter((item) => item.status === 'Scheduled' && isToday(item.scheduledAt));
    return followUps;
  }, [activeFilter, followUps]);

  const metrics = useMemo(() => {
    return {
      scheduled: followUps.filter((item) => item.status === 'Scheduled').length,
      overdue: followUps.filter(isOverdue).length,
      today: followUps.filter((item) => item.status === 'Scheduled' && isToday(item.scheduledAt)).length,
      done: followUps.filter((item) => item.status === 'Done').length,
    };
  }, [followUps]);

  function markStatus(followUp, status) {
    if (!followUp?.leadId || !followUp?.id) return;
    updateFollowUp.mutate({
      id: followUp.leadId,
      followUpId: followUp.id,
      data: { status },
    });
  }

  return (
    <div className="w-full pb-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Follow-ups</h1>
          <p className="mt-1.5 text-sm font-medium text-neutral-500">
            {isAdmin ? 'Track every scheduled lead follow-up across the agency.' : 'Track your scheduled lead follow-ups.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="shell-input-rect h-11 bg-white pl-11"
              placeholder="Search customer, phone, destination..."
            />
          </div>

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
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
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

      <div className="mb-4 flex gap-1 overflow-x-auto hide-scrollbar">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              activeFilter === filter
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-400 hover:border-neutral-300 hover:text-neutral-600'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="data-table-wrapper">
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
    </div>
  );
}
