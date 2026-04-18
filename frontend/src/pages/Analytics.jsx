import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  useSalesReport, useLeadFunnelReport, useAgentPerformanceReport,
  usePackageReport, useLostLeadsReport, useResponseReport,
  useReviewReport, useSeasonalReport, useProfitReport, useSourceReport,
  useBookingReport,
} from '../hooks/useAnalytics';
import { useCampaignAnalytics } from '../hooks/useCampaigns';
import { formatCurrency, formatDate } from '../utils/formatters';
import { analyticsApi } from '../api/analyticsApi';


/* ───────────────── Color Palette ───────────────── */
const COLORS = ['#0d6a5f', '#14b8a6', '#0ea5e9', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const TEAL = '#0d6a5f';
const TEAL_LIGHT = '#14b8a6';

/* ───────────────── Tab definitions ───────────────── */
const TABS = [
  { key: 'sales', label: '💰 Sales', emoji: '💰' },
  { key: 'bookings', label: '📋 Bookings', emoji: '📋' },
  { key: 'leads', label: '🔁 Pipeline', emoji: '🔁' },
  { key: 'agents', label: '👨‍💼 Team', emoji: '👨‍💼' },
  { key: 'packages', label: '🧳 Packages', emoji: '🧳' },
  { key: 'lost', label: '📉 Lost Leads', emoji: '📉' },
  { key: 'response', label: '⏱ Response', emoji: '⏱' },
  { key: 'reviews', label: '⭐ Reviews', emoji: '⭐' },
  { key: 'seasonal', label: '📅 Trends', emoji: '📅' },
  { key: 'profit', label: '💸 Profit', emoji: '💸' },
  { key: 'sources', label: '📦 Sources', emoji: '📦' },
  { key: 'campaigns', label: '📣 Campaigns', emoji: '📣' },
];

/* ───────────────── Date Range Presets ───────────────── */
const DATE_PRESETS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: 'This Month', days: 'month' },
  { label: 'This Year', days: 'year' },
];

function getDateRange(preset) {
  const end = new Date();
  let start;
  if (preset === 'month') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (preset === 'year') {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    start = new Date(end.getTime() - preset * 86400000);
  }
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  };
}

/* ───────────────── Shared Components ───────────────── */

function KpiCard({ label, value, subValue, change, prefix = '' }) {
  const isUp = change > 0;
  const isDown = change < 0;
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">{prefix}{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {change !== null && change !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${isUp ? 'bg-emerald-50 text-emerald-600' : isDown ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {Math.abs(change)}%
          </span>
        )}
        {subValue && <span className="text-xs text-slate-400">{subValue}</span>}
      </div>
    </div>
  );
}

