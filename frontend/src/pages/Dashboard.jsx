import { Suspense, lazy, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BoltIcon,
  ArrowTrendingUpIcon,
  PaperAirplaneIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAnalyticsSummary, useSalesReport, useLeadFunnelReport } from '../hooks/useAnalytics';
import { useBookings } from '../hooks/useBookings';
import { formatDate } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';
import { useIndustry } from '../hooks/useIndustry';

const DashboardCharts = lazy(() => import('../components/DashboardCharts').then((module) => ({
  default: function DashboardChartsBundle({ leadsChartData, pieData, revenueChartData, type }) {
    if (type === 'revenue') return <module.RevenueTrendChart data={revenueChartData} />;
    if (type === 'pie') return <module.LeadStatusDonut data={pieData} />;
    return <module.LeadsOverTimeChart data={leadsChartData} />;
  },
})));

function ChartFallback({ text = 'Loading chart...' }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-neutral-400">
      {text}
    </div>
  );
}

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
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const OPEN_LEAD_STATUSES = new Set([
  'JUST_CONTACTED',
  'PACKAGE_SEARCHED',
  'PACKAGE_INTERESTED',
  'CONTACTED',
  'NEW',
  'ENQUIRY',
  'QUOTED',
  'NEGOTIATING',
]);

const QUALIFIED_LEAD_STATUSES = new Set([
  'PACKAGE_SEARCHED',
  'PACKAGE_INTERESTED',
  'QUOTED',
  'NEGOTIATING',
]);

