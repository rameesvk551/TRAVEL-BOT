import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleOff,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { platformApi } from '../api/platformApi';
import { usePlatformAuthStore } from '../store/platformAuthStore';
import { formatCurrency, formatDateTime, timeAgo } from '../utils/formatters';

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

const FALLBACK_MODULES = [
  // Core
  { path: '/leads', label: 'Leads', group: 'Core' },
  { path: '/follow-ups', label: 'Follow-ups', group: 'Core' },
  { path: '/bookings', label: 'Bookings', group: 'Core' },
  { path: '/customers', label: 'Customers', group: 'Core' },
  { path: '/whatsapp', label: 'WhatsApp', group: 'Core' },
  { path: '/agents', label: 'Users', group: 'Core' },
  { path: '/settings', label: 'Settings', group: 'Core' },
  // Workspace
  { path: '/properties', label: 'Properties', group: 'Workspace' },
  { path: '/itineraries', label: 'Itineraries', group: 'Workspace' },
  { path: '/packages', label: 'Packages', group: 'Workspace' },
  { path: '/cruises', label: 'Cruises', group: 'Workspace' },
  { path: '/visas', label: 'Visas', group: 'Workspace' },
  { path: '/services', label: 'Services', group: 'Workspace' },
  { path: '/vendors', label: 'Vendors', group: 'Workspace' },
  { path: '/vendor-payments', label: 'Vendor Payments', group: 'Workspace' },
  { path: '/accounts', label: 'Accounts', group: 'Workspace' },
  { path: '/website-builder', label: 'Website', group: 'Workspace' },
  { path: '/hrm', label: 'HR & Payroll', group: 'Workspace' },
  { path: '/analytics', label: 'Reports', group: 'Workspace' },
  // Marketing
  { path: '/templates', label: 'Templates', group: 'Marketing' },
  { path: '/flows', label: 'Flows', group: 'Marketing' },
  { path: '/campaigns', label: 'Campaigns', group: 'Marketing' },
  { path: '/ads', label: 'Social Ads', group: 'Marketing' },
  { path: '/social', label: 'Social Media', group: 'Marketing' },
  { path: '/reviews', label: 'Reviews', group: 'Marketing' },
];

const CHART_COLORS = ['#111827', '#0f766e', '#2563eb', '#d97706', '#be123c', '#7c3aed'];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function statusTone(value) {
  const tones = {
    CONNECTED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    FAILED: 'bg-rose-50 text-rose-700',
    NOT_CONNECTED: 'bg-neutral-100 text-neutral-600',
    Healthy: 'bg-emerald-50 text-emerald-700',
    Watch: 'bg-amber-50 text-amber-700',
    'At risk': 'bg-orange-50 text-orange-700',
    Critical: 'bg-rose-50 text-rose-700',
    ONLINE: 'bg-emerald-50 text-emerald-700',
    RECENT: 'bg-sky-50 text-sky-700',
    OFFLINE: 'bg-neutral-100 text-neutral-500',
    STALE_ONLINE: 'bg-amber-50 text-amber-700',
  };
  return tones[value] || 'bg-neutral-100 text-neutral-600';
}

function compactNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { notation: number >= 100000 ? 'compact' : 'standard' }).format(number);
}

function KpiCard({ label, value, note, icon: Icon, tone }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-neutral-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-neutral-500">{note}</p>
        </div>
        <div className={cx('kpi-icon', tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ title, note, children }) {
  return (
    <div className="shell-panel overflow-hidden">
      <div className="section-header">
        <div>
          <h2 className="text-sm font-black">{title}</h2>
          <p className="text-xs text-neutral-400">{note}</p>
        </div>
      </div>
      <div className="h-64 px-2 pb-4">
        {children}
      </div>
    </div>
  );
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-neutral-900">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="font-semibold text-neutral-600">
          {item.name || item.dataKey}: {item.dataKey === 'value' && item.name === 'Revenue' ? formatCurrency(item.value) : compactNumber(item.value)}
        </p>
      ))}
    </div>
  );
}