function ReportSection({ title, description, children, onExport }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        {onExport && (
          <button onClick={onExport} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
            ↓ Export CSV
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Loading chart data...</div>;
}

function EmptyState({ message }) {
  return <div className="flex h-48 items-center justify-center text-sm text-slate-400">{message || 'No data available for this period.'}</div>;
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-1 text-xs font-bold text-slate-500">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── CSV Download helper ────── */
async function downloadCsv(type, params) {
  try {
    const blob = await analyticsApi.exportCsv(type, params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. SALES REPORT TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function SalesTab({ params }) {
  const { data, isLoading } = useSalesReport(params);
  const d = data?.data || {};

  const chartData = useMemo(() =>
    (d.revenueByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: Math.round((parseInt(r.revenue, 10) || 0) / 100),
      count: parseInt(r.count, 10) || 0,
    })), [d.revenueByDay]);

  const destData = useMemo(() =>
    (d.revenueByDestination || []).map((r) => ({
      name: r.destination,
      revenue: Math.round((parseInt(r.revenue, 10) || 0) / 100),
      bookings: parseInt(r.booking_count, 10) || 0,
    })), [d.revenueByDestination]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Revenue" value={formatCurrency(d.totalRevenue || 0)} change={d.revenueChange} subValue="vs prior period" />
        <KpiCard label="Bookings" value={d.totalBookings || 0} change={d.prevBookings ? parseFloat(((d.totalBookings - d.prevBookings) / d.prevBookings * 100).toFixed(1)) : null} subValue="this period" />
        <KpiCard label="Avg Booking Value" value={formatCurrency(d.avgBookingValue || 0)} />
        <KpiCard label="Outstanding" value={formatCurrency(d.outstanding || 0)} subValue="pending payments" />
      </div>

      <ReportSection title="Revenue Over Time" description="Daily revenue trend" onExport={() => downloadCsv('sales', params)}>
        {chartData.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TEAL} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
              <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} />
              <Area type="monotone" dataKey="revenue" stroke={TEAL} strokeWidth={2.5} fill="url(#revGrad)" name="Revenue (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Revenue by Destination" description="Top destinations by collection">
          {destData.length === 0 ? <EmptyState message="No destination data yet." /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={destData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#475569' }} width={100} />
                <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} />
                <Bar dataKey="revenue" fill={TEAL} radius={[0, 6, 6, 0]} name="Revenue (₹)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection title="Revenue by Package" description="Top packages by collection">
          {(d.revenueByPackage || []).length === 0 ? <EmptyState message="No package revenue yet." /> : (
            <div className="space-y-3">
              {(d.revenueByPackage || []).slice(0, 8).map((r, i) => {
                const rev = parseInt(r.getDataValue?.('revenue') || r.dataValues?.revenue || 0, 10);
                const name = r.booking?.package?.name || r.dataValues?.booking?.package?.name || 'Unknown';
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
                      <span className="text-sm font-medium text-slate-700">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(rev)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LEAD & CONVERSION FUNNEL
   ═══════════════════════════════════════════════════════════════════════════ */

function LeadFunnelTab({ params }) {
  const { data, isLoading } = useLeadFunnelReport(params);
  const d = data?.data || {};

  const funnelData = d.funnel || [];
  const maxCount = Math.max(...funnelData.map((f) => f.count), 1);

  const chartData = useMemo(() =>
    (d.leadsByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      leads: parseInt(r.count, 10) || 0,
    })), [d.leadsByDay]);

  const statusData = useMemo(() =>
    (d.leadsByStatus || []).map((r) => ({
      name: r.status,
      value: parseInt(r.count, 10),
    })), [d.leadsByStatus]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Leads" value={d.totalLeads || 0} change={d.leadsChange} subValue="vs prior period" />
        <KpiCard label="Conversion Rate" value={`${d.conversionRate || 0}%`} subValue="Lead → Booked" />
        <KpiCard label="Enquiries" value={(d.leadsByStatus || []).reduce((s, r) => r.status !== 'JUST_CONTACTED' && r.status !== 'NEW' ? s + parseInt(r.count, 10) : s, 0)} />
        <KpiCard label="Booked" value={(d.leadsByStatus || []).find((r) => r.status === 'BOOKED')?.count || 0} />
      </div>

      <ReportSection title="Conversion Funnel" description="Lead → Enquiry → Contacted → Quoted → Booked" onExport={() => downloadCsv('leads', params)}>
        <div className="space-y-3 py-2">
          {funnelData.map((stage, i) => {
            const width = Math.max(12, (stage.count / maxCount) * 100);
            const rate = i > 0 && funnelData[i - 1].count > 0
              ? ((stage.count / funnelData[i - 1].count) * 100).toFixed(0) : null;
            return (
              <div key={stage.stage} className="group">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">{stage.stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{stage.count}</span>
                    {rate && <span className="text-[10px] font-semibold text-slate-400">({rate}%)</span>}
                  </div>
                </div>
                <div className="h-8 w-full rounded-lg bg-slate-100">
                  <div
                    className="flex h-full items-center rounded-lg px-3 text-xs font-bold text-white transition-all duration-500"
                    style={{ width: `${width}%`, background: `linear-gradient(90deg, ${TEAL}, ${TEAL_LIGHT})` }}
                  >
                    {width > 20 && stage.count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ReportSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Leads Over Time" description="Daily new leads">
          {chartData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="leads" stroke="#0ea5e9" strokeWidth={2} fill="url(#leadGrad)" name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection title="Lead Status Distribution">
          {statusData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name" paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. AGENT PERFORMANCE
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentTab({ params }) {
  const { data, isLoading } = useAgentPerformanceReport(params);
  const agents = data?.data?.agents || [];

  if (isLoading) return <ChartSkeleton />;

  const chartData = agents.map((a) => ({
    name: a.name?.split(' ')[0] || 'Agent',
    leads: a.leadsAssigned,
    booked: a.leadsConverted,
    revenue: Math.round(a.revenue / 100),
  }));

  return (
    <div className="space-y-5">
      <ReportSection title="Agent Leaderboard" description="Performance ranking by revenue" onExport={() => downloadCsv('agents', params)}>
        {agents.length === 0 ? <EmptyState message="No agents found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Booked</th>
                  <th className="pb-3 pr-4 text-right">Conv. %</th>
                  <th className="pb-3 pr-4 text-right">Messages</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {agents.map((a, i) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/50">
                    <td className="py-3 pr-4">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.role}</p>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm font-medium text-slate-600">{a.leadsAssigned}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-emerald-600">{a.leadsConverted}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${a.conversionRate >= 20 ? 'bg-emerald-50 text-emerald-700' : a.conversionRate >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {a.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm text-slate-600">{a.messagesSent}</td>
                    <td className="py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {chartData.length > 0 && (
        <ReportSection title="Agent Comparison" description="Leads assigned vs. booked per agent">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="leads" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Leads Assigned" />
              <Bar dataKey="booked" fill={TEAL} radius={[4, 4, 0, 0]} name="Booked" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. PACKAGE / DESTINATION REPORT
   ═══════════════════════════════════════════════════════════════════════════ */

function PackageTab({ params }) {
  const { data, isLoading } = usePackageReport(params);
  const packages = data?.data?.packages || [];

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <ReportSection title="Package Performance" description="Bookings, leads, and conversion per package" onExport={() => downloadCsv('packages', params)}>
        {packages.length === 0 ? <EmptyState message="No package data yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Package</th>
                  <th className="pb-3 pr-4">Destination</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Bookings</th>
                  <th className="pb-3 pr-4 text-right">Conv. %</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {packages.map((p, i) => (
                  <tr key={p.package?.id || i} className="transition hover:bg-slate-50/50">
                    <td className="py-3 pr-4 text-sm text-slate-400">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-slate-800">{p.package?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-400">{p.package?.category || ''}</p>
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600">{(p.package?.destinations || []).join(', ') || '-'}</td>
                    <td className="py-3 pr-4 text-right text-sm text-slate-600">{p.leads}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-emerald-600">{p.bookingCount}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${p.conversionRate >= 30 ? 'bg-emerald-50 text-emerald-700' : p.conversionRate >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(p.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {packages.length > 0 && (
        <ReportSection title="Bookings by Package" description="Visual comparison">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={packages.slice(0, 8).map((p) => ({ name: (p.package?.name || 'N/A').substring(0, 15), bookings: p.bookingCount, leads: p.leads }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="leads" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Enquiries" />
              <Bar dataKey="bookings" fill={TEAL} radius={[4, 4, 0, 0]} name="Bookings" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LOST LEADS REPORT
   ═══════════════════════════════════════════════════════════════════════════ */

function LostLeadsTab({ params }) {
  const { data, isLoading } = useLostLeadsReport(params);
  const d = data?.data || {};

  const reasonData = useMemo(() => {
    const reasons = (d.lostReasons || []).map((r) => ({ name: r.lostReason, value: parseInt(r.count, 10) }));
    if (d.noReasonCount > 0) reasons.push({ name: 'No reason given', value: d.noReasonCount });
    return reasons;
  }, [d.lostReasons, d.noReasonCount]);

  const trendData = useMemo(() =>
    (d.lostByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      lost: parseInt(r.count, 10),
    })), [d.lostByDay]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Lost Leads" value={d.lostCount || 0} />
        <KpiCard label="Loss Rate" value={`${d.lossRate || 0}%`} subValue="of total leads" />
        <KpiCard label="Total Leads" value={d.totalLeads || 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Lost Reasons" description="Why customers didn't convert" onExport={() => downloadCsv('lost', params)}>
          {reasonData.length === 0 ? <EmptyState message="No lost reason data." /> : (
            <div className="flex flex-col items-center gap-4 md:flex-row">
              <div className="w-full md:w-1/2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={reasonData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" nameKey="name" paddingAngle={3}>
                      {reasonData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2 md:w-1/2">
                {reasonData.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-slate-600">{r.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportSection>

        <ReportSection title="Lost Leads Trend" description="Over time">
          {trendData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="lostGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="lost" stroke="#ef4444" strokeWidth={2} fill="url(#lostGrad)" name="Lost Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. RESPONSE & FOLLOW-UP
   ═══════════════════════════════════════════════════════════════════════════ */

function ResponseTab({ params }) {
  const { data, isLoading } = useResponseReport(params);
  const d = data?.data || {};

  const distData = useMemo(() => {
    const order = ['Under 5 min', '5-15 min', '15-60 min', '1-24 hours', 'Over 24 hours'];
    const colors = ['#10b981', '#14b8a6', '#f59e0b', '#f97316', '#ef4444'];
    return order.map((bucket, i) => {
      const match = (d.responseDistribution || []).find((r) => r.bucket === bucket);
      return { name: bucket, count: parseInt(match?.count || '0', 10), fill: colors[i] };
    });
  }, [d.responseDistribution]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Avg Response Time" value={`${d.avgResponseMinutes || 0} min`} subValue={d.conversationCount ? `from ${d.conversationCount} conversations` : ''} />
        <KpiCard label="Missed Follow-ups" value={d.missedFollowUps || 0} subValue="leads without agent reply" />
        <KpiCard label="Conversations" value={d.conversationCount || 0} />
      </div>

      <ReportSection title="Response Time Distribution" description="How quickly your team responds">
        {distData.every((d) => d.count === 0) ? <EmptyState message="No response data yet." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Conversations">
                {distData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-800">💡 Tip: Faster response = more bookings</p>
        <p className="mt-1 text-sm text-amber-700">Agencies that respond within 5 minutes have 3x higher conversion rates. {d.avgResponseMinutes > 15 ? 'Your current response time is above 15 minutes — consider enabling notification alerts.' : d.avgResponseMinutes > 0 ? 'Great job keeping response times low!' : ''}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. CUSTOMER REVIEWS
   ═══════════════════════════════════════════════════════════════════════════ */

function ReviewTab({ params }) {
  const { data, isLoading } = useReviewReport(params);
  const d = data?.data || {};

  const ratingData = useMemo(() =>
    [5, 4, 3, 2, 1].map((r) => {
      const match = (d.ratingDistribution || []).find((x) => parseInt(x.rating, 10) === r);
      return { stars: `${r} ⭐`, count: parseInt(match?.count || '0', 10) };
    }), [d.ratingDistribution]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Avg Rating" value={`${d.avgRating || 0} ⭐`} />
        <KpiCard label="Total Reviews" value={d.totalReviews || 0} />
        <KpiCard label="Negative Reviews" value={(d.negativeReviews || []).length} subValue="rating ≤ 2" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Rating Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="stars" type="category" tick={{ fontSize: 12, fill: '#475569' }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Reviews" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>

        <ReportSection title="Ratings by Destination" description="Top rated destinations">
          {(d.reviewsByDestination || []).length === 0 ? <EmptyState message="No destination reviews yet." /> : (
            <div className="space-y-2">
              {(d.reviewsByDestination || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{r.destination}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-600">{r.avgRating} ⭐</span>
                    <span className="text-xs text-slate-400">({r.count} reviews)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>
      </div>

      {(d.negativeReviews || []).length > 0 && (
        <ReportSection title="⚠️ Negative Feedback" description="Reviews with rating ≤ 2">
          <div className="space-y-3">
            {d.negativeReviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{r.customer?.name || 'Anonymous'}</p>
                  <span className="text-sm font-bold text-rose-600">{r.rating} ⭐</span>
                </div>
                {r.testimonial && <p className="mt-2 text-sm text-slate-600">&quot;{r.testimonial}&quot;</p>}
                {r.destination && <p className="mt-1 text-xs text-slate-400">Destination: {r.destination}</p>}
              </div>
            ))}
          </div>
        </ReportSection>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. SEASONAL / TRENDS
   ═══════════════════════════════════════════════════════════════════════════ */

function SeasonalTab() {
  const { data, isLoading } = useSeasonalReport();
  const d = data?.data || {};

  const bookingData = useMemo(() =>
    (d.bookingsByMonth || []).map((r) => ({
      month: new Date(r.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      bookings: r.bookings,
      revenue: Math.round(r.revenue / 100),
    })), [d.bookingsByMonth]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      {d.peakMonth && d.slowMonth && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">🔥 Peak Month</p>
            <p className="mt-2 text-2xl font-bold text-emerald-800">
              {new Date(d.peakMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-1 text-sm text-emerald-600">{d.peakMonth.bookings} bookings · {formatCurrency(d.peakMonth.revenue)}</p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">📉 Slowest Month</p>
            <p className="mt-2 text-2xl font-bold text-slate-700">
              {new Date(d.slowMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-1 text-sm text-slate-500">{d.slowMonth.bookings} bookings · {formatCurrency(d.slowMonth.revenue)}</p>
          </div>
        </div>
      )}

      <ReportSection title="Monthly Bookings & Revenue" description="Last 24 months trend">
        {bookingData.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={bookingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar yAxisId="left" dataKey="bookings" fill={TEAL} radius={[4, 4, 0, 0]} name="Bookings" />
              <Bar yAxisId="right" dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-5">
        <p className="text-sm font-bold text-blue-800">📅 Use this data to plan</p>
        <p className="mt-1 text-sm text-blue-700">• Run promotional offers during slow months<br/>• Increase staffing during peak seasons<br/>• Adjust pricing based on demand patterns</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. PROFIT REPORT
   ═══════════════════════════════════════════════════════════════════════════ */

function ProfitTab({ params }) {
  const { data, isLoading } = useProfitReport(params);
  const d = data?.data || {};

  if (isLoading) return <ChartSkeleton />;

  const pkgData = (d.byPackage || []).map((p) => ({
    name: (p.packageName || 'N/A').substring(0, 18),
    selling: Math.round(p.selling / 100),
    cost: Math.round(p.cost / 100),
    profit: Math.round(p.profit / 100),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Selling" value={formatCurrency(d.totalSelling || 0)} />
        <KpiCard label="Estimated Cost" value={formatCurrency(d.totalCost || 0)} />
        <KpiCard label="Estimated Profit" value={formatCurrency(d.totalProfit || 0)} />
        <KpiCard label="Profit Margin" value={`${d.profitMargin || 0}%`} />
      </div>

      <ReportSection title="Profit by Package" description="Selling price vs estimated base cost (basePrice × travellers)">
        {pkgData.length === 0 ? <EmptyState message="No profit data yet. Book packages to see estimates." /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pkgData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
              <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="selling" fill={TEAL} radius={[4, 4, 0, 0]} name="Selling (₹)" />
              <Bar dataKey="cost" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Base Cost (₹)" />
              <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit (₹)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      {(d.byPackage || []).length > 0 && (
        <ReportSection title="Package Margins" description="Margin ranking">
          <div className="space-y-2">
            {(d.byPackage || []).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{p.packageName}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">{p.bookings} bookings</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.margin >= 20 ? 'bg-emerald-50 text-emerald-700' : p.margin >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                    {p.margin}% margin
                  </span>
                  <span className="text-sm font-bold text-emerald-700">{formatCurrency(p.profit)}</span>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      <div className="rounded-[14px] border border-violet-200 bg-violet-50 p-5">
        <p className="text-sm font-bold text-violet-800">💡 Note on Profit Estimation</p>
        <p className="mt-1 text-sm text-violet-700">Profit is estimated using <strong>basePrice × travellers</strong> as the cost baseline. For accurate profit tracking, consider adding actual cost fields to your packages (hotel, transport, etc.).</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. SOURCE REPORT
   ═══════════════════════════════════════════════════════════════════════════ */

function SourceTab({ params }) {
  const { data, isLoading } = useSourceReport(params);
  const d = data?.data || {};
  const sources = d.sources || [];

  const pieData = sources.map((s) => ({ name: formatSourceName(s.source), value: s.leads }));

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Lead Sources" description="Where your customers come from">
          {pieData.length === 0 ? <EmptyState message="No source data yet." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection title="Source Performance" description="Conversion per source">
          {sources.length === 0 ? <EmptyState /> : (
            <div className="space-y-2">
              {sources.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium text-slate-700">{formatSourceName(s.source)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{s.leads} leads</span>
                    <span className="text-sm font-semibold text-emerald-600">{s.booked} booked</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.conversionRate >= 20 ? 'bg-emerald-50 text-emerald-700' : s.conversionRate >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.conversionRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>
      </div>

      {sources.length > 0 && (
        <ReportSection title="Leads by Source" description="Comparison bar chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sources.map((s) => ({ name: formatSourceName(s.source), leads: s.leads, booked: s.booked }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="leads" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Total Leads" />
              <Bar dataKey="booked" fill={TEAL} radius={[4, 4, 0, 0]} name="Booked" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>
      )}

      <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-5">
        <p className="text-sm font-bold text-sky-800">👉 Use this to decide marketing budget</p>
        <p className="mt-1 text-sm text-sky-700">Double down on sources with high conversion rates. If Instagram gives 120 leads but only 5% convert, while WhatsApp gives 80 leads with 25% conversion — invest more in WhatsApp.</p>
      </div>
    </div>
  );
}

function formatSourceName(source) {
  const map = {
    whatsapp_organic: 'WhatsApp Organic',
    instagram_ad: 'Instagram Ads',
    facebook_ad: 'Facebook Ads',
    referral: 'Referral',
    qr_code: 'QR Code',
    website: 'Website',
    manual: 'Manual Entry',
    whatsapp: 'WhatsApp',
  };
  return map[source] || (source || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. CAMPAIGN ANALYTICS
   ═══════════════════════════════════════════════════════════════════════════ */

function CampaignAnalyticsTab({ params }) {
  const { data, isLoading } = useCampaignAnalytics(params);
  const d = data?.data || {};

  const chartData = (d.campaignsByDay || []).map((r) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    campaigns: r.count,
    recipients: r.recipients,
  }));

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Campaigns" value={d.totalCampaigns || 0} subValue={`${d.sentCampaigns || 0} sent`} />
        <KpiCard label="Total Recipients" value={(d.totalRecipients || 0).toLocaleString()} />
        <KpiCard label="Delivery Rate" value={`${d.deliveryRate || 0}%`} subValue="delivered / sent" />
        <KpiCard label="Read Rate" value={`${d.readRate || 0}%`} subValue="read / delivered" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Delivered" value={(d.totalDelivered || 0).toLocaleString()} />
        <KpiCard label="Read" value={(d.totalRead || 0).toLocaleString()} />
        <KpiCard label="Reply Rate" value={`${d.replyRate || 0}%`} subValue={`${(d.totalReplied || 0).toLocaleString()} replies`} />
      </div>

      <ReportSection title="Campaigns Over Time" description="Daily campaign sends">
        {chartData.length === 0 ? <EmptyState message="No campaign data yet." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar yAxisId="left" dataKey="campaigns" fill={TEAL} radius={[4, 4, 0, 0]} name="Campaigns" />
              <Bar yAxisId="right" dataKey="recipients" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Recipients" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Top Performing Campaigns" description="By read count">
          {(d.topCampaigns || []).length === 0 ? <EmptyState message="No sent campaigns yet." /> : (
            <div className="space-y-2">
              {(d.topCampaigns || []).map((c, i) => (
                <div key={c.id || i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.template?.displayName || 'Custom'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{c.totalRecipients || 0} sent</span>
                    <span className="text-sm font-bold text-teal-700">{c.read || 0} read</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        <ReportSection title="Template Performance" description="Read rates by template">
          {(d.templateStats || []).length === 0 ? <EmptyState message="No template data yet." /> : (
            <div className="space-y-2">
              {(d.templateStats || []).map((t, i) => (
                <div key={t.templateId || i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.template?.icon || '📝'}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.template?.displayName || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{t.campaignCount} campaigns</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{t.totalSent} sent</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.readRate >= 50 ? 'bg-emerald-50 text-emerald-700' : t.readRate >= 25 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.readRate}% read
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>
      </div>

      {d.totalFailed > 0 && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-bold text-rose-800">⚠️ {d.totalFailed.toLocaleString()} messages failed delivery</p>
          <p className="mt-1 text-sm text-rose-700">Check individual campaign details for error messages. Common causes: invalid phone numbers, expired templates, or rate limits.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN REPORTS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('sales');
  const [datePreset, setDatePreset] = useState(30);
  const params = useMemo(() => getDateRange(datePreset), [datePreset]);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <section className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-950">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Deep business insights across 12 reports. Export any report as CSV.</p>
        </div>
        <div className="flex items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDatePreset(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${datePreset === p.days ? 'bg-[#0d6a5f] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'bg-[#0d6a5f] text-white shadow-md shadow-teal-500/20'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label.replace(tab.emoji + ' ', '')}</span>
          </button>
        ))}
      </section>

      {/* Active Tab Content */}
      <section>
        {activeTab === 'sales' && <SalesTab params={params} />}
        {activeTab === 'bookings' && <BookingTab params={params} />}
        {activeTab === 'leads' && <LeadFunnelTab params={params} />}
        {activeTab === 'agents' && <AgentTab params={params} />}
        {activeTab === 'packages' && <PackageTab params={params} />}
        {activeTab === 'lost' && <LostLeadsTab params={params} />}
        {activeTab === 'response' && <ResponseTab params={params} />}
        {activeTab === 'reviews' && <ReviewTab params={params} />}
        {activeTab === 'seasonal' && <SeasonalTab />}
        {activeTab === 'profit' && <ProfitTab params={params} />}
        {activeTab === 'sources' && <SourceTab params={params} />}
        {activeTab === 'campaigns' && <CampaignAnalyticsTab params={params} />}
      </section>
    </div>
  );
}