function MetricCard({ label, value, note, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{label}</p>
          <p className="mt-2.5 text-[32px] font-extrabold leading-none tracking-tight text-neutral-900">{value}</p>
          <p className="mt-2 text-[13px] text-neutral-500">{note}</p>
        </div>
        <div className={`kpi-icon ${iconBg} ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyPipelineState() {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-[var(--radius-md)] bg-neutral-50 px-4 py-8 text-center">
      <ClipboardDocumentListIcon className="h-8 w-8 text-neutral-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-700">No pipeline activity yet</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-400">
        New inquiries will appear here as soon as leads are created or imported.
      </p>
      <Link to="/leads" className="mt-3 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700">
        Open leads
      </Link>
    </div>
  );
}

function DashSection({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`section-card ${className}`}>
      <div className="section-header">
        <div>
          <h2 className="text-[15px] font-bold text-neutral-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { industry, t, moduleEnabled } = useIndustry();
  const { data: analyticsResponse } = useAnalyticsSummary();
  const { data: bookingsResponse } = useBookings({ pageSize: 6 });

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
  const bookingsLabel = t('bookings', 'Bookings');
  const isResort = industry === 'RESORT';
  const analyticsEnabled = moduleEnabled('/analytics');
  const bookingsEnabled = moduleEnabled('/bookings');
  const revenueEnabled = bookingsEnabled && moduleEnabled('/revenue');

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
    { key: 'JUST_CONTACTED', label: 'New', color: '#0ea5e9' },
    { key: 'PACKAGE_SEARCHED', label: 'Package Searched', color: '#f59e0b' },
    { key: 'PACKAGE_INTERESTED', label: 'Interested', color: '#6366f1' },
    { key: 'CONTACTED', label: 'Contacted', color: '#8b5cf6' },
    ...(bookingsEnabled ? [{ key: 'BOOKED', label: 'Booked', color: '#10b981' }] : []),
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
  const activeLeadCount = leadsByStatus.reduce((sum, item) => (
    OPEN_LEAD_STATUSES.has(item.status) ? sum + Number(item.count || 0) : sum
  ), 0);
  const qualifiedLeadCount = leadsByStatus.reduce((sum, item) => (
    QUALIFIED_LEAD_STATUSES.has(item.status) ? sum + Number(item.count || 0) : sum
  ), 0);

  const revenueDisplay = (analytics.totalRevenue || 0) / 100 >= 1
    ? `₹${((analytics.totalRevenue || 0) / 100).toLocaleString('en-IN')}`
    : '₹0';
  const metricCards = [
    {
      label: 'New Leads',
      value: analytics.newLeadsToday || 0,
      note: 'Created today',
      icon: BoltIcon,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    bookingsEnabled ? {
      label: 'Conversion',
      value: `${analytics.conversionRate || 0}%`,
      note: 'Lead to booking',
      icon: ArrowTrendingUpIcon,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    } : {
      label: 'Total Leads',
      value: analytics.totalLeads || 0,
      note: 'All captured inquiries',
      icon: UserGroupIcon,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    bookingsEnabled ? {
      label: `Confirmed ${bookingsLabel}`,
      value: analytics.confirmedBookings || 0,
      note: isResort ? 'Active reservations' : 'Active departures',
      icon: PaperAirplaneIcon,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    } : {
      label: 'Active Pipeline',
      value: activeLeadCount,
      note: 'Open leads to work',
      icon: ClipboardDocumentListIcon,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    revenueEnabled ? {
      label: 'Revenue',
      value: revenueDisplay,
      note: 'Total confirmed',
      icon: CurrencyRupeeIcon,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    } : {
      label: bookingsEnabled ? 'Active Pipeline' : 'Qualified Leads',
      value: bookingsEnabled ? activeLeadCount : qualifiedLeadCount,
      note: bookingsEnabled ? 'Open leads to work' : 'Showing buying intent',
      icon: bookingsEnabled ? ClipboardDocumentListIcon : ArrowTrendingUpIcon,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div className="w-full space-y-6 animate-wizard-in">
      <section className="flex flex-col gap-1 pb-2">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-neutral-900">
              {getGreeting()} 👋
            </h1>
            <p className="mt-1 text-sm text-neutral-400">{todayFormatted}</p>
          </div>
          {analyticsEnabled && (
            <Link
              to="/analytics"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-neutral-100 px-3.5 py-2 text-[13px] font-semibold text-neutral-600 transition hover:bg-neutral-200"
            >
              <ChartBarIcon className="h-4 w-4" /> Full Analytics
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {revenueEnabled && <DashSection
          title="Revenue Trend"
          subtitle="Last 30 days"
          className="xl:col-span-3"
          action={
            <Link to="/analytics" className="text-xs font-semibold text-neutral-500 transition hover:text-neutral-900">
              View details →
            </Link>
          }
        >
          {revenueChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-neutral-400">
              No revenue data yet. Start converting leads!
            </div>
          ) : (
            <Suspense fallback={<ChartFallback />}>
              <DashboardCharts type="revenue" revenueChartData={revenueChartData} />
            </Suspense>
          )}
        </DashSection>}

        <DashSection
          title="Pipeline Funnel"
          subtitle={`${totalPipelineLeads} total leads`}
          className={revenueEnabled ? 'xl:col-span-2' : 'xl:col-span-5'}
        >
          {totalPipelineLeads === 0 ? (
            <EmptyPipelineState />
          ) : (
            <div className="space-y-3">
              {pipelineBarData.map((stage) => {
                const pct = Math.max(6, (stage.count / totalPipelineLeads) * 100);
                return (
                  <div key={stage.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-neutral-600">{stage.name}</span>
                      <span className="text-[13px] font-bold text-neutral-900">{stage.count}</span>
                    </div>
                    <div className="h-7 w-full overflow-hidden rounded-lg bg-neutral-100">
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
          )}
        </DashSection>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashSection title="Lead Status Distribution" subtitle="Current breakdown">
          {pieData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-neutral-400">No lead data yet.</div>
          ) : (
            <Suspense fallback={<ChartFallback />}>
              <DashboardCharts type="pie" pieData={pieData} />
            </Suspense>
          )}
        </DashSection>

        <DashSection title="Leads Over Time" subtitle="Last 30 days new inquiries">
          {leadsChartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-neutral-400">No lead trend data yet.</div>
          ) : (
            <Suspense fallback={<ChartFallback />}>
              <DashboardCharts type="leads" leadsChartData={leadsChartData} />
            </Suspense>
          )}
        </DashSection>
      </section>

      {bookingsEnabled && !isResort && (
        <DashSection
          title="Upcoming Departures"
          subtitle="Bookings ordered by travel date"
          action={revenueEnabled ? (
            <Link to="/payments" className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900">
              View payments
            </Link>
          ) : null}
        >
        <div className="mobile-card-list">
          {bookings.length === 0 ? (
            <div className="mobile-record-card text-center">
              <PaperAirplaneIcon className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
              <p className="text-sm text-neutral-400">No upcoming bookings found.</p>
            </div>
          ) : (
            bookings.map((booking) => (
              <MobileRecordCard
                key={booking.id}
                title={booking.customer?.name || booking.bookingRef}
                subtitle={booking.package?.name || 'Custom itinerary'}
                badge={<span className={`badge ${getStatusTone(booking.status)}`}>{booking.status}</span>}
              >
                <MobileField label="Ref" value={booking.bookingRef} />
                <MobileField label="Travel" value={formatDate(booking.travelDate)} />
              </MobileRecordCard>
            ))
          )}
        </div>

        <div className="-mx-5 hidden overflow-x-auto px-5 md:block">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                {['Traveler', 'Trip', 'Travel Date', 'Status'].map((heading) => (
                  <th key={heading} className="pb-3 pr-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400 first:pl-0 last:pr-0 last:text-right">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <PaperAirplaneIcon className="h-8 w-8 text-neutral-300" />
                      <p className="text-sm text-neutral-400">No upcoming bookings found.</p>
                      <Link to="/bookings" className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                        View all bookings →
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="group transition hover:bg-neutral-50/60">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                          {(booking.customer?.name || booking.bookingRef || '?')[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-neutral-800 group-hover:text-neutral-900">
                          {booking.customer?.name || booking.bookingRef}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-neutral-600">{booking.package?.name || 'Custom itinerary'}</td>
                    <td className="py-3.5 pr-4 text-sm text-neutral-600">{formatDate(booking.travelDate)}</td>
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
      )}
    </div>
  );
}
