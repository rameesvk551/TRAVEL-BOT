import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  BanknotesIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  TagIcon,
  TrophyIcon,
  UserPlusIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import {
  useAddFollowUp,
  useAddNote,
  useBulkAssignLeads,
  useLead,
  useLeads,
  useUpdateFollowUp,
  useUpdateLead,
} from '../hooks/useLeads';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDate, formatDateTime, formatPhone, timeAgo } from '../utils/formatters';
import { LEAD_STATUS_OPTIONS, LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';
import {
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  formatSource,
  formatStatus,
  getActivityLabel,
  getAttentionBadges,
  getLeadScore,
  getLeadScoreTone,
  getLeadValueLabel,
  getNextAction,
  getNextFollowUp,
  matchesAgent,
  matchesDateRange,
  matchesSource,
  matchesTag,
  needsAttention,
  sortLeads,
} from '../utils/leadInsights';
import { getInitials, getStatusTone } from '../components/uiHelpers';
import LeadPipeline from '../components/LeadPipeline';
import NewLeadModal from '../components/NewLeadModal';

const TABS = [
  { key: 'Needs Attention', label: 'Needs Attention' },
  { key: 'All Leads', label: 'All Leads' },
  ...LEAD_PIPELINE_COLUMNS.map((column) => ({ key: column.key, label: column.label })),
];

const EMPTY = '-';

export default function Leads() {
  const [activeTab, setActiveTab] = useState('Needs Attention');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('overdue');
  const [dateRange, setDateRange] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());

  const currentAgent = useAuthStore((state) => state.agent);
  const leadsQuery = useLeads({ pageSize: 200 });
  const leads = leadsQuery.data?.data?.data || [];

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((response) => response.data),
  });
  const agents = agentsResponse?.data || [];
  const updateLead = useUpdateLead();
  const bulkAssign = useBulkAssignLeads();
  const tagOptions = useMemo(() => {
    const tags = new Set();
    leads.forEach((lead) => (lead.tags || []).forEach((tag) => tags.add(tag)));
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const toggleSelectLead = useCallback((leadId) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const handleBulkAssign = useCallback((agentId) => {
    if (selectedLeadIds.size === 0) return;
    bulkAssign.mutate(
      { leadIds: [...selectedLeadIds], agentId: agentId || null },
      { onSuccess: () => setSelectedLeadIds(new Set()) }
    );
  }, [selectedLeadIds, bulkAssign]);

  const tabCounts = useMemo(() => {
    const counts = {
      'Needs Attention': leads.filter(needsAttention).length,
      'All Leads': leads.length,
    };
    LEAD_PIPELINE_COLUMNS.forEach((column) => {
      counts[column.key] = leads.filter((lead) => lead.status === column.key).length;
    });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byTab = leads.filter((lead) => {
      if (activeTab === 'Needs Attention') return needsAttention(lead);
      if (activeTab === 'All Leads') return true;
      return lead.status === activeTab;
    });

    const filtered = byTab.filter((lead) => {
      const searchable = [
        lead.customer?.name,
        lead.customer?.phone,
        lead.customer?.email,
        lead.destination,
        lead.source,
        lead.assignedAgent?.name,
        ...(lead.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        matchesSource(lead, sourceFilter) &&
        matchesAgent(lead, agentFilter, currentAgent?.id) &&
        matchesTag(lead, tagFilter) &&
        matchesDateRange(lead, dateRange)
      );
    });

    return sortLeads(filtered, sortBy);
  }, [activeTab, agentFilter, currentAgent?.id, dateRange, leads, search, sortBy, sourceFilter, tagFilter]);

  const metrics = useMemo(() => {
    const attention = leads.filter(needsAttention);
    const overdue = leads.filter((lead) =>
      getAttentionBadges(lead).some((badge) => badge.key === 'overdue')
    );
    const pipelineValue = leads.reduce((total, lead) => {
      const travellers = Number(lead.travellers || 1);
      return total + Number(lead.budgetPerPerson || 0) * travellers;
    }, 0);

    return {
      totalDeals: leads.length,
      attention: attention.length,
      overdue: overdue.length,
      won: leads.filter((lead) => lead.status === 'CONVERTED').length,
      lost: leads.filter((lead) => lead.status === 'LOST').length,
      hot: leads.filter((lead) => getLeadScore(lead) >= 75 && !['CONVERTED', 'LOST', 'CANCELLED'].includes(lead.status)).length,
      pipelineValue,
    };
  }, [leads]);

  const toggleSelectAll = useCallback(() => {
    setSelectedLeadIds((prev) => {
      if (prev.size === filteredLeads.length && filteredLeads.length > 0) return new Set();
      return new Set(filteredLeads.map((lead) => lead.id));
    });
  }, [filteredLeads]);

  function clearFilters() {
    setSearch('');
    setActiveTab('All Leads');
    setSourceFilter('all');
    setSortBy('newest');
    setDateRange('all');
    setAgentFilter('all');
    setTagFilter('all');
  }

  function updateLeadField(leadId, data) {
    updateLead.mutate({ id: leadId, data });
  }

  function handleStatusChange(lead, status) {
    if (status === 'LOST' && !lead.lostReason) {
      const lostReason = window.prompt('Why was this lead lost?');
      if (!lostReason?.trim()) return;
      updateLeadField(lead.id, { status, lostReason: lostReason.trim() });
      return;
    }
    updateLeadField(lead.id, { status });
  }

  return (
    <div className="w-full pb-10">
      <div className="mb-8 flex flex-col gap-5 animate-fade-in xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Lead Management</h1>
          <p className="mt-1.5 max-w-2xl text-sm font-medium text-neutral-500">
            Prioritize urgent enquiries, assign owners, and keep follow-ups moving from one workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-100/80 p-1 shadow-inner">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-sm font-bold rounded-[var(--radius-sm)] transition-all ${
                view === 'list' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-4 py-2 text-sm font-bold rounded-[var(--radius-sm)] transition-all ${
                view === 'kanban' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Kanban
            </button>
          </div>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="shell-input-rect h-11 w-40 bg-white py-2"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="shell-input-rect h-11 w-44 bg-white py-2"
          >
            <option value="all">All Agents</option>
            {currentAgent?.id && <option value="mine">Assigned To Me</option>}
            <option value="unassigned">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="shell-input-rect h-11 w-40 bg-white py-2"
          >
            <option value="all">All Tags</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="shell-input-rect h-11 w-44 bg-white py-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="shell-button-primary h-11 px-5 bg-neutral-900 hover:bg-black"
          >
            <PlusIcon className="h-5 w-5" />
            New Lead
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={ExclamationTriangleIcon} tone="bg-amber-50 text-amber-600" value={metrics.attention} label="Needs Attention" />
        <MetricCard icon={ClockIcon} tone="bg-rose-50 text-rose-600" value={metrics.overdue} label="Overdue" />
        <MetricCard icon={TrophyIcon} tone="bg-red-50 text-red-600" value={metrics.hot} label="Hot Leads" />
        <MetricCard icon={BriefcaseIcon} tone="bg-sky-50 text-sky-600" value={metrics.totalDeals} label="Total Leads" />
        <MetricCard icon={TrophyIcon} tone="bg-emerald-50 text-emerald-600" value={metrics.won} label="Converted" />
        <MetricCard icon={BanknotesIcon} tone="bg-indigo-50 text-indigo-600" value={formatCurrency(metrics.pipelineValue)} label="Pipeline Value" />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md group">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400 transition-colors group-focus-within:text-neutral-600" />
            <input
              type="text"
              placeholder="Search name, phone, email, destination..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="shell-input-rect h-12 rounded-xl border-neutral-200 bg-white pl-11 shadow-sm focus:border-neutral-400 focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`shrink-0 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold transition-all ${
                  dateRange === option.value
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="shell-button-secondary h-9 shrink-0 px-3 py-1.5 text-xs"
            >
              <FunnelIcon className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:border-neutral-300 hover:text-neutral-600'
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                {tabCounts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' ? (
        <LeadPipeline leads={filteredLeads} onLeadClick={(lead) => setSelectedLeadId(lead.id)} />
      ) : (
        <LeadTable
          agents={agents}
          clearFilters={clearFilters}
          isError={leadsQuery.isError}
          isLoading={leadsQuery.isLoading}
          leads={filteredLeads}
          onLeadClick={(lead) => setSelectedLeadId(lead.id)}
          onRetry={() => leadsQuery.refetch()}
          onStatusChange={handleStatusChange}
          onUpdateLead={updateLeadField}
          selectedLeadIds={selectedLeadIds}
          onToggleSelect={toggleSelectLead}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      <BulkActionBar
        agents={agents}
        count={selectedLeadIds.size}
        isPending={bulkAssign.isPending}
        onAssign={handleBulkAssign}
        onClear={() => setSelectedLeadIds(new Set())}
      />

      <LeadDrawer
        agents={agents}
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />

      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        agents={agents}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, tone, value, label }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-4">
        <div className={`kpi-icon ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold leading-none text-neutral-900">{value}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function LeadTable({ agents, clearFilters, isError, isLoading, leads, onLeadClick, onRetry, onStatusChange, onUpdateLead, selectedLeadIds, onToggleSelect, onToggleSelectAll }) {
  const allSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
  const someSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;
  const colSpan = 11;

  return (
    <div className="data-table-wrapper">
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead>
            <tr className="data-table-head">
              <th className="data-table-th w-12" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onToggleSelectAll}
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                    allSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : someSelected
                        ? 'border-neutral-900 bg-neutral-200'
                        : 'border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {allSelected && <CheckIcon className="h-3.5 w-3.5" />}
                  {someSelected && !allSelected && <span className="block h-0.5 w-2.5 rounded bg-neutral-900" />}
                </button>
              </th>
              <th className="data-table-th w-16">SL NO</th>
              <th className="data-table-th">Lead</th>
              <th className="data-table-th">Score</th>
              <th className="data-table-th">Attention</th>
              <th className="data-table-th">Contact</th>
              <th className="data-table-th">Trip</th>
              <th className="data-table-th">Next Action</th>
              <th className="data-table-th">Last Activity</th>
              <th className="data-table-th">Assigned To</th>
              <th className="data-table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <LeadTableSkeleton colSpan={colSpan} />}

            {isError && !isLoading && (
              <tr>
                <td colSpan={colSpan} className="p-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
                      <XCircleIcon className="h-8 w-8 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">Could not load leads</h3>
                    <p className="mt-1 text-sm text-neutral-500">Refresh the data and try again.</p>
                    <button onClick={onRetry} className="shell-button-secondary mt-5">
                      <ArrowPathIcon className="h-4 w-4" />
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !isError && leads.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="p-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50 shadow-inner">
                      <BriefcaseIcon className="h-10 w-10 text-neutral-300" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">No leads found</h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                      No lead matches the current search, filters, and tab.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="mt-6 text-sm font-bold text-neutral-900 underline-offset-4 transition-all hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              leads.map((lead, index) => (
                <LeadTableRow
                  agents={agents}
                  index={index}
                  isSelected={selectedLeadIds.has(lead.id)}
                  key={lead.id}
                  lead={lead}
                  onLeadClick={onLeadClick}
                  onStatusChange={onStatusChange}
                  onToggleSelect={onToggleSelect}
                  onUpdateLead={onUpdateLead}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadTableSkeleton({ colSpan = 10 }) {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index} className="border-b border-neutral-100">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-neutral-100" />
      </td>
    </tr>
  ));
}

function LeadTableRow({ agents, index, isSelected, lead, onLeadClick, onStatusChange, onToggleSelect, onUpdateLead }) {
  const attentionBadges = getAttentionBadges(lead);
  const nextFollowUp = getNextFollowUp(lead);
  const score = getLeadScore(lead);

  return (
    <tr className={`data-table-row group ${isSelected ? 'bg-indigo-50/60' : ''}`} onClick={() => onLeadClick(lead)}>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <button
          onClick={() => onToggleSelect(lead.id)}
          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
            isSelected
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-300 hover:border-neutral-500'
          }`}
        >
          {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
        </button>
      </td>
      <td className="data-table-td font-medium text-neutral-400">#{index + 1}</td>
      <td className="data-table-td">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
            {getInitials(lead.customer?.name, 'L')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">{lead.customer?.name || 'Unnamed Lead'}</div>
            <div className="mt-0.5 text-xs text-neutral-400">{formatSource(lead.source)}</div>
          </div>
        </div>
      </td>
      <td className="data-table-td">
        <span className={`inline-flex min-w-12 justify-center rounded-full border px-2.5 py-1 text-xs font-bold ${getLeadScoreTone(score)}`}>
          {score}
        </span>
      </td>
      <td className="data-table-td">
        {attentionBadges.length > 0 ? (
          <div className="flex max-w-[220px] flex-wrap gap-1.5">
            {attentionBadges.slice(0, 3).map((badge) => (
              <span
                key={badge.key}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-neutral-300">{EMPTY}</span>
        )}
      </td>
      <td className="data-table-td text-neutral-500">
        <div className="flex flex-col gap-0.5 text-xs">
          <span>{formatPhone(lead.customer?.phone) || EMPTY}</span>
          {lead.customer?.email && <span className="text-neutral-400">{lead.customer.email}</span>}
        </div>
      </td>
      <td className="data-table-td">
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-semibold text-neutral-700">{lead.destination || 'Destination not set'}</span>
          <span className="text-neutral-400">{getLeadValueLabel(lead)}</span>
        </div>
      </td>
      <td className="data-table-td">
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-semibold text-neutral-700">{getNextAction(lead)}</span>
          <span className="text-neutral-400">
            {nextFollowUp ? formatDateTime(nextFollowUp.scheduledAt) : 'No follow-up scheduled'}
          </span>
        </div>
      </td>
      <td className="data-table-td text-xs text-neutral-500">{getActivityLabel(lead)}</td>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <select
          className="cursor-pointer appearance-none rounded-md border-0 bg-transparent px-2 py-1 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:ring-0"
          value={lead.assignedAgentId || ''}
          onChange={(event) => onUpdateLead(lead.id, { assignedAgentId: event.target.value || null })}
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </td>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <select
          className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-[10px] font-bold focus:ring-0 ${getStatusTone(lead.status)}`}
          value={lead.status}
          onChange={(event) => onStatusChange?.(lead, event.target.value)}
        >
          {LEAD_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatStatus(option)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function LeadDrawer({ leadId, onClose, agents }) {
  const { data, isLoading } = useLead(leadId);
  const lead = data?.data;
  const selectedCatalogItems = lead?.selectedCatalogItems || [];

  const [activeTab, setActiveTab] = useState('Notes');
  const [noteContent, setNoteContent] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState({});

  const updateLead = useUpdateLead();
  const addNote = useAddNote();
  const addFollowup = useAddFollowUp();
  const updateFollowup = useUpdateFollowUp();

  const nextFollowUp = getNextFollowUp(lead);
  const attentionBadges = lead ? getAttentionBadges(lead) : [];
  const leadScore = getLeadScore(lead);
  const tabItems = [
    { key: 'Notes', label: `Notes ${lead?.notesList?.length || 0}` },
    { key: 'Follow-ups', label: `Follow-ups ${lead?.followUps?.length || 0}` },
    { key: 'Activity', label: 'Activity' },
    { key: 'Timeline', label: 'Timeline' },
  ];

  const handleEditClick = () => {
    setEditState({
      customerName: lead?.customer?.name || '',
      customerPhone: lead?.customer?.phone || '',
      customerEmail: lead?.customer?.email || '',
      source: lead?.source || '',
      budgetPerPerson: lead?.budgetPerPerson || 0,
      destination: lead?.destination || '',
      assignedAgentId: lead?.assignedAgentId || '',
      tagsText: (lead?.tags || []).join(', '),
    });
    setIsEditing(true);
  };

  const handleMarkLost = () => {
    const lostReason = window.prompt('Why was this lead lost?', lead?.lostReason || '');
    if (!lostReason?.trim()) return;
    updateLead.mutate({ id: lead.id, data: { status: 'LOST', lostReason: lostReason.trim() } });
  };

  const handleSave = () => {
    const tags = String(editState.tagsText || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    updateLead.mutate(
      {
        id: leadId,
        data: {
          ...editState,
          assignedAgentId: editState.assignedAgentId || null,
          tags,
        },
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const openWhatsApp = () => {
    const phone = lead?.customer?.phone?.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer');
  };

  const openCall = () => {
    if (lead?.customer?.phone) window.location.href = `tel:${lead.customer.phone}`;
  };

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
        <div className="border-b border-neutral-100 p-6">
          <div className="flex items-start justify-between gap-4">
            {isLoading ? (
              <div className="flex w-full animate-pulse gap-4">
                <div className="h-12 w-12 shrink-0 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100" />
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-600 ring-2 ring-neutral-200">
                  {getInitials(lead?.customer?.name, 'L')}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold tracking-tight text-neutral-900">
                    {lead?.customer?.name || 'Unnamed Lead'}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`badge ${getStatusTone(lead?.status)} px-2 py-0.5 text-[10px]`}>
                      {formatStatus(lead?.status)}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getLeadScoreTone(leadScore)}`}>
                      Score {leadScore}
                    </span>
                    {attentionBadges.slice(0, 2).map((badge) => (
                      <span
                        key={badge.key}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={updateLead.isPending}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-black disabled:opacity-60"
                  >
                    {updateLead.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 transition-all hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEditClick}
                  className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!isLoading && lead && (
            <div className="mt-5 grid grid-cols-4 gap-2">
              <QuickAction icon={ChatBubbleLeftRightIcon} label="WhatsApp" onClick={openWhatsApp} />
              <QuickAction icon={PhoneIcon} label="Call" onClick={openCall} />
              <QuickAction icon={CalendarDaysIcon} label="Follow-up" onClick={() => setActiveTab('Follow-ups')} />
              <QuickAction icon={PaperAirplaneIcon} label="Quote" onClick={() => setActiveTab('Activity')} />
              <QuickAction icon={CheckCircleIcon} label="Convert" onClick={() => updateLead.mutate({ id: lead.id, data: { status: 'CONVERTED' } })} />
              <QuickAction icon={XCircleIcon} label="Lost" onClick={handleMarkLost} />
              <QuickAction icon={UserPlusIcon} label="Assign" onClick={handleEditClick} />
              <QuickAction icon={PencilIcon} label="Note" onClick={() => setActiveTab('Notes')} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
        {!isLoading && lead && (
          <div className="border-b border-neutral-100 px-6 py-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <LeadField
                isEditing={isEditing}
                label="Destination"
                value={lead.destination || EMPTY}
                editControl={
                  <input
                    type="text"
                    value={editState.destination}
                    onChange={(event) => setEditState({ ...editState, destination: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                isEditing={isEditing}
                label="Source"
                value={formatSource(lead.source)}
                editControl={
                  <select
                    value={editState.source}
                    onChange={(event) => setEditState({ ...editState, source: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  >
                    <option value="whatsapp_organic">WhatsApp Organic</option>
                    <option value="instagram">Instagram DM</option>
                    <option value="facebook_ad">Facebook Ad</option>
                    <option value="instagram_ad">Instagram Ad</option>
                    <option value="google_ad">Google Ad</option>
                    <option value="referral">Referral</option>
                    <option value="manual">Manual</option>
                  </select>
                }
              />
              <LeadField
                isEditing={isEditing}
                label="Contact Person"
                value={lead.customer?.name || EMPTY}
                editControl={
                  <input
                    type="text"
                    value={editState.customerName}
                    onChange={(event) => setEditState({ ...editState, customerName: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                isEditing={isEditing}
                label="Phone"
                value={formatPhone(lead.customer?.phone) || EMPTY}
                editControl={
                  <input
                    type="text"
                    value={editState.customerPhone}
                    onChange={(event) => setEditState({ ...editState, customerPhone: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                isEditing={isEditing}
                label="Email"
                value={lead.customer?.email || EMPTY}
                editControl={
                  <input
                    type="email"
                    value={editState.customerEmail}
                    onChange={(event) => setEditState({ ...editState, customerEmail: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                isEditing={isEditing}
                label="Budget / Person"
                value={lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : EMPTY}
                editControl={
                  <input
                    type="number"
                    value={editState.budgetPerPerson / 100}
                    onChange={(event) => setEditState({ ...editState, budgetPerPerson: Number(event.target.value) * 100 })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField label="Created" value={formatDate(lead.createdAt)} />
              <LeadField label="Lead Score" value={`${leadScore}/100`} />
              <LeadField label="Last Activity" value={getActivityLabel(lead)} />
              <LeadField label="Next Contact" value={nextFollowUp ? formatDateTime(nextFollowUp.scheduledAt) : EMPTY} />
              <LeadField
                isEditing={isEditing}
                label="Assigned To"
                value={lead.assignedAgent?.name || 'Unassigned'}
                editControl={
                  <select
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                    value={editState.assignedAgentId || ''}
                    onChange={(event) => setEditState({ ...editState, assignedAgentId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-400">
                <TagIcon className="h-4 w-4" />
                Tags
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editState.tagsText || ''}
                  onChange={(event) => setEditState({ ...editState, tagsText: event.target.value })}
                  className="w-full rounded-md border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-0"
                  placeholder="urgent, honeymoon, high budget"
                />
              ) : (lead.tags || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {lead.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">{EMPTY}</p>
              )}
            </div>

            {selectedCatalogItems.length > 0 && (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Selected Items</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">
                      {selectedCatalogItems.length} selected item{selectedCatalogItems.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedCatalogItems.map((item) => (
                    <div key={`${item.itemType}-${item.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            item.itemType === 'PROPERTY'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.itemType === 'PROPERTY' ? 'Property' : 'Package'}
                          </span>
                          <p className="truncate text-sm font-semibold text-neutral-900">{item.name || EMPTY}</p>
                        </div>
                        {item.subtitle && (
                          <p className="mt-1 text-xs text-neutral-500">{item.subtitle}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-xs font-semibold text-neutral-600">
                        {item.price ? formatCurrency(item.price) : EMPTY}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 gap-6 overflow-x-auto border-b border-neutral-100 px-6 hide-scrollbar">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-neutral-50/50 px-6 py-6">
          {!isLoading && lead && (
            <>
              {activeTab === 'Notes' && (
                <NotesPanel
                  addNote={addNote}
                  lead={lead}
                  noteContent={noteContent}
                  setNoteContent={setNoteContent}
                />
              )}

              {activeTab === 'Follow-ups' && (
                <FollowUpsPanel
                  addFollowup={addFollowup}
                  followupDate={followupDate}
                  followupNote={followupNote}
                  lead={lead}
                  setFollowupDate={setFollowupDate}
                  setFollowupNote={setFollowupNote}
                  updateFollowup={updateFollowup}
                />
              )}

              {activeTab === 'Activity' && (
                <ActivityPanel lead={lead} />
              )}

              {activeTab === 'Timeline' && (
                <TimelinePanel lead={lead} />
              )}
            </>
          )}
        </div>
        </div>
      </aside>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs font-bold text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
      type="button"
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function LeadField({ editControl, isEditing = false, label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-neutral-400">{label}</div>
      {isEditing && editControl ? (
        editControl
      ) : (
        <div className="truncate font-medium text-neutral-900">{value}</div>
      )}
    </div>
  );
}

function NotesPanel({ addNote, lead, noteContent, setNoteContent }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-1 shadow-sm">
        <textarea
          placeholder="Add a new note..."
          className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none focus:ring-0"
          rows="3"
          value={noteContent}
          onChange={(event) => setNoteContent(event.target.value)}
        />
        <div className="flex justify-end px-2 pb-2">
          <button
            disabled={addNote.isPending || !noteContent.trim()}
            onClick={() => {
              addNote.mutate({ id: lead.id, data: { content: noteContent.trim() } });
              setNoteContent('');
            }}
            className="shell-button-primary px-4 py-1.5 text-xs disabled:opacity-60"
          >
            {addNote.isPending ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {(!lead.notesList || lead.notesList.length === 0) ? (
        <EmptyPanel text="No notes yet. Add your first note above." />
      ) : (
        <div className="mt-4 space-y-3">
          {lead.notesList.map((note) => (
            <div key={note.id} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 text-sm shadow-sm">
              <div className="whitespace-pre-wrap text-neutral-600">{note.content}</div>
              <div className="mt-3 flex justify-between text-xs font-medium text-neutral-400">
                <span>{note.agent?.name || 'Agent'}</span>
                <span>{formatDateTime(note.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpsPanel({
  addFollowup,
  followupDate,
  followupNote,
  lead,
  setFollowupDate,
  setFollowupNote,
  updateFollowup,
}) {
  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          addFollowup.mutate({
            id: lead.id,
            data: { scheduledAt: new Date(followupDate).toISOString(), note: followupNote },
          });
          setFollowupDate('');
          setFollowupNote('');
        }}
      >
        <h4 className="text-sm font-bold text-neutral-800">Schedule Follow-Up</h4>
        <input
          type="datetime-local"
          required
          value={followupDate}
          onChange={(event) => setFollowupDate(event.target.value)}
          className="shell-input-rect bg-neutral-50 text-sm"
        />
        <textarea
          placeholder="Follow-up note (e.g. Call back regarding pricing)"
          className="shell-input-rect resize-none bg-neutral-50 py-2 text-sm"
          rows="2"
          required
          value={followupNote}
          onChange={(event) => setFollowupNote(event.target.value)}
        />
        <button type="submit" disabled={addFollowup.isPending} className="shell-button-primary w-full disabled:opacity-60">
          {addFollowup.isPending ? 'Scheduling...' : 'Schedule Follow-Up'}
        </button>
      </form>

      {(!lead.followUps || lead.followUps.length === 0) ? (
        <EmptyPanel text="No follow-ups scheduled" />
      ) : (
        <div className="mt-4 space-y-3">
          {lead.followUps.map((followUp) => {
            const isDone = followUp.status === 'Done';
            const isOverdue = followUp.status === 'Scheduled' && new Date(followUp.scheduledAt).getTime() < Date.now();

            return (
              <div
                key={followUp.id}
                className={`relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius-md)] border bg-white p-4 shadow-sm ${
                  isDone ? 'border-neutral-100 opacity-60' : isOverdue ? 'border-rose-200' : 'border-neutral-200'
                }`}
              >
                {followUp.status === 'Scheduled' && (
                  <div className={`absolute left-0 top-0 h-full w-1 ${isOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className={`text-xs font-bold uppercase tracking-wider ${isOverdue ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {isOverdue ? 'Overdue' : followUp.status}
                  </div>
                  <div className="text-sm font-semibold text-neutral-700">{formatDateTime(followUp.scheduledAt)}</div>
                </div>
                <p className="text-sm text-neutral-600">{followUp.note}</p>
                {followUp.status === 'Scheduled' && (
                  <div className="mt-2 flex justify-end">
                    <button
                      className="flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                      onClick={() => updateFollowup.mutate({ id: lead.id, followUpId: followUp.id, data: { status: 'Done' } })}
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Mark Done
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityPanel({ lead }) {
  const score = getLeadScore(lead);

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recommended Next Action</div>
        <div className="mt-2 text-lg font-bold text-neutral-900">{getNextAction(lead)}</div>
        <p className="mt-1 text-sm text-neutral-500">
          Based on owner, follow-up timing, status, and recent inbound activity.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActivityStat label="Lead Score" value={`${score}/100`} />
        <ActivityStat label="Lead Value" value={getLeadValueLabel(lead)} />
        <ActivityStat label="Last Activity" value={getActivityLabel(lead)} />
        <ActivityStat label="Created" value={timeAgo(lead.createdAt)} />
        <ActivityStat label="Source" value={formatSource(lead.source)} />
        {lead.status === 'LOST' && <ActivityStat label="Lost Reason" value={lead.lostReason || EMPTY} />}
      </div>
    </div>
  );
}

function ActivityStat({ label, value }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-800">{value}</div>
    </div>
  );
}

function TimelinePanel({ lead }) {
  return (
    <div className="space-y-4">
      <TimelineItem
        icon={<CheckCircleIcon className="h-4 w-4" />}
        iconClass="bg-emerald-100 text-emerald-600"
        title="Lead Created"
        description={`Lead ${lead.customer?.name || 'Unnamed Lead'} created via ${formatSource(lead.source)}`}
        time={formatDateTime(lead.createdAt)}
      />

      {lead.messages?.map((message) => (
        <TimelineItem
          key={message.id}
          icon={message.direction === 'IN' ? 'IN' : 'OUT'}
          iconClass={message.direction === 'IN' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}
          title={message.direction === 'IN' ? 'Message Received' : 'Message Sent'}
          description={message.content}
          time={formatDateTime(message.timestamp)}
        />
      ))}
    </div>
  );
}

function TimelineItem({ description, icon, iconClass, time, title }) {
  return (
    <div className="flex gap-4 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex w-6 shrink-0 flex-col items-center">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${iconClass}`}>
          {icon}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-neutral-800">{title}</h4>
            <p className="mt-1 line-clamp-3 break-words text-sm text-neutral-500">{description}</p>
          </div>
          <span className="shrink-0 text-xs text-neutral-400">{time}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ text }) {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-neutral-200 bg-white py-10 text-center">
      <div className="text-sm text-neutral-400">{text}</div>
    </div>
  );
}

function BulkActionBar({ agents, count, isPending, onAssign, onClear }) {
  const [bulkAgentId, setBulkAgentId] = useState('');

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6 pointer-events-none animate-fade-in">
      <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white/95 px-6 py-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        {/* Selection count badge */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white shadow-sm">
            {count}
          </span>
          <span className="text-sm font-semibold text-neutral-700">
            {count === 1 ? 'lead' : 'leads'} selected
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-neutral-200" />

        {/* Agent picker */}
        <div className="flex items-center gap-2.5">
          <UserPlusIcon className="h-4.5 w-4.5 text-neutral-400" />
          <select
            value={bulkAgentId}
            onChange={(e) => setBulkAgentId(e.target.value)}
            className="h-9 w-48 cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:ring-0"
          >
            <option value="">Select Agent...</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assign button */}
        <button
          onClick={() => {
            if (!bulkAgentId) return;
            onAssign(bulkAgentId);
            setBulkAgentId('');
          }}
          disabled={!bulkAgentId || isPending}
          className="flex h-9 items-center gap-2 rounded-lg bg-neutral-900 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              Assign
            </>
          )}
        </button>

        {/* Unassign button */}
        <button
          onClick={() => {
            onAssign(null);
            setBulkAgentId('');
          }}
          disabled={isPending}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-40"
        >
          Unassign
        </button>

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          title="Clear selection"
        >
          <XMarkIcon className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
