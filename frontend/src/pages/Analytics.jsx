import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line, ScatterChart, Scatter,
} from 'recharts';
import {
  useSalesReport, useLeadFunnelReport, useAgentPerformanceReport,
  usePackageReport, useLostLeadsReport,
  useReviewReport, useSourceReport, useBookingReport,
  useCustomerLtvReport, useCacReport, useOperationalReport,
  useCampaignRoiReport, useGrowthReport,
} from '../hooks/useAnalytics';
import { useCampaignAnalytics } from '../hooks/useCampaigns';
import { useLeads } from '../hooks/useLeads';
import { propertiesApi } from '../api/propertiesApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { analyticsApi } from '../api/analyticsApi';
import {
  UsersIcon, BriefcaseIcon, HomeModernIcon, CubeIcon, CurrencyRupeeIcon,
  ArrowTrendingUpIcon, ClockIcon, ChartBarIcon, HeartIcon, MegaphoneIcon,
  BoltIcon, SparklesIcon, ArrowPathIcon, ExclamationTriangleIcon,
  TrophyIcon, UserGroupIcon, ShoppingBagIcon, EyeIcon, CheckCircleIcon,
  XCircleIcon, MinusIcon,
} from '@heroicons/react/24/outline';

/* ───────────────── Color Palette ───────────────── */
const COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];
const PRIMARY = '#6366f1';
const PRIMARY_LIGHT = '#818cf8';
const ACCENT = '#8b5cf6';
const TEAL = '#10b981';
const TEAL_LIGHT = '#34d399';
const ROSE = '#f43f5e';
const AMBER = '#f59e0b';
const SKY = '#0ea5e9';

/* ── Reusable SVG gradients ─────── */
function ChartGradients() {
  return (
    <defs>
      <linearGradient id="barPrimary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="barAccent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="barSecondary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c7d2fe" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.7} />
      </linearGradient>
      <linearGradient id="barSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="barRose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
        <stop offset="100%" stopColor="#f43f5e" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="barTeal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
      </linearGradient>
      <linearGradient id="areaIndigo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="areaTeal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="areaRose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/* ───────────────── Tab definitions ───────────────── */
const TABS = [
  { key: 'executive', label: 'Executive Summary', icon: SparklesIcon },
  { key: 'growth', label: 'Growth & Velocity', icon: ArrowTrendingUpIcon },
  { key: 'financial', label: 'Financial Deep-Dive', icon: CurrencyRupeeIcon },
  { key: 'pipeline', label: 'Pipeline & Funnel', icon: ChartBarIcon },
  { key: 'operational', label: 'Operational Excellence', icon: BoltIcon },
  { key: 'customers', label: 'Customer Intelligence', icon: UserGroupIcon },
  { key: 'marketing', label: 'Marketing ROI', icon: MegaphoneIcon },
  { key: 'agents', label: 'Team Performance', icon: TrophyIcon },
  { key: 'products', label: 'Products & Packages', icon: ShoppingBagIcon },
  { key: 'reviews', label: 'Reviews & Health', icon: HeartIcon },
];

/* ───────────────── Date Range Presets ───────────────── */
const DATE_PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
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

function KpiCard({ label, value, subValue, change, prefix = '', icon: Icon, color = 'indigo', onClick }) {
  const isUp = change > 0;
  const isDown = change < 0;
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-900', sub: 'text-indigo-900/60', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-950', sub: 'text-emerald-900/60', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-950', sub: 'text-amber-900/60', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-950', sub: 'text-rose-900/60', iconBg: 'bg-rose-100', iconText: 'text-rose-600' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-950', sub: 'text-sky-900/60', iconBg: 'bg-sky-100', iconText: 'text-sky-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-950', sub: 'text-purple-900/60', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div onClick={onClick} className={`${c.bg} rounded-[20px] border ${c.border} p-5 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer`}>
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.iconBg} ${c.iconText}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${c.sub}`}>{label}</p>
      </div>
      <p className={`text-[28px] font-black tracking-tight ${c.text} leading-tight`}>{prefix}{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {change !== null && change !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-rose-100 text-rose-600' : 'bg-neutral-100 text-neutral-500'}`}>
            {isUp ? <ArrowTrendingUpIcon className="w-3 h-3" /> : isDown ? <ArrowTrendingDownIcon className="w-3 h-3" /> : <MinusIcon className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
        {subValue && <span className="text-xs text-neutral-400 font-medium">{subValue}</span>}
      </div>
    </div>
  );
}