function PlatformLayout({ children }) {
  const admin = usePlatformAuthStore((state) => state.admin);
  const refreshToken = usePlatformAuthStore((state) => state.refreshToken);
  const logoutStore = usePlatformAuthStore((state) => state.logout);

  const logoutMutation = useMutation({
    mutationFn: () => platformApi.logout(refreshToken),
    onSettled: () => {
      logoutStore();
      window.location.href = '/platform/login';
    },
  });

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-neutral-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">WAYON SaaS Admin</p>
              <p className="truncate text-xs font-semibold text-neutral-400">{admin?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/platform/partners" className="shell-button-secondary min-h-10 px-3" title="White-label partners">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Partners</span>
            </a>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="shell-button-secondary min-h-10 px-3"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1760px] px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}

function ModuleControl({ agency, modules, isSaving, onSave }) {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    setSelected(Array.isArray(agency?.sidebarPreferences) ? agency.sidebarPreferences : []);
  }, [agency?.id, agency?.sidebarPreferences]);

  const toggle = (path) => {
    setSelected((current) => (
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    ));
  };

  const toggleGroup = (groupModules) => {
    const paths = groupModules.map((item) => item.path);
    const allSelected = paths.every((path) => selected.includes(path));
    setSelected((current) => {
      if (allSelected) return current.filter((path) => !paths.includes(path));
      return [...new Set([...current, ...paths])];
    });
  };

  const isDirty = JSON.stringify(selected.slice().sort()) !== JSON.stringify((agency?.sidebarPreferences || []).slice().sort());

  const groups = useMemo(() => {
    const map = {};
    (modules || []).forEach((item) => {
      const group = item.group || 'Other';
      if (!map[group]) map[group] = [];
      map[group].push(item);
    });
    return Object.entries(map);
  }, [modules]);

  return (
    <div className="shell-panel overflow-hidden">
      <div className="section-header">
        <div>
          <h3 className="text-sm font-black">Enabled Modules</h3>
          <p className="text-xs text-neutral-400">Dashboard is always visible. Empty selection = legacy full access.</p>
        </div>
        <button
          type="button"
          onClick={() => onSave(selected)}
          disabled={!isDirty || isSaving}
          className="shell-button-secondary px-3 py-2 text-xs"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {isSaving ? 'Saving' : 'Save'}
        </button>
      </div>
      <div className="space-y-4 p-4">
        {groups.map(([groupName, groupModules]) => {
          const allChecked = groupModules.every((item) => selected.includes(item.path));
          return (
            <div key={groupName}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{groupName}</p>
                <button type="button" onClick={() => toggleGroup(groupModules)} className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 transition">
                  {allChecked ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {groupModules.map((item) => (
                  <label key={item.path} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-300 transition">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.path)}
                      onChange={() => toggle(item.path)}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-950"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgencyDrawer({ agencyId, range, moduleCatalog, onClose, onStatusChange }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['platform-agency', agencyId, range],
    queryFn: () => platformApi.agency(agencyId, { range }),
    enabled: !!agencyId,
    refetchInterval: 30000,
  });

  const modulesMutation = useMutation({
    mutationFn: (modules) => platformApi.updateAgencyModules(agencyId, modules),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-agencies'] });
      qc.invalidateQueries({ queryKey: ['platform-agency', agencyId] });
      qc.invalidateQueries({ queryKey: ['platform-activity'] });
    },
  });

  const detail = data?.data;
  const agency = detail?.agency;
  const trends = detail?.trends || {};
  const agents = detail?.agents || [];
  const customerActivity = detail?.customerActivity || [];
  const failedMessages = detail?.failedMessages || [];
  const overdueFollowUps = detail?.overdueFollowUps || [];
  const modules = detail?.moduleCatalog || moduleCatalog || FALLBACK_MODULES;
  const nextActive = !agency?.isActive;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-neutral-950/35 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-2xl xl:max-w-[920px]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Agency Detail</p>
            <h2 className="mt-1 truncate text-xl font-black text-neutral-950">
              {isLoading ? 'Loading agency' : agency?.name}
            </h2>
            {agency ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}% {agency.healthLabel}</span>
                <span className={cx('badge', statusTone(agency.whatsappConnectionStatus))}>{agency.whatsappConnectionStatus}</span>
                <span className={cx('badge', agency.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                  {agency.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="shell-button-ghost h-10 w-10 p-0" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-neutral-500">Loading platform pulse...</div>
        ) : agency ? (
          <div className="flex-1 overflow-y-auto p-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Health" value={`${agency.healthScore ?? 0}%`} note="Current score" icon={Activity} tone="bg-sky-50 text-sky-700" />
              <KpiCard label="Leads" value={compactNumber(agency.metrics?.leadsInRange)} note={`${agency.metrics?.totalLeads || 0} lifetime`} icon={TrendingUp} tone="bg-indigo-50 text-indigo-700" />
              <KpiCard label="Bookings" value={compactNumber(agency.metrics?.bookingsInRange)} note={`${agency.metrics?.totalBookings || 0} lifetime`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
              <KpiCard label="Revenue" value={formatCurrency(agency.metrics?.paidRevenueInRange)} note={`${formatCurrency(agency.metrics?.pendingPaymentValue || 0)} pending`} icon={CreditCard} tone="bg-amber-50 text-amber-700" />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <ChartPanel title="Business Pulse" note="Leads, bookings, and revenue">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(trends.leads || []).map((item, index) => ({
                    ...item,
                    leads: item.value,
                    bookings: (trends.bookings || [])[index]?.value || 0,
                    revenue: Math.round(((trends.revenue || [])[index]?.value || 0) / 100),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<TooltipBox />} />
                    <Line type="monotone" dataKey="leads" name="Leads" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#0f766e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="WhatsApp Health" note="Message volume and failed sends">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.messages || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<TooltipBox />} />
                    <Bar dataKey="messages" name="Messages" fill="#111827" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill="#be123c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <div>
                    <h3 className="text-sm font-black">Team Activity</h3>
                    <p className="text-xs text-neutral-400">Online, recent, offline, and stale sessions</p>
                  </div>
                </div>
                <div className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
                  {agents.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No agents found.</p>
                  ) : agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-neutral-900">{agent.name}</p>
                        <p className="truncate text-xs text-neutral-500">{agent.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={cx('badge', statusTone(agent.status))}>{agent.status.replace('_', ' ')}</span>
                        <p className="mt-1 text-xs text-neutral-400">{agent.lastSeenAt ? timeAgo(agent.lastSeenAt) : 'never'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <div>
                    <h3 className="text-sm font-black">Customer Activity</h3>
                    <p className="text-xs text-neutral-400">WhatsApp session status</p>
                  </div>
                </div>
                <div className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
                  {customerActivity.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No customer activity yet.</p>
                  ) : customerActivity.map((customer) => (
                    <div key={`${customer.id}-${customer.currentStep}`} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-neutral-900">{customer.name}</p>
                          <p className="truncate text-xs text-neutral-500">{customer.phone || customer.source || 'Unknown contact'}</p>
                        </div>
                        <span className={cx('badge', customer.status === 'Active now' ? 'bg-emerald-50 text-emerald-700' : customer.status === 'Handed off' ? 'bg-indigo-50 text-indigo-700' : 'bg-neutral-100 text-neutral-600')}>
                          {customer.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-400">
                        {customer.currentStep || 'Unknown step'} - {customer.lastActivityAt ? timeAgo(customer.lastActivityAt) : 'no activity'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-5">
              <ModuleControl
                agency={agency}
                modules={modules}
                isSaving={modulesMutation.isPending}
                onSave={(items) => modulesMutation.mutate(items)}
              />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <h3 className="text-sm font-black">Recent Failed Messages</h3>
                </div>
                <div className="max-h-[360px] divide-y divide-neutral-100 overflow-y-auto">
                  {failedMessages.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No failed messages.</p>
                  ) : failedMessages.map((message) => (
                    <div key={message.id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-900">{message.customer?.name || message.customer?.phone || 'Customer'}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{message.content}</p>
                      <p className="mt-1 text-xs text-neutral-400">{formatDateTime(message.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <h3 className="text-sm font-black">Overdue Follow-ups</h3>
                </div>
                <div className="max-h-[360px] divide-y divide-neutral-100 overflow-y-auto">
                  {overdueFollowUps.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No overdue follow-ups.</p>
                  ) : overdueFollowUps.map((followUp) => (
                    <div key={followUp.id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-900">{followUp.agent?.name || 'Unassigned agent'}</p>
                      <p className="mt-1 text-sm text-neutral-500">{followUp.lead?.destination || followUp.note || 'Lead follow-up'}</p>
                      <p className="mt-1 text-xs text-rose-500">{formatDateTime(followUp.scheduledAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="p-5 text-sm text-rose-600">Agency not found.</div>
        )}

        {agency ? (
          <div className="border-t border-neutral-100 bg-white p-4">
            {confirming ? (
              <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-900">
                  {nextActive ? 'Reactivate this agency?' : 'Suspend this agency?'}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Suspension blocks agency users from authenticated API access.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onStatusChange(agency.id, nextActive, () => setConfirming(false))}
                    className={cx('shell-button-primary', nextActive ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800')}
                  >
                    Confirm
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="shell-button-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={cx('shell-button-secondary w-full', agency.isActive ? 'text-rose-700' : 'text-emerald-700')}
              >
                {agency.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {agency.isActive ? 'Suspend Agency' : 'Reactivate Agency'}
              </button>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export default function PlatformDashboard() {
  const qc = useQueryClient();
  const [range, setRange] = useState('30d');
  const [filters, setFilters] = useState({ q: '', status: '', plan: '', whatsapp: '' });
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);

  const agencyFilters = useMemo(() => ({ ...filters, range }), [filters, range]);

  const { data: overviewResponse, isLoading: overviewLoading } = useQuery({
    queryKey: ['platform-overview', range],
    queryFn: () => platformApi.overview({ range }),
    refetchInterval: 30000,
  });

  const { data: agenciesResponse, isLoading: agenciesLoading } = useQuery({
    queryKey: ['platform-agencies', agencyFilters],
    queryFn: () => platformApi.agencies(agencyFilters),
    refetchInterval: 30000,
  });

  const { data: activityResponse } = useQuery({
    queryKey: ['platform-activity'],
    queryFn: platformApi.activity,
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => platformApi.updateAgencyStatus(id, isActive),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-agencies'] });
      qc.invalidateQueries({ queryKey: ['platform-agency', variables.id] });
      qc.invalidateQueries({ queryKey: ['platform-activity'] });
    },
  });

  const overview = overviewResponse?.data || {};
  const totals = overview.totals || {};
  const trends = overview.trends || {};
  const agencies = agenciesResponse?.data || [];
  const activity = activityResponse?.data || [];
  const moduleCatalog = overview.moduleCatalog || FALLBACK_MODULES;
  const riskRadar = overview.riskRadar || [];

  const revenueChart = useMemo(
    () => trends.revenue || [],
    [trends.revenue]
  );

  const handleStatusChange = (id, isActive, done) => {
    statusMutation.mutate({ id, isActive }, { onSettled: done });
  };

  return (
    <PlatformLayout>
      <div className="space-y-5">
        <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow">TravelBot Pulse</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">Platform Command Center</h1>
            <p className="mt-1 text-sm text-neutral-500">Business, WhatsApp health, tenant activity, and operating risk across every client.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[var(--radius-md)] border border-neutral-200 bg-white p-1">
              {RANGE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRange(item.value)}
                  className={cx(
                    'rounded-[var(--radius-sm)] px-3 py-2 text-xs font-black transition',
                    range === item.value ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-500">
              <Activity className="h-4 w-4 text-emerald-600" />
              Auto-refreshes every 30 seconds
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Agencies" value={overviewLoading ? '-' : compactNumber(totals.totalAgencies)} note={`${totals.activeAgencies || 0} active, ${totals.suspendedAgencies || 0} suspended`} icon={Building2} tone="bg-sky-50 text-sky-700" />
          <KpiCard label="WhatsApp" value={overviewLoading ? '-' : compactNumber(totals.connectedWhatsApp)} note={`${totals.pendingWhatsApp || 0} pending, ${totals.failedWhatsApp || 0} failed, ${totals.notConnectedWhatsApp || 0} not connected`} icon={Wifi} tone="bg-emerald-50 text-emerald-700" />
          <KpiCard label="Leads" value={overviewLoading ? '-' : compactNumber(totals.leads30d)} note={`${totals.leadsToday || 0} today, ${totals.leads7d || 0} in 7D`} icon={TrendingUp} tone="bg-indigo-50 text-indigo-700" />
          <KpiCard label="Bookings" value={overviewLoading ? '-' : compactNumber(totals.bookings30d)} note={`${totals.bookingsToday || 0} today, ${totals.bookings7d || 0} in 7D`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
          <KpiCard label="Paid Revenue" value={overviewLoading ? '-' : formatCurrency(totals.paidRevenue)} note={`${formatCurrency(totals.pendingPaymentValue)} pending`} icon={CreditCard} tone="bg-amber-50 text-amber-700" />
          <KpiCard label="Live Customers" value={overviewLoading ? '-' : compactNumber(totals.activeCustomers)} note="Active in last 15 minutes" icon={MessageCircle} tone="bg-purple-50 text-purple-700" />
          <KpiCard label="Agents Online" value={overviewLoading ? '-' : compactNumber(totals.agentsOnline)} note={`${totals.staleOnlineAgents || 0} stale-online agents`} icon={Users} tone="bg-cyan-50 text-cyan-700" />
          <KpiCard label="Ops Risk" value={overviewLoading ? '-' : compactNumber((totals.failedMessages24h || 0) + (totals.overdueFollowUps || 0))} note={`${totals.failedMessages24h || 0} failed messages, ${totals.overdueFollowUps || 0} overdue`} icon={AlertTriangle} tone="bg-rose-50 text-rose-700" />
        </section>

        <section className="grid gap-5 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <ChartPanel title="Lead And Booking Flow" note="Daily demand and conversion movement">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(trends.leads || []).map((item, index) => ({
                  ...item,
                  leads: item.value,
                  bookings: trends.bookings?.[index]?.value || 0,
                }))}>
                  <defs>
                    <linearGradient id="leadFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#2563eb" fill="url(#leadFill)" strokeWidth={2} />
                  <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#0f766e" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <ChartPanel title="Revenue Trend" note="Paid payment value by day">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="value" name="Revenue" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="WhatsApp Reliability" note="Message volume and failures">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.messages || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="messages" name="Messages" fill="#111827" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill="#be123c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <section className="grid gap-5 xl:grid-cols-2">
              <ChartPanel title="Agency Health Distribution" note="Health score bands across tenants">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={overview.healthDistribution || []} dataKey="count" nameKey="label" innerRadius={54} outerRadius={88} paddingAngle={3}>
                      {(overview.healthDistribution || []).map((entry, index) => (
                        <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipBox />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Plan Distribution" note="Current agency subscription mix">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.planBreakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<TooltipBox />} />
                    <Bar dataKey="count" name="Agencies" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </section>

            <div className="shell-panel p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_150px_150px_180px]">
                <label className="input-icon-wrapper">
                  <Search className="icon-left h-4 w-4" />
                  <input
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    className="shell-input-rect input-with-icon bg-white"
                    placeholder="Search agency, email, phone"
                  />
                </label>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="shell-input-rect bg-white">
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <select value={filters.plan} onChange={(event) => setFilters((current) => ({ ...current, plan: event.target.value }))} className="shell-input-rect bg-white">
                  <option value="">All plans</option>
                  <option value="FREE">Free</option>
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                </select>
                <select value={filters.whatsapp} onChange={(event) => setFilters((current) => ({ ...current, whatsapp: event.target.value }))} className="shell-input-rect bg-white">
                  <option value="">All WhatsApp</option>
                  <option value="CONNECTED">Connected</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="NOT_CONNECTED">Not connected</option>
                </select>
              </div>
            </div>

            <div className="mobile-card-list">
              {agenciesLoading ? (
                <div className="mobile-record-card text-sm text-neutral-500">Loading agencies...</div>
              ) : agencies.map((agency) => (
                <button key={agency.id} type="button" onClick={() => setSelectedAgencyId(agency.id)} className="mobile-record-card text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-neutral-950">{agency.name}</p>
                      <p className="truncate text-xs text-neutral-500">{agency.email}</p>
                    </div>
                    <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}%</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                    <span>{agency.metrics.leadsInRange} leads</span>
                    <span>{agency.metrics.bookingsInRange} bookings</span>
                    <span>{formatCurrency(agency.metrics.paidRevenueInRange)}</span>
                    <span>{agency.metrics.failedMessages24h} failed msgs</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="data-table-wrapper desktop-table">
              <div className="overflow-x-auto">
                <table className="min-w-[1260px] w-full text-left">
                  <thead>
                    <tr className="data-table-head">
                      {['Agency', 'Status', 'Health', 'WhatsApp', 'Leads', 'Bookings', 'Revenue', 'Agents', 'Failures', 'Modules', 'Last Activity'].map((heading) => (
                        <th key={heading} className="data-table-th">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agenciesLoading ? (
                      <tr><td colSpan={11} className="p-8 text-sm text-neutral-500">Loading agencies...</td></tr>
                    ) : agencies.length === 0 ? (
                      <tr><td colSpan={11} className="p-8 text-sm text-neutral-500">No agencies match these filters.</td></tr>
                    ) : agencies.map((agency) => (
                      <tr key={agency.id} className="data-table-row" onClick={() => setSelectedAgencyId(agency.id)}>
                        <td className="data-table-td">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-neutral-950">{agency.name}</p>
                            <p className="truncate text-xs text-neutral-500">{agency.email}</p>
                          </div>
                        </td>
                        <td className="data-table-td">
                          <div className="space-y-1">
                            <span className={cx('badge', agency.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{agency.isActive ? 'Active' : 'Suspended'}</span>
                            <p className="text-xs font-semibold text-neutral-500">{agency.plan}</p>
                          </div>
                        </td>
                        <td className="data-table-td">
                          <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}% {agency.healthLabel}</span>
                        </td>
                        <td className="data-table-td">
                          <span className={cx('badge', statusTone(agency.whatsappConnectionStatus))}>{agency.whatsappConnectionStatus}</span>
                        </td>
                        <td className="data-table-td text-sm font-semibold text-neutral-600">{agency.metrics.leadsInRange}</td>
                        <td className="data-table-td text-sm font-semibold text-neutral-600">{agency.metrics.bookingsInRange}</td>
                        <td className="data-table-td text-sm font-semibold text-neutral-600">{formatCurrency(agency.metrics.paidRevenueInRange)}</td>
                        <td className="data-table-td text-sm text-neutral-600">{agency.metrics.onlineAgents}/{agency.metrics.totalAgents}</td>
                        <td className="data-table-td text-sm text-neutral-600">{agency.metrics.failedMessages24h} failed - {agency.metrics.overdueFollowUps} overdue</td>
                        <td className="data-table-td text-xs text-neutral-500">
                          <span className="line-clamp-2">{(agency.enabledModuleLabels || ['All modules']).join(', ')}</span>
                        </td>
                        <td className="data-table-td text-sm text-neutral-500">{agency.metrics.lastActivityAt ? timeAgo(agency.metrics.lastActivityAt) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="shell-panel overflow-hidden">
              <div className="section-header">
                <div>
                  <h2 className="text-sm font-black">Risk Radar</h2>
                  <p className="text-xs text-neutral-400">Disconnected, quiet, failed, or overdue tenants</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="max-h-[560px] divide-y divide-neutral-100 overflow-y-auto">
                {riskRadar.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    No active platform risks.
                  </div>
                ) : riskRadar.map((agency) => (
                  <button key={agency.id} type="button" onClick={() => setSelectedAgencyId(agency.id)} className="block w-full px-4 py-3 text-left hover:bg-neutral-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-neutral-900">{agency.name}</p>
                      <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}%</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-neutral-500">{agency.reasons.join(' - ')}</p>
                    <p className="mt-1 text-xs text-neutral-400">{agency.lastActivityAt ? timeAgo(agency.lastActivityAt) : 'No activity'}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="shell-panel overflow-hidden">
              <div className="section-header">
                <div>
                  <h2 className="text-sm font-black">WhatsApp Mix</h2>
                  <p className="text-xs text-neutral-400">Connection state by tenant</p>
                </div>
                <Wifi className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="space-y-2 p-4">
                {(overview.whatsappBreakdown || []).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2">
                    <span className={cx('badge', statusTone(item.label))}>{item.label}</span>
                    <span className="text-sm font-black text-neutral-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="shell-panel overflow-hidden">
              <div className="section-header">
                <div>
                  <h2 className="text-sm font-black">Live Activity</h2>
                  <p className="text-xs text-neutral-400">Recent SaaS admin audit events</p>
                </div>
                <LayoutDashboard className="h-5 w-5 text-neutral-500" />
              </div>
              <div className="max-h-[460px] divide-y divide-neutral-100 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="p-4 text-sm text-neutral-500">No audit events yet.</p>
                ) : activity.slice(0, 14).map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-neutral-100 text-neutral-500">
                        {item.action?.includes('SUSPEND') ? <CircleOff className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-900">{item.action?.replace(/^PLATFORM_/, '').replace(/_/g, ' ')}</p>
                        <p className="truncate text-xs text-neutral-500">{item.admin?.email || 'System'} - {item.createdAt ? timeAgo(item.createdAt) : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {selectedAgencyId ? (
        <AgencyDrawer
          agencyId={selectedAgencyId}
          range={range}
          moduleCatalog={moduleCatalog}
          onClose={() => setSelectedAgencyId(null)}
          onStatusChange={handleStatusChange}
        />
      ) : null}
    </PlatformLayout>
  );
}
