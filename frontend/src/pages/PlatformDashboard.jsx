import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleOff,
  LogOut,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { platformApi } from '../api/platformApi';
import { usePlatformAuthStore } from '../store/platformAuthStore';
import { formatCurrency, formatDateTime, timeAgo } from '../utils/formatters';

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
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-neutral-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">WAYON SaaS Admin</p>
              <p className="truncate text-xs font-semibold text-neutral-400">{admin?.email}</p>
            </div>
          </div>
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
      </header>
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}

function AgencyDrawer({ agencyId, onClose, onStatusChange }) {
  const [confirming, setConfirming] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['platform-agency', agencyId],
    queryFn: () => platformApi.agency(agencyId),
    enabled: !!agencyId,
    refetchInterval: 30000,
  });

  const detail = data?.data;
  const agency = detail?.agency;
  const nextActive = !agency?.isActive;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-neutral-950/35 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-2xl lg:max-w-[760px]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Agency Detail</p>
            <h2 className="mt-1 truncate text-xl font-black text-neutral-950">
              {isLoading ? 'Loading agency' : agency?.name}
            </h2>
            {agency ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthLabel}</span>
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
          <div className="p-5 text-sm text-neutral-500">Loading platform view...</div>
        ) : agency ? (
          <div className="flex-1 overflow-y-auto p-5">
            <section className="grid gap-3 sm:grid-cols-3">
              <KpiCard label="Health" value={`${agency.healthScore}%`} note="Current score" icon={Activity} tone="bg-sky-50 text-sky-700" />
              <KpiCard label="Online Agents" value={agency.metrics.onlineAgents} note={`${agency.metrics.totalAgents} total users`} icon={Users} tone="bg-emerald-50 text-emerald-700" />
              <KpiCard label="Revenue" value={formatCurrency(agency.metrics.totalRevenue)} note="Paid payments" icon={CheckCircle2} tone="bg-amber-50 text-amber-700" />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <div>
                    <h3 className="text-sm font-black">Team Login Status</h3>
                    <p className="text-xs text-neutral-400">Online, recent, offline, and stale sessions</p>
                  </div>
                </div>
                <div className="divide-y divide-neutral-100">
                  {detail.agents.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No agents found.</p>
                  ) : detail.agents.map((agent) => (
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
                    <p className="text-xs text-neutral-400">WhatsApp session status, not app login</p>
                  </div>
                </div>
                <div className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
                  {detail.customerActivity.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No customer activity yet.</p>
                  ) : detail.customerActivity.map((customer) => (
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

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="shell-panel overflow-hidden">
                <div className="section-header">
                  <h3 className="text-sm font-black">Recent Failed Messages</h3>
                </div>
                <div className="divide-y divide-neutral-100">
                  {detail.failedMessages.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No failed messages.</p>
                  ) : detail.failedMessages.map((message) => (
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
                <div className="divide-y divide-neutral-100">
                  {detail.overdueFollowUps.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No overdue follow-ups.</p>
                  ) : detail.overdueFollowUps.map((followUp) => (
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
  const [filters, setFilters] = useState({ q: '', status: '', plan: '', whatsapp: '' });
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);

  const { data: overviewResponse, isLoading: overviewLoading } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: platformApi.overview,
    refetchInterval: 30000,
  });

  const { data: agenciesResponse, isLoading: agenciesLoading } = useQuery({
    queryKey: ['platform-agencies', filters],
    queryFn: () => platformApi.agencies(filters),
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

  const overview = overviewResponse?.data?.totals || {};
  const agencies = agenciesResponse?.data || [];
  const activity = activityResponse?.data || [];

  const urgentAgencies = useMemo(
    () => agencies.filter((agency) => agency.healthScore < 85 || agency.metrics.failedMessages24h > 0 || agency.metrics.overdueFollowUps > 0).slice(0, 6),
    [agencies]
  );

  const handleStatusChange = (id, isActive, done) => {
    statusMutation.mutate({ id, isActive }, { onSettled: done });
  };

  return (
    <PlatformLayout>
      <div className="space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Health Cockpit</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">SaaS Admin Portal</h1>
            <p className="mt-1 text-sm text-neutral-500">Every tenant, login state, customer session, and operational risk in one console.</p>
          </div>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-500">
            <Activity className="h-4 w-4 text-emerald-600" />
            Auto-refreshes every 30 seconds
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Agencies" value={overviewLoading ? '-' : overview.totalAgencies || 0} note={`${overview.activeAgencies || 0} active`} icon={Building2} tone="bg-sky-50 text-sky-700" />
          <KpiCard label="WhatsApp Connected" value={overviewLoading ? '-' : overview.connectedWhatsApp || 0} note="Connected channels" icon={Wifi} tone="bg-emerald-50 text-emerald-700" />
          <KpiCard label="Active Customers" value={overviewLoading ? '-' : overview.activeCustomers || 0} note="Last 15 minutes" icon={MessageCircle} tone="bg-indigo-50 text-indigo-700" />
          <KpiCard label="Urgent Issues" value={(overview.failedMessages24h || 0) + (overview.overdueFollowUps || 0)} note={`${overview.failedMessages24h || 0} failed, ${overview.overdueFollowUps || 0} overdue`} icon={AlertTriangle} tone="bg-rose-50 text-rose-700" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="shell-panel p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_190px]">
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
                    <span>{agency.metrics.onlineAgents} agents online</span>
                    <span>{agency.metrics.activeCustomers} active customers</span>
                    <span>{agency.metrics.failedMessages24h} failed msgs</span>
                    <span>{agency.metrics.overdueFollowUps} overdue</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="data-table-wrapper desktop-table">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left">
                  <thead>
                    <tr className="data-table-head">
                      {['Agency', 'Health', 'Plan', 'WhatsApp', 'Agents', 'Customers', 'Failures', 'Last Activity'].map((heading) => (
                        <th key={heading} className="data-table-th">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agenciesLoading ? (
                      <tr><td colSpan={8} className="p-8 text-sm text-neutral-500">Loading agencies...</td></tr>
                    ) : agencies.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-sm text-neutral-500">No agencies match these filters.</td></tr>
                    ) : agencies.map((agency) => (
                      <tr key={agency.id} className="data-table-row" onClick={() => setSelectedAgencyId(agency.id)}>
                        <td className="data-table-td">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-neutral-950">{agency.name}</p>
                            <p className="truncate text-xs text-neutral-500">{agency.email}</p>
                          </div>
                        </td>
                        <td className="data-table-td">
                          <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}% {agency.healthLabel}</span>
                        </td>
                        <td className="data-table-td text-sm font-semibold text-neutral-600">{agency.plan}</td>
                        <td className="data-table-td">
                          <span className={cx('badge', statusTone(agency.whatsappConnectionStatus))}>{agency.whatsappConnectionStatus}</span>
                        </td>
                        <td className="data-table-td text-sm text-neutral-600">{agency.metrics.onlineAgents}/{agency.metrics.totalAgents}</td>
                        <td className="data-table-td text-sm text-neutral-600">{agency.metrics.activeCustomers} active</td>
                        <td className="data-table-td text-sm text-neutral-600">{agency.metrics.failedMessages24h} failed - {agency.metrics.overdueFollowUps} overdue</td>
                        <td className="data-table-td text-sm text-neutral-500">{agency.metrics.lastActivityAt ? timeAgo(agency.metrics.lastActivityAt) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="shell-panel overflow-hidden">
              <div className="section-header">
                <div>
                  <h2 className="text-sm font-black">Urgent Agencies</h2>
                  <p className="text-xs text-neutral-400">Lowest health and active incidents</p>
                </div>
              </div>
              <div className="divide-y divide-neutral-100">
                {urgentAgencies.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    No urgent agency issues.
                  </div>
                ) : urgentAgencies.map((agency) => (
                  <button key={agency.id} type="button" onClick={() => setSelectedAgencyId(agency.id)} className="block w-full px-4 py-3 text-left hover:bg-neutral-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-neutral-900">{agency.name}</p>
                      <span className={cx('badge', statusTone(agency.healthLabel))}>{agency.healthScore}%</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {agency.metrics.failedMessages24h} failed messages - {agency.metrics.overdueFollowUps} overdue follow-ups
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="shell-panel overflow-hidden">
              <div className="section-header">
                <div>
                  <h2 className="text-sm font-black">Platform Activity</h2>
                  <p className="text-xs text-neutral-400">Recent SaaS admin audit events</p>
                </div>
              </div>
              <div className="max-h-[460px] divide-y divide-neutral-100 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="p-4 text-sm text-neutral-500">No audit events yet.</p>
                ) : activity.slice(0, 12).map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-neutral-100 text-neutral-500">
                        {item.action?.includes('SUSPEND') ? <CircleOff className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-900">{item.action?.replace(/^PLATFORM_/, '').replace(/_/g, ' ')}</p>
                        <p className="truncate text-xs text-neutral-500">{item.admin?.email || 'System'} - {timeAgo(item.createdAt)}</p>
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
          onClose={() => setSelectedAgencyId(null)}
          onStatusChange={handleStatusChange}
        />
      ) : null}
    </PlatformLayout>
  );
}
