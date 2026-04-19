import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAnalyticsSummary, useSalesReport, useLeadFunnelReport } from '../hooks/useAnalytics';
import { useLiveMessages } from '../hooks/useMessages';
import { useBookings } from '../hooks/useBookings';
import { formatDate, formatCurrency } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';

/* ── Color palette ───────────────────────────────── */
const DARK = '#2d2d2d';
const GREY = '#6b6b6b';
const PIE_COLORS = ['#2d2d2d', '#525252', '#737373', '#8a8a8a', '#a3a3a3', '#b0b0b0', '#d4d4d4', '#404040'];

/* ── Helpers ──────────────────────────────────────── */
function statusCount(leadsByStatus, key) {
  return Number(leadsByStatus?.find((item) => item.status === key)?.count || 0);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const todayFormatted = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/* ── Custom Tooltip ──────────────────────────────── */
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#8a8a8a]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value?.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
}

/* ── Metric Card ─────────────────────────────────── */
function MetricCard({ label, value, note, icon, iconBg }) {
  return (
    <div className="group relative overflow-hidden rounded-[16px] border border-[#e5e5e5] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.1)]">
      {/* Subtle grey accent at top */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#404040] to-[#8a8a8a]" />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a]">{label}</p>
          <p className="mt-2.5 text-[32px] font-extrabold tracking-tight text-[#1a1a1a] leading-none">{value}</p>
          <p className="mt-2 text-[13px] text-[#6b6b6b]">{note}</p>
        </div>
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] ${iconBg} text-[20px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────── */
function DashSection({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-[16px] border border-[#e5e5e5] bg-white shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="flex items-center justify-between border-b border-[#ebebeb] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[#8a8a8a]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { data: analyticsResponse, isLoading: analyticsLoading } = useAnalyticsSummary();
  const { data: bookingsResponse } = useBookings({ pageSize: 6 });

  // Fetch sales for the last 30 days for the revenue chart
  const salesParams = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);
    return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
  }, []);
  const { data: salesResponse } = useSalesReport(salesParams);
  const { data: funnelResponse } = useLeadFunnelReport(salesParams);

  const analytics = analyticsResponse?.data || {};
  const bookings = bookingsResponse?.data?.data || [];
  const leadsByStatus = analytics.leadsByStatus || [];
  const salesData = salesResponse?.data || {};
  const funnelData = funnelResponse?.data || {};

  /* ── Prepare chart data ── */
  const revenueChartData = useMemo(() =>
    (salesData.revenueByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: Math.round((parseInt(r.revenue, 10) || 0) / 100),
      bookings: parseInt(r.count, 10) || 0,
    })), [salesData.revenueByDay]);

  const leadsChartData = useMemo(() =>
    (funnelData.leadsByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      leads: parseInt(r.count, 10) || 0,
    })), [funnelData.leadsByDay]);

  const pipelineStages = [
    { key: 'JUST_CONTACTED', label: 'Just Contacted', color: '#404040' },
    { key: 'PACKAGE_SEARCHED', label: 'Package Searched', color: '#525252' },
    { key: 'PACKAGE_INTERESTED', label: 'Interested', color: '#6b6b6b' },
    { key: 'CONTACTED', label: 'Contacted', color: '#8a8a8a' },
    { key: 'BOOKED', label: 'Booked', color: '#2d2d2d' },
  ];

  const pipelineBarData = pipelineStages.map((s) => ({
    name: s.label,
    count: statusCount(leadsByStatus, s.key),
    color: s.color,
  }));

  const pieData = leadsByStatus
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.status?.replace(/_/g, ' ') || 'Unknown',
      value: parseInt(s.count, 10),
    }));

  const totalPipelineLeads = pipelineBarData.reduce((s, d) => s + d.count, 0);

  const revenueDisplay = (analytics.totalRevenue || 0) / 100 >= 1
    ? `₹${((analytics.totalRevenue || 0) / 100).toLocaleString('en-IN')}`
    : '₹0';

  return (
    <div className="w-full space-y-6 animate-wizard-in">
      {/* ── Header ── */}
      <section className="flex flex-col gap-1 pb-2">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-[#1a1a1a]">
              {getGreeting()} 👋
            </h1>
            <p className="mt-1 text-sm text-[#8a8a8a]">{todayFormatted}</p>
          </div>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 rounded-[12px] bg-[#f0f0f0] px-3.5 py-2 text-[13px] font-semibold text-[#404040] transition hover:bg-[#e5e5e5]"
          >
            <span>📊</span> Full Analytics
          </Link>
        </div>
      </section>

      {/* ── KPI Metric Cards ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="New Leads"
          value={analytics.newLeadsToday || 0}
          note="Created today"
          icon="🎯"
          iconBg="bg-[#f0f0f0]"
        />
        <MetricCard
          label="Conversion"
          value={`${analytics.conversionRate || 0}%`}
          note="Lead to booking"
          icon="📈"
          iconBg="bg-[#f0f0f0]"
        />
        <MetricCard
          label="Confirmed Bookings"
          value={analytics.confirmedBookings || 0}
          note="Active departures"
          icon="✈️"
          iconBg="bg-[#f0f0f0]"
        />
        <MetricCard
          label="Revenue"
          value={revenueDisplay}
          note="Total confirmed"
          icon="💰"
          iconBg="bg-[#f0f0f0]"
        />
      </section>

      {/* ── Charts Row 1: Revenue Trend + Pipeline Funnel ── */}
      <section className="grid gap-4 xl:grid-cols-5">
        {/* Revenue Trend - wider */}
        <DashSection
          title="Revenue Trend"
          subtitle="Last 30 days"
          className="xl:col-span-3"
          action={
            <Link to="/analytics" className="text-xs font-semibold text-[#525252] hover:text-[#1a1a1a] transition">
              View details →
            </Link>
          }
        >
          {revenueChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-[#8a8a8a]">
              No revenue data yet. Start converting leads!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DARK} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={DARK} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} />
                <Area type="monotone" dataKey="revenue" stroke={DARK} strokeWidth={2.5} fill="url(#dashRevGrad)" name="Revenue (₹)" dot={false} activeDot={{ r: 5, fill: DARK, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </DashSection>

        {/* Pipeline Funnel */}
        <DashSection
          title="Pipeline Funnel"
          subtitle={`${totalPipelineLeads} total leads`}
          className="xl:col-span-2"
        >
          <div className="space-y-3">
            {pipelineBarData.map((stage) => {
              const pct = totalPipelineLeads > 0 ? Math.max(6, (stage.count / totalPipelineLeads) * 100) : 6;
              return (
                <div key={stage.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#525252]">{stage.name}</span>
                    <span className="text-[13px] font-bold text-[#1a1a1a]">{stage.count}</span>
                  </div>
                  <div className="h-7 w-full overflow-hidden rounded-lg bg-[#f0f0f0]">
                    <div
                      className="flex h-full items-center rounded-lg px-2.5 text-[10px] font-bold text-white transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`,
                      }}
                    >
                      {pct > 18 && stage.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DashSection>
      </section>

      {/* ── Charts Row 2: Lead Status Donut + Leads Over Time ── */}
      <section className="grid gap-4 xl:grid-cols-2">
        {/* Lead Status Donut */}
        <DashSection title="Lead Status Distribution" subtitle="Current breakdown">
          {pieData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-[#8a8a8a]">No lead data yet.</div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={52}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e5e5e5',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2 sm:w-1/2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[10px] bg-[#fafafa] px-3 py-2 transition hover:bg-[#f0f0f0]">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[13px] text-[#525252] capitalize">{d.name.toLowerCase()}</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#1a1a1a]">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DashSection>

        {/* Leads Over Time */}
        <DashSection title="Leads Over Time" subtitle="Last 30 days new inquiries">
          {leadsChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-[#8a8a8a]">No lead trend data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={leadsChartData}>
                <defs>
                  <linearGradient id="dashLeadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#525252" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#525252" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a8a8a' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="#525252"
                  strokeWidth={2.5}
                  fill="url(#dashLeadGrad)"
                  name="Leads"
                  dot={false}
                  activeDot={{ r: 5, fill: '#525252', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </DashSection>
      </section>

      {/* ── Upcoming Departures Table ── */}
      <DashSection
        title="Upcoming Departures"
        subtitle="Bookings ordered by travel date"
        action={
          <Link to="/payments" className="inline-flex items-center gap-1 rounded-[10px] bg-[#f0f0f0] px-3 py-1.5 text-xs font-semibold text-[#525252] transition hover:bg-[#e5e5e5] hover:text-[#1a1a1a]">
            💳 View payments
          </Link>
        }
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#ebebeb]">
                {['Traveler', 'Trip', 'Travel Date', 'Status'].map((heading) => (
                  <th key={heading} className="pb-3 pr-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a] first:pl-0 last:pr-0 last:text-right">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f5]">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">✈️</span>
                      <p className="text-sm text-[#8a8a8a]">No upcoming bookings found.</p>
                      <Link to="/bookings" className="mt-1 text-xs font-semibold text-[#525252] hover:text-[#1a1a1a]">
                        View all bookings →
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="group transition hover:bg-[#fafafa]">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d2d2d] text-xs font-bold text-white">
                          {(booking.customer?.name || booking.bookingRef || '?')[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-[#2d2d2d] group-hover:text-[#1a1a1a]">
                          {booking.customer?.name || booking.bookingRef}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-[#525252]">{booking.package?.name || 'Custom itinerary'}</td>
                    <td className="py-3.5 pr-4 text-sm text-[#525252]">{formatDate(booking.travelDate)}</td>
                    <td className="py-3.5 text-right">
                      <span className={`badge ${getStatusTone(booking.status)}`}>{booking.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashSection>
    </div>
  );
}