function ReportSection({ title, description, children, onExport, fullWidth = false, className = '' }) {
  return (
    <div className={`bg-white rounded-[24px] border border-neutral-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col ${fullWidth ? 'col-span-full' : ''} ${className}`}>
      <div className="flex flex-col gap-2 border-b border-neutral-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-neutral-900">{title}</h3>
          {description && <p className="mt-1 text-[13px] text-neutral-500 font-medium">{description}</p>}
        </div>
        {onExport && (
          <button onClick={onExport} className="text-xs bg-neutral-50 hover:bg-neutral-100 rounded-xl px-3 py-1.5 text-neutral-600 font-semibold transition">
            Export CSV
          </button>
        )}
      </div>
      <div className="p-6 flex-1">{children}</div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="flex h-64 items-center justify-center text-sm text-neutral-400">Loading chart data...</div>;
}

function EmptyState({ message }) {
  return <div className="flex h-48 items-center justify-center text-sm text-neutral-400">{message || 'No data available for this period.'}</div>;
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white/95 backdrop-blur-xl px-5 py-4 shadow-xl" style={{ minWidth: 180 }}>
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: p.color }} />
            <span className="text-[13px] text-neutral-500">{p.name}</span>
            <span className="ml-auto text-[13px] font-bold text-neutral-900">{formatter ? formatter(p.value) : p.value?.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightBadge({ type, children }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-sky-50 text-sky-700 border-sky-100',
    neutral: 'bg-neutral-50 text-neutral-600 border-neutral-100',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles[type] || styles.neutral}`}>
      {children}
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
   0. EXECUTIVE SUMMARY TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function ExecutiveSummaryTab({ params }) {
  const { data: salesRes, isLoading: isSalesLoading } = useSalesReport(params);
  const { data: growthRes, isLoading: isGrowthLoading } = useGrowthReport(params);
  const { data: opRes, isLoading: isOpLoading } = useOperationalReport(params);
  const { data: ltvRes, isLoading: isLtvLoading } = useCustomerLtvReport(params);

  const sales = salesRes?.data || {};
  const growth = growthRes?.data || {};
  const op = opRes?.data || {};
  const ltv = ltvRes?.data || {};

  const isLoading = isSalesLoading || isGrowthLoading || isOpLoading || isLtvLoading;

  if (isLoading) return <ChartSkeleton />;

  // Calculate health score (0-100)
  const healthScore = Math.min(100, Math.round(
    (growth.conversionRate || 0) * 0.3 +
    (op.slaRate || 0) * 0.25 +
    (growth.revenueChange > 0 ? 20 : 10) +
    (ltv.repeatRate || 0) * 0.25
  ));

  const healthColor = healthScore >= 80 ? 'emerald' : healthScore >= 60 ? 'amber' : 'rose';
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention';

  return (
    <div className="space-y-6">
      {/* Founder Scorecard */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-[24px] p-6 text-white shadow-xl shadow-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <SparklesIcon className="w-6 h-6 text-amber-300" />
              Founder Scorecard
            </h2>
            <p className="text-indigo-200 text-sm mt-1">Your business health at a glance — updated in real-time</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">Health Score</p>
              <p className="text-4xl font-black">{healthScore}</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold ${healthColor === 'emerald' ? 'bg-emerald-400/20 text-emerald-300' : healthColor === 'amber' ? 'bg-amber-400/20 text-amber-300' : 'bg-rose-400/20 text-rose-300'}`}>
              {healthLabel}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-xs text-indigo-200 font-medium uppercase">Revenue</p>
            <p className="text-xl font-black mt-1">{formatCurrency(sales.totalRevenue || 0)}</p>
            <p className={`text-xs mt-1 font-semibold ${(growth.revenueChange || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {(growth.revenueChange || 0) >= 0 ? '+' : ''}{growth.revenueChange || 0}% vs prior
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-xs text-indigo-200 font-medium uppercase">New Leads</p>
            <p className="text-xl font-black mt-1">{(growth.totalLeads || 0).toLocaleString()}</p>
            <p className={`text-xs mt-1 font-semibold ${(growth.leadsChange || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {(growth.leadsChange || 0) >= 0 ? '+' : ''}{growth.leadsChange || 0}% vs prior
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-xs text-indigo-200 font-medium uppercase">Bookings</p>
            <p className="text-xl font-black mt-1">{(growth.totalBookings || 0).toLocaleString()}</p>
            <p className={`text-xs mt-1 font-semibold ${(growth.bookingsChange || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {(growth.bookingsChange || 0) >= 0 ? '+' : ''}{growth.bookingsChange || 0}% vs prior
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-xs text-indigo-200 font-medium uppercase">Avg Response</p>
            <p className="text-xl font-black mt-1">{op.avgResponseMinutes || 0}m</p>
            <p className="text-xs mt-1 font-semibold text-indigo-200">
              SLA: {op.slaRate || 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Key Insights Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <InsightBadge type={growth.revenueChange > 0 ? 'success' : 'warning'}>
          <div className="flex items-start gap-2">
            <ArrowTrendingUpIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Revenue Trend</p>
              <p className="text-xs mt-0.5 opacity-80">
                {growth.revenueChange > 0
                  ? `Revenue is up ${growth.revenueChange}% from the previous period. Keep momentum going.`
                  : `Revenue is down ${Math.abs(growth.revenueChange)}%. Review your pipeline and follow-up strategy.`}
              </p>
            </div>
          </div>
        </InsightBadge>
        <InsightBadge type={op.slaRate >= 80 ? 'success' : op.slaRate >= 50 ? 'warning' : 'danger'}>
          <div className="flex items-start gap-2">
            <ClockIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Response Time</p>
              <p className="text-xs mt-0.5 opacity-80">
                {op.slaRate >= 80
                  ? `Excellent! ${op.slaRate}% of leads are responded to within 15 minutes.`
                  : `Only ${op.slaRate}% of leads get a response within 15 min. Consider adding more agents or automating.`}
              </p>
            </div>
          </div>
        </InsightBadge>
        <InsightBadge type={ltv.repeatRate >= 30 ? 'success' : 'info'}>
          <div className="flex items-start gap-2">
            <HeartIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Customer Loyalty</p>
              <p className="text-xs mt-0.5 opacity-80">
                {ltv.repeatRate > 0
                  ? `${ltv.repeatRate}% of customers are repeat bookers. Avg LTV is ${formatCurrency(ltv.avgLtv || 0)}.`
                  : 'Focus on post-trip follow-ups to increase repeat bookings and LTV.'}
              </p>
            </div>
          </div>
        </InsightBadge>
      </div>

      {/* Pipeline Snapshot */}
      <ReportSection title="Live Pipeline Snapshot" description="Current lead distribution across all stages">
        {growth.pipelineSnapshot?.length === 0 ? <EmptyState /> : (
          <div className="space-y-4">
            {growth.pipelineSnapshot?.map((stage) => {
              const total = growth.pipelineSnapshot?.reduce((s, r) => s + r.count, 0) || 1;
              const pct = Math.round((stage.count / total) * 100);
              const stageColors = {
                NEW: 'bg-sky-500',
                ENQUIRY: 'bg-indigo-500',
                CONTACTED: 'bg-purple-500',
                QUOTED: 'bg-amber-500',
                NEGOTIATING: 'bg-orange-500',
                BOOKED: 'bg-emerald-500',
                LOST: 'bg-rose-500',
                CANCELLED: 'bg-neutral-400',
                JUST_CONTACTED: 'bg-sky-400',
                PACKAGE_SEARCHED: 'bg-blue-400',
                PACKAGE_INTERESTED: 'bg-violet-400',
                CONVERTED: 'bg-teal-500',
                UNKNOWN: 'bg-neutral-300',
              };
              return (
                <div key={stage.status} className="group">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700">{stage.status.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900">{stage.count}</span>
                      <span className="text-xs text-neutral-400">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${stageColors[stage.status] || 'bg-neutral-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ReportSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. GROWTH & VELOCITY TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function GrowthVelocityTab({ params }) {
  const { data, isLoading } = useGrowthReport(params);
  const d = data?.data || {};

  const trendData = useMemo(() =>
    (d.monthlyTrend || []).map((r) => ({
      month: new Date(r.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      leads: r.leads,
      booked: r.booked,
      conversionRate: r.leads > 0 ? parseFloat((r.booked / r.leads * 100).toFixed(1)) : 0,
    })), [d.monthlyTrend]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Leads" value={d.totalLeads || 0} change={d.leadsChange} icon={UsersIcon} color="indigo" />
        <KpiCard label="Total Bookings" value={d.totalBookings || 0} change={d.bookingsChange} icon={ShoppingBagIcon} color="emerald" />
        <KpiCard label="Total Revenue" value={formatCurrency(d.totalRevenue || 0)} change={d.revenueChange} icon={CurrencyRupeeIcon} color="amber" />
        <KpiCard label="Sales Velocity" value={`${d.avgVelocityDays || 0}d`} subValue={`median: ${d.medianVelocityDays || 0}d`} icon={ClockIcon} color="sky" />
      </div>

      <InsightBadge type={d.avgVelocityDays <= 7 ? 'success' : d.avgVelocityDays <= 14 ? 'warning' : 'danger'}>
        <div className="flex items-start gap-2">
          <ChartBarIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Pipeline Velocity Insight</p>
            <p className="text-xs mt-0.5 opacity-80">
              {d.avgVelocityDays <= 7
                ? `Incredible! Leads convert in just ${d.avgVelocityDays} days on average. Your sales process is highly efficient.`
                : d.avgVelocityDays <= 14
                ? `Leads take ${d.avgVelocityDays} days to convert. Consider faster follow-ups and automated nurturing to reduce this.`
                : `Leads take ${d.avgVelocityDays} days to convert — that's too slow. Add drip campaigns and faster agent response times.`}
            </p>
          </div>
        </div>
      </InsightBadge>

      <ReportSection title="Growth Trend" description="Monthly leads vs bookings over the last 12 months" fullWidth>
        {trendData.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={trendData}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
              <Bar yAxisId="left" dataKey="leads" fill="url(#barSecondary)" radius={[8, 8, 0, 0]} name="Leads" barSize={28} />
              <Bar yAxisId="left" dataKey="booked" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Booked" barSize={28} />
              <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke={TEAL} strokeWidth={2.5} dot={{ r: 3, fill: TEAL }} name="Conv. Rate (%)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ReportSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. FINANCIAL DEEP-DIVE TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function FinancialDeepDiveTab({ params }) {
  const { data: salesRes, isLoading: isSalesLoading } = useSalesReport(params);
  const { data: profitRes, isLoading: isProfitLoading } = useQuery({
    queryKey: ['analytics-profit', params],
    queryFn: () => analyticsApi.getProfit(params),
    staleTime: 60 * 1000,
  });
  const { data: bookingsRes, isLoading: isBookingsLoading } = useBookingReport(params);

  const sales = salesRes?.data || {};
  const profit = profitRes?.data || {};
  const bookings = bookingsRes?.data || {};

  const isLoading = isSalesLoading || isProfitLoading || isBookingsLoading;

  const chartData = useMemo(() =>
    (sales.revenueByDay || []).map((r) => ({
      date: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: Math.round((parseInt(r.revenue, 10) || 0) / 100),
      count: parseInt(r.count, 10) || 0,
    })), [sales.revenueByDay]);

  const profitChartData = useMemo(() =>
    (profit.byPackage || []).slice(0, 8).map((r) => ({
      name: r.packageName?.substring(0, 15) || 'Unknown',
      selling: Math.round(r.selling / 100),
      cost: Math.round(r.cost / 100),
      profit: Math.round(r.profit / 100),
      margin: r.margin,
    })), [profit.byPackage]);

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Revenue" value={formatCurrency(sales.totalRevenue || 0)} change={sales.revenueChange} icon={CurrencyRupeeIcon} color="indigo" />
        <KpiCard label="Est. Profit" value={formatCurrency(profit.totalProfit || 0)} subValue={`${profit.profitMargin || 0}% margin`} icon={ArrowTrendingUpIcon} color="emerald" />
        <KpiCard label="Avg Booking Value" value={formatCurrency(sales.avgBookingValue || 0)} icon={ShoppingBagIcon} color="amber" />
        <KpiCard label="Outstanding" value={formatCurrency(sales.outstanding || 0)} subValue="pending payments" icon={ExclamationTriangleIcon} color="rose" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InsightBadge type={profit.profitMargin >= 30 ? 'success' : profit.profitMargin >= 15 ? 'warning' : 'danger'}>
          <p className="font-bold">Profit Margin: {profit.profitMargin || 0}%</p>
          <p className="text-xs mt-0.5 opacity-80">
            {profit.profitMargin >= 30 ? 'Healthy margins. Your pricing strategy is working well.' :
             profit.profitMargin >= 15 ? 'Moderate margins. Consider upselling premium packages.' :
             'Low margins detected. Review package pricing and supplier costs.'}
          </p>
        </InsightBadge>
        <InsightBadge type={bookings.cancellationRate <= 5 ? 'success' : bookings.cancellationRate <= 15 ? 'warning' : 'danger'}>
          <p className="font-bold">Cancellation Rate: {bookings.cancellationRate || 0}%</p>
          <p className="text-xs mt-0.5 opacity-80">
            {bookings.cancellationRate <= 5 ? 'Very low cancellations. Strong commitment from customers.' :
             'Monitor cancellation reasons and improve booking confidence with better policies.'}
          </p>
        </InsightBadge>
        <InsightBadge type="info">
          <p className="font-bold">Revenue per Lead</p>
          <p className="text-xs mt-0.5 opacity-80">
            {sales.totalRevenue > 0 && growth.totalLeads > 0
              ? `Each lead is worth ~${formatCurrency(Math.round(sales.totalRevenue / growth.totalLeads))} on average.`
              : 'Track revenue per lead to optimize marketing spend allocation.'}
          </p>
        </InsightBadge>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Revenue Over Time" description="Daily revenue and transaction count" onExport={() => downloadCsv('sales', params)}>
          {chartData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke={PRIMARY} strokeWidth={2.5} fill="url(#areaIndigo)" name="Revenue (₹)" dot={false} />
                <Bar yAxisId="right" dataKey="count" fill="url(#barSky)" radius={[8, 8, 0, 0]} name="Transactions" barSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection title="Profit by Package" description="Selling price vs cost vs estimated profit">
          {profitChartData.length === 0 ? <EmptyState message="No profit data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitChartData} barGap={4}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar dataKey="selling" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Revenue" barSize={20} />
                <Bar dataKey="cost" fill="url(#barRose)" radius={[8, 8, 0, 0]} name="Est. Cost" barSize={20} />
                <Bar dataKey="profit" fill="url(#barTeal)" radius={[8, 8, 0, 0]} name="Profit" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. PIPELINE & FUNNEL TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function PipelineFunnelTab({ params }) {
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
        <KpiCard label="Total Leads" value={d.totalLeads || 0} change={d.leadsChange} icon={UsersIcon} color="indigo" />
        <KpiCard label="Conversion Rate" value={`${d.conversionRate || 0}%`} subValue="Lead → Booked" icon={ChartBarIcon} color="emerald" />
        <KpiCard label="Active Enquiries" value={(d.leadsByStatus || []).reduce((s, r) => r.status !== 'JUST_CONTACTED' && r.status !== 'NEW' ? s + parseInt(r.count, 10) : s, 0)} icon={EyeIcon} color="amber" />
        <KpiCard label="Booked" value={(d.leadsByStatus || []).find((r) => r.status === 'BOOKED')?.count || 0} icon={CheckCircleIcon} color="sky" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Conversion Funnel" description="Lead → Enquiry → Contacted → Quoted → Booked" onExport={() => downloadCsv('leads', params)}>
          <div className="space-y-4 py-2">
            {funnelData.map((stage, i) => {
              const width = Math.max(12, (stage.count / maxCount) * 100);
              const rate = i > 0 && funnelData[i - 1].count > 0
                ? ((stage.count / funnelData[i - 1].count) * 100).toFixed(0) : null;
              const dropOff = i > 0 && funnelData[i - 1].count > 0
                ? (funnelData[i - 1].count - stage.count) : 0;
              return (
                <div key={stage.stage} className="group">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700">{stage.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-neutral-900">{stage.count}</span>
                      {rate && <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{rate}% conv.</span>}
                      {dropOff > 0 && <span className="text-[11px] font-semibold text-rose-500">-{dropOff} dropped</span>}
                    </div>
                  </div>
                  <div className="h-10 w-full rounded-xl bg-neutral-100 overflow-hidden">
                    <div
                      className="flex h-full items-center rounded-xl px-4 text-xs font-bold text-white transition-all duration-700"
                      style={{ width: `${width}%`, background: `linear-gradient(90deg, ${TEAL}, ${TEAL_LIGHT})` }}
                    >
                      {width > 25 && stage.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ReportSection>

        <div className="space-y-5">
          <ReportSection title="Lead Status Distribution">
            {statusData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} innerRadius={55} dataKey="value" nameKey="name" paddingAngle={3} stroke="none">
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ReportSection>

          <ReportSection title="Leads Over Time" description="Daily new leads">
            {chartData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <ChartGradients />
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14,165,233,0.04)' }} />
                  <Area type="monotone" dataKey="leads" stroke={SKY} strokeWidth={2.5} fill="url(#barSky)" fillOpacity={0.15} name="Leads" dot={false} activeDot={{ r: 5, fill: SKY, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ReportSection>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. OPERATIONAL EXCELLENCE TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function OperationalTab({ params }) {
  const { data, isLoading } = useOperationalReport(params);
  const d = data?.data || {};

  const responseDistData = (d.responseDistribution || []).map((r) => ({
    name: r.bucket,
    count: r.count,
  }));

  const workloadData = (d.agentWorkload || []).slice(0, 8).map((a) => ({
    name: a.name?.split(' ')[0] || 'Agent',
    leads: a.leadsAssigned,
    messages: a.messagesSent,
    conversions: a.conversions,
    revenue: Math.round(a.revenue / 100),
  }));

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Avg Response Time" value={`${d.avgResponseMinutes || 0}m`} subValue={`median: ${d.medianResponseMinutes || 0}m`} icon={ClockIcon} color="indigo" />
        <KpiCard label="SLA Compliance" value={`${d.slaRate || 0}%`} subValue={`target: ${d.slaTarget || 80}%`} icon={CheckCircleIcon} color={d.slaRate >= 80 ? 'emerald' : d.slaRate >= 50 ? 'amber' : 'rose'} />
        <KpiCard label="Missed Follow-ups" value={d.missedFollowUps || 0} subValue="leads untouched" icon={XCircleIcon} color="rose" />
        <KpiCard label="P90 Response" value={`${d.p90ResponseMinutes || 0}m`} subValue="90% under this" icon={BoltIcon} color="sky" />
      </div>

      <InsightBadge type={d.missedFollowUps === 0 ? 'success' : d.missedFollowUps <= 5 ? 'warning' : 'danger'}>
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Follow-up Alert</p>
            <p className="text-xs mt-0.5 opacity-80">
              {d.missedFollowUps === 0
                ? 'Perfect! Every lead has received at least one follow-up message.'
                : `${d.missedFollowUps} leads have not received any agent follow-up. These are hot leads going cold — assign them immediately.`}
            </p>
          </div>
        </div>
      </InsightBadge>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Response Time Distribution" description="How fast your team replies to inbound messages">
          {responseDistData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={responseDistData}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="count" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Conversations" barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection title="Team Workload Balance" description="Leads, messages, and conversions per agent">
          {workloadData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workloadData} barGap={4}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar dataKey="leads" fill="url(#barSecondary)" radius={[8, 8, 0, 0]} name="Leads" barSize={20} />
                <Bar dataKey="messages" fill="url(#barSky)" radius={[8, 8, 0, 0]} name="Messages" barSize={20} />
                <Bar dataKey="conversions" fill="url(#barTeal)" radius={[8, 8, 0, 0]} name="Conversions" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportSection>
      </div>

      <ReportSection title="Agent Performance Matrix" description="Detailed breakdown per team member">
        {d.agentWorkload?.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Messages</th>
                  <th className="pb-3 pr-4 text-right">Conv.</th>
                  <th className="pb-3 pr-4 text-right">Conv. Rate</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {d.agentWorkload?.map((a) => (
                  <tr key={a.id} className="transition hover:bg-neutral-50/50">
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-neutral-800">{a.name}</p>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{a.leadsAssigned}</td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{a.messagesSent}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-neutral-800">{a.conversions}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${a.leadsAssigned > 0 && (a.conversions / a.leadsAssigned * 100) >= 20 ? 'bg-emerald-50 text-emerald-700' : a.leadsAssigned > 0 && (a.conversions / a.leadsAssigned * 100) >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {a.leadsAssigned > 0 ? (a.conversions / a.leadsAssigned * 100).toFixed(1) : 0}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-bold text-neutral-900">{formatCurrency(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. CUSTOMER INTELLIGENCE TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function CustomerIntelligenceTab({ params }) {
  const { data: ltvRes, isLoading: isLtvLoading } = useCustomerLtvReport(params);
  const { data: cacRes, isLoading: isCacLoading } = useCacReport(params);

  const ltv = ltvRes?.data || {};
  const cac = cacRes?.data || {};

  const isLoading = isLtvLoading || isCacLoading;

  const topCustomers = ltv.topCustomers || [];

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Avg Customer LTV" value={formatCurrency(ltv.avgLtv || 0)} icon={HeartIcon} color="indigo" />
        <KpiCard label="Total Customers" value={ltv.totalCustomers || 0} icon={UsersIcon} color="emerald" />
        <KpiCard label="Repeat Rate" value={`${ltv.repeatRate || 0}%`} subValue="customers with 2+ bookings" icon={ArrowPathIcon} color="amber" />
        <KpiCard label="Avg Conversion" value={`${cac.avgConversionRate || 0}%`} subValue="lead → booking" icon={ChartBarIcon} color="sky" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InsightBadge type="info">
          <p className="font-bold">Customer Acquisition Cost</p>
          <p className="text-xs mt-0.5 opacity-80">{cac.note}</p>
        </InsightBadge>
        <InsightBadge type={ltv.repeatRate >= 30 ? 'success' : 'warning'}>
          <p className="font-bold">Repeat Booking Strategy</p>
          <p className="text-xs mt-0.5 opacity-80">
            {ltv.repeatRate >= 30
              ? 'Strong repeat business. Create a loyalty program to push this even higher.'
              : 'Most customers book once. Set up post-trip drip campaigns and referral incentives.'}
          </p>
        </InsightBadge>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Top Customers by LTV" description="Your highest-value customers">
          {topCustomers.length === 0 ? <EmptyState /> : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-neutral-400' : i === 2 ? 'bg-amber-600' : 'bg-neutral-200 text-neutral-500'}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{c.name}</p>
                      <p className="text-xs text-neutral-400">{c.phone} · {c.totalBookings} bookings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-900">{formatCurrency(c.totalSpent)}</p>
                    <p className="text-xs text-neutral-400">avg {formatCurrency(c.avgBookingValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        <ReportSection title="Acquisition by Source" description="Lead quality and conversion per channel">
          {(cac.sources || []).length === 0 ? <EmptyState /> : (
            <div className="space-y-3">
              {(cac.sources || []).map((s, i) => (
                <div key={i} className="rounded-xl border border-neutral-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-neutral-800">{formatSourceName(s.source)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.conversionRate >= 20 ? 'bg-emerald-50 text-emerald-700' : s.conversionRate >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {s.conversionRate}% conv.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <p className="text-xs text-neutral-400">Leads</p>
                      <p className="text-sm font-bold text-neutral-800">{s.leads}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <p className="text-xs text-neutral-400">Booked</p>
                      <p className="text-sm font-bold text-neutral-800">{s.booked}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <p className="text-xs text-neutral-400">Revenue</p>
                      <p className="text-sm font-bold text-neutral-800">{formatCurrency(s.revenue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. MARKETING ROI TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function MarketingRoiTab({ params }) {
  const { data, isLoading } = useCampaignRoiReport(params);
  const d = data?.data || {};

  const campaignChartData = (d.campaigns || []).slice(0, 10).map((c) => ({
    name: c.name?.substring(0, 15) || 'Campaign',
    sent: c.sent || 0,
    delivered: c.delivered || 0,
    read: c.read || 0,
    leads: c.leadsGenerated || 0,
    bookings: c.bookings || 0,
    revenue: Math.round((c.revenue || 0) / 100),
  }));

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Campaigns Sent" value={d.totalCampaigns || 0} subValue={`${(d.totalSent || 0).toLocaleString()} messages`} icon={MegaphoneIcon} color="indigo" />
        <KpiCard label="Delivery Rate" value={`${d.avgDeliveryRate || 0}%`} subValue={`${(d.totalDelivered || 0).toLocaleString()} delivered`} icon={CheckCircleIcon} color="emerald" />
        <KpiCard label="Read Rate" value={`${d.avgReadRate || 0}%`} subValue={`${(d.totalRead || 0).toLocaleString()} read`} icon={EyeIcon} color="amber" />
        <KpiCard label="Campaign Revenue" value={formatCurrency(d.totalRevenue || 0)} subValue={`${d.totalBookings || 0} bookings`} icon={CurrencyRupeeIcon} color="sky" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InsightBadge type={d.avgLeadRate >= 5 ? 'success' : d.avgLeadRate >= 2 ? 'warning' : 'info'}>
          <p className="font-bold">Lead Generation Rate: {d.avgLeadRate || 0}%</p>
          <p className="text-xs mt-0.5 opacity-80">
            {d.avgLeadRate >= 5 ? 'Excellent campaign performance! Each broadcast is generating strong interest.' :
             'Improve your campaign messaging or targeting to increase lead generation from broadcasts.'}
          </p>
        </InsightBadge>
        <InsightBadge type={d.avgBookingRate >= 1 ? 'success' : 'warning'}>
          <p className="font-bold">Booking Rate: {d.avgBookingRate || 0}%</p>
          <p className="text-xs mt-0.5 opacity-80">
            {d.avgBookingRate >= 1 ? 'Campaigns are converting directly into bookings. Scale your best-performing templates.' :
             'Campaigns generate interest but few bookings. Add stronger CTAs and booking links.'}
          </p>
        </InsightBadge>
        <InsightBadge type="info">
          <p className="font-bold">Reply Rate: {d.avgReplyRate || 0}%</p>
          <p className="text-xs mt-0.5 opacity-80">
            {d.avgReplyRate >= 10 ? 'High engagement! Your audience is actively responding to campaigns.' :
             'Low reply rates. Test more personalized messaging or interactive templates.'}
          </p>
        </InsightBadge>
      </div>

      <ReportSection title="Campaign Performance Matrix" description="Top campaigns by engagement and revenue" fullWidth>
        {campaignChartData.length === 0 ? <EmptyState message="No campaigns sent in this period." /> : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={campaignChartData}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
              <Bar yAxisId="left" dataKey="sent" fill="url(#barSecondary)" radius={[8, 8, 0, 0]} name="Sent" barSize={16} />
              <Bar yAxisId="left" dataKey="read" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Read" barSize={16} />
              <Bar yAxisId="left" dataKey="leads" fill="url(#barTeal)" radius={[8, 8, 0, 0]} name="Leads" barSize={16} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3, fill: AMBER }} name="Revenue (₹)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ReportSection>

      <ReportSection title="Campaign Details" description="Individual campaign breakdown">
        {(d.campaigns || []).length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  <th className="pb-3 pr-4">Campaign</th>
                  <th className="pb-3 pr-4 text-right">Sent</th>
                  <th className="pb-3 pr-4 text-right">Read %</th>
                  <th className="pb-3 pr-4 text-right">Reply %</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Bookings</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {(d.campaigns || []).map((c) => (
                  <tr key={c.id} className="transition hover:bg-neutral-50/50">
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-neutral-800">{c.name}</p>
                      <p className="text-xs text-neutral-400">{c.type}</p>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{(c.sent || 0).toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${c.readRate >= 50 ? 'bg-emerald-50 text-emerald-700' : c.readRate >= 25 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {c.readRate}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{c.replyRate}%</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-neutral-800">{c.leadsGenerated}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-neutral-800">{c.bookings}</td>
                    <td className="py-3 text-right text-sm font-bold text-neutral-900">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. TEAM PERFORMANCE TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function TeamPerformanceTab({ params }) {
  const { data, isLoading } = useAgentPerformanceReport(params);
  const agents = data?.data?.agents || [];

  if (isLoading) return <ChartSkeleton />;

  const chartData = agents.map((a) => ({
    name: a.name?.split(' ')[0] || 'Agent',
    leads: a.leadsAssigned,
    booked: a.leadsConverted,
    revenue: Math.round(a.revenue / 100),
    conversionRate: a.conversionRate,
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Agents" value={agents.length} icon={UsersIcon} color="indigo" />
        <KpiCard label="Top Performer" value={agents[0]?.name || 'N/A'} subValue={`${formatCurrency(agents[0]?.revenue || 0)}`} icon={TrophyIcon} color="amber" />
        <KpiCard label="Avg Conv. Rate" value={`${agents.length > 0 ? (agents.reduce((s, a) => s + a.conversionRate, 0) / agents.length).toFixed(1) : 0}%`} icon={ChartBarIcon} color="emerald" />
        <KpiCard label="Team Revenue" value={formatCurrency(agents.reduce((s, a) => s + a.revenue, 0))} icon={CurrencyRupeeIcon} color="sky" />
      </div>

      <ReportSection title="Agent Leaderboard" description="Ranked by revenue generated" onExport={() => downloadCsv('agents', params)}>
        {agents.length === 0 ? <EmptyState message="No users found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Booked</th>
                  <th className="pb-3 pr-4 text-right">Conv. %</th>
                  <th className="pb-3 pr-4 text-right">Messages</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {agents.map((a, i) => (
                  <tr key={a.id} className="transition hover:bg-neutral-50/50">
                    <td className="py-3 pr-4">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-neutral-400' : i === 2 ? 'bg-amber-600' : 'bg-neutral-200 text-neutral-500'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-neutral-800">{a.name}</p>
                      <p className="text-xs text-neutral-400">{a.role}</p>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm font-medium text-neutral-600">{a.leadsAssigned}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-neutral-800">{a.leadsConverted}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${a.conversionRate >= 20 ? 'bg-emerald-50 text-emerald-700' : a.conversionRate >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {a.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{a.messagesSent}</td>
                    <td className="py-3 text-right text-sm font-bold text-neutral-900">{formatCurrency(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {chartData.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <ReportSection title="Revenue by Agent">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={4}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="revenue" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Revenue (₹)" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>

          <ReportSection title="Conversion Rate Comparison">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={4}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="conversionRate" fill="url(#barTeal)" radius={[8, 8, 0, 0]} name="Conversion Rate (%)" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. PRODUCTS & PACKAGES TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function ProductsPackagesTab({ params }) {
  const { data, isLoading } = usePackageReport(params);
  const packages = data?.data?.packages || [];

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Packages" value={packages.length} icon={CubeIcon} color="indigo" />
        <KpiCard label="Total Bookings" value={packages.reduce((s, p) => s + p.bookingCount, 0)} icon={ShoppingBagIcon} color="emerald" />
        <KpiCard label="Total Revenue" value={formatCurrency(packages.reduce((s, p) => s + p.totalRevenue, 0))} icon={CurrencyRupeeIcon} color="amber" />
        <KpiCard label="Avg Conv. Rate" value={`${packages.length > 0 ? (packages.reduce((s, p) => s + p.conversionRate, 0) / packages.length).toFixed(1) : 0}%`} icon={ChartBarIcon} color="sky" />
      </div>

      <ReportSection title="Package Performance Matrix" description="Bookings, leads, conversion, and revenue per package" onExport={() => downloadCsv('packages', params)}>
        {packages.length === 0 ? <EmptyState message="No package data yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Package</th>
                  <th className="pb-3 pr-4">Destination</th>
                  <th className="pb-3 pr-4 text-right">Leads</th>
                  <th className="pb-3 pr-4 text-right">Bookings</th>
                  <th className="pb-3 pr-4 text-right">Conv. %</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {packages.map((p, i) => (
                  <tr key={p.package?.id || i} className="transition hover:bg-neutral-50/50">
                    <td className="py-3 pr-4 text-sm text-neutral-400">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-semibold text-neutral-800">{p.package?.name || 'N/A'}</p>
                      <p className="text-xs text-neutral-400">{p.package?.category || ''}</p>
                    </td>
                    <td className="py-3 pr-4 text-sm text-neutral-600">{(p.package?.destinations || []).join(', ') || '-'}</td>
                    <td className="py-3 pr-4 text-right text-sm text-neutral-600">{p.leads}</td>
                    <td className="py-3 pr-4 text-right text-sm font-bold text-neutral-800">{p.bookingCount}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${p.conversionRate >= 30 ? 'bg-emerald-50 text-emerald-700' : p.conversionRate >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {p.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm font-bold text-neutral-900">{formatCurrency(p.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {packages.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <ReportSection title="Bookings vs Enquiries">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={packages.slice(0, 8).map((p) => ({ name: (p.package?.name || 'N/A').substring(0, 15), bookings: p.bookingCount, leads: p.leads }))} barGap={4}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar dataKey="leads" fill="url(#barSecondary)" radius={[8, 8, 0, 0]} name="Enquiries" barSize={28} />
                <Bar dataKey="bookings" fill="url(#barAccent)" radius={[8, 8, 0, 0]} name="Bookings" barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>

          <ReportSection title="Revenue by Package">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={packages.slice(0, 8).map((p) => ({ name: (p.package?.name || 'N/A').substring(0, 15), revenue: Math.round(p.totalRevenue / 100) }))}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <Tooltip content={<CustomTooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="revenue" fill="url(#barPrimary)" radius={[8, 8, 0, 0]} name="Revenue (₹)" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. REVIEWS & HEALTH TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function ReviewsHealthTab({ params }) {
  const { data, isLoading } = useReviewReport(params);
  const d = data?.data || {};

  const ratingData = useMemo(() =>
    [5, 4, 3, 2, 1].map((r) => {
      const match = (d.ratingDistribution || []).find((x) => parseInt(x.rating, 10) === r);
      return { stars: `${r} ⭐`, count: parseInt(match?.count || '0', 10) };
    }), [d.ratingDistribution]);

  if (isLoading) return <ChartSkeleton />;

  const npsEstimate = d.avgRating >= 4.5 ? 'Promoter-heavy' : d.avgRating >= 3.5 ? 'Mixed' : 'Detractor-heavy';
  const npsColor = d.avgRating >= 4.5 ? 'success' : d.avgRating >= 3.5 ? 'warning' : 'danger';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Avg Rating" value={`${d.avgRating || 0} ⭐`} icon={HeartIcon} color="amber" />
        <KpiCard label="Total Reviews" value={d.totalReviews || 0} icon={EyeIcon} color="indigo" />
        <KpiCard label="Negative Reviews" value={(d.negativeReviews || []).length} subValue="rating ≤ 2" icon={ExclamationTriangleIcon} color="rose" />
        <KpiCard label="Sentiment" value={npsEstimate} icon={SparklesIcon} color={npsColor === 'success' ? 'emerald' : npsColor === 'warning' ? 'amber' : 'rose'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Rating Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ratingData} layout="vertical">
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="stars" type="category" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} width={60} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
              <Bar dataKey="count" fill="url(#barAmber)" radius={[0, 8, 8, 0]} name="Reviews" barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>

        <ReportSection title="Ratings by Destination" description="Top rated destinations">
          {(d.reviewsByDestination || []).length === 0 ? <EmptyState message="No destination reviews yet." /> : (
            <div className="space-y-2">
              {(d.reviewsByDestination || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
                  <span className="text-sm font-medium text-neutral-700">{r.destination}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-600">{r.avgRating} ⭐</span>
                    <span className="text-xs text-neutral-400">({r.count} reviews)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>
      </div>

      {(d.negativeReviews || []).length > 0 && (
        <ReportSection title="Negative Feedback Alert" description="Reviews with rating ≤ 2 — take action">
          <div className="space-y-3">
            {d.negativeReviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-800">{r.customer?.name || 'Anonymous'}</p>
                  <span className="text-sm font-bold text-rose-600">{r.rating} ⭐</span>
                </div>
                {r.testimonial && <p className="mt-2 text-sm text-neutral-600">"{r.testimonial}"</p>}
                {r.destination && <p className="mt-1 text-xs text-neutral-400">Destination: {r.destination}</p>}
              </div>
            ))}
          </div>
        </ReportSection>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

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
   MAIN REPORTS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('executive');
  const [datePreset, setDatePreset] = useState(30);
  const params = useMemo(() => getDateRange(datePreset), [datePreset]);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <section className="flex flex-col gap-3 border-b border-neutral-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-heading">Founder Reports</h1>
          <p className="page-subtext">Deep business intelligence across every aspect of your travel agency.</p>
        </div>
        <div className="flex items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDatePreset(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${datePreset === p.days ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.key
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </section>

      {/* Active Tab Content */}
      <section>
        {activeTab === 'executive' && <ExecutiveSummaryTab params={params} />}
        {activeTab === 'growth' && <GrowthVelocityTab params={params} />}
        {activeTab === 'financial' && <FinancialDeepDiveTab params={params} />}
        {activeTab === 'pipeline' && <PipelineFunnelTab params={params} />}
        {activeTab === 'operational' && <OperationalTab params={params} />}
        {activeTab === 'customers' && <CustomerIntelligenceTab params={params} />}
        {activeTab === 'marketing' && <MarketingRoiTab params={params} />}
        {activeTab === 'agents' && <TeamPerformanceTab params={params} />}
        {activeTab === 'products' && <ProductsPackagesTab params={params} />}
        {activeTab === 'reviews' && <ReviewsHealthTab params={params} />}
      </section>
    </div>
  );
}
