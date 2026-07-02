// FILE: /frontend/src/pages/Analytics.jsx
//
// Wayon Reports — "The Founder's Brief".
// A money-first, editorial set of reports for travel-agency founders. Nine
// plainly-named views (Pulse, Revenue, Leads, Channels, Marketing, Customers,
// Packages, Team, Reviews) built on the shared reportKit design system.

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line, LineChart,
} from 'recharts';
import {
  useSalesReport, useLeadFunnelReport, useAgentPerformanceReport,
  usePackageReport, useReviewReport, useSourceReport, useBookingReport, useLeadsByAdReport,
  useCustomerLtvReport, useCacReport, useOperationalReport,
  useCampaignRoiReport, useGrowthReport, useProfitReport, useLostLeadsReport,
  useLeadHeatmapReport,
} from '../hooks/useAnalytics';
import { analyticsApi } from '../api/analyticsApi';
import client from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  INK, INK_SOFT, EMERALD, CLAY, GOLD, SLATE, SERIES,
  Eyebrow, Stat, StatCards, Card, SectionCard, ExportButton, Note,
  BarRow, Rank, Spark, ChartDefs, BriefTooltip, axisTick, gridProps,
  ReportSkeleton, Empty, downloadCsv, channelMeta, text,
  fmtNum, fmtPct, compactNum,
} from './reports/reportKit';
import CrmReport from './reports/CrmReport';
import { useIndustry } from '../hooks/useIndustry';

/* ───────────────────────── Date range ───────────────────────── */

const DATE_PRESETS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
];

function getDateRange(preset) {
  const end = new Date();
  let start;
  if (preset === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
  else if (preset === 'year') start = new Date(end.getFullYear(), 0, 1);
  else start = new Date(end.getTime() - preset * 86400000);
  return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
}

/* ───────────────────────── Small chart helpers ───────────────────────── */

const dayLabel = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const monthLabel = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
const rupees = (paise) => Math.round((Number(paise) || 0) / 100);
const moneyTick = (v) => `Rs ${compactNum(v)}`;
const moneyTip = (v) => `Rs ${fmtNum(v)}`;

function toSpark(arr, key) {
  return (arr || []).map((r, i) => ({ x: i, y: Number(r[key]) || 0 }));
}

/* A refined semicircular health gauge for the Pulse hero. */
function Gauge({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const r = 52;
  const len = Math.PI * r;
  const dash = (len * pct) / 100;
  const color = pct >= 75 ? EMERALD : pct >= 50 ? GOLD : CLAY;
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 120 72" className="w-[150px]">
        <path d="M8 64 A52 52 0 0 1 112 64" fill="none" stroke="#efe9dd" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M8 64 A52 52 0 0 1 112 64" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${dash} ${len}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="-mt-9 text-center">
        <p className="font-brief nums text-[38px] font-semibold leading-none" style={{ color }}>{pct}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8a299]">Health</p>
      </div>
    </div>
  );
}

/* A small circular score ring for staff scorecards. */
function Ring({ value, size = 58, stroke = 6 }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * pct) / 100;
  const color = pct >= 70 ? EMERALD : pct >= 40 ? GOLD : CLAY;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efe9dd" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)' }}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="font-brief nums" transform={`rotate(90 ${size / 2} ${size / 2})`} style={{ fontSize: 15, fontWeight: 600, fill: color }}>{pct}</text>
    </svg>
  );
}

/* ───────── Lead heatmap (calendar contribution grid) ───────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad2 = (n) => String(n).padStart(2, '0');
const hourLabel = (h) => `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`;

function heatColor(v, max) {
  if (!v) return '#f1ede4';
  const t = max > 0 ? v / max : 0;
  if (t > 0.75) return '#0f8a6b';
  if (t > 0.5) return '#3f9d82';
  if (t > 0.25) return '#7cc4aa';
  return '#cfe8df';
}

function LeadHeatmap() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState('all');
  const [view, setView] = useState('calendar');
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const hmParams = useMemo(() => ({ from: `${year}-01-01`, to: `${year}-12-31` }), [year]);
  const { data, isLoading } = useLeadFunnelReport(hmParams);
  const { data: hmData } = useLeadHeatmapReport(hmParams);

  const byDay = useMemo(() => {
    const m = {};
    (data?.data?.leadsByDay || []).forEach((r) => { m[String(r.date).slice(0, 10)] = Number(r.count) || 0; });
    return m;
  }, [data]);

  // Build day cells for the visible window (full year or one month).
  const cells = useMemo(() => {
    const arr = [];
    const startM = month === 'all' ? 0 : Number(month);
    const endM = month === 'all' ? 11 : Number(month);
    for (let m = startM; m <= endM; m += 1) {
      const last = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= last; d += 1) {
        const iso = `${year}-${pad2(m + 1)}-${pad2(d)}`;
        const wd = (new Date(year, m, d).getDay() + 6) % 7; // Mon=0..Sun=6
        arr.push({ iso, m, d, wd, count: byDay[iso] || 0 });
      }
    }
    return arr;
  }, [year, month, byDay]);

  const max = Math.max(...cells.map((c) => c.count), 1);
  const total = cells.reduce((s, c) => s + c.count, 0);

  // Weekday × hour grid (Mon..Sun rows, 0..23 cols) from the dedicated endpoint.
  const timeGrid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    (hmData?.data?.matrix || []).forEach((r) => {
      const day = ((Number(r.dow) || 0) + 6) % 7; // Postgres 0=Sun → Mon=0
      const h = Number(r.hour) || 0;
      if (g[day] && h >= 0 && h < 24) g[day][h] += Number(r.count) || 0;
    });
    return g;
  }, [hmData]);
  const timeMax = Math.max(...timeGrid.flat(), 1);
  const timeTotal = timeGrid.flat().reduce((s, n) => s + n, 0);

  // Leading blanks so the first cell lands on its weekday row.
  const lead = cells.length ? cells[0].wd : 0;
  const grid = [...Array(lead).fill(null), ...cells];

  // Busiest weekday.
  const wdTotals = [0, 0, 0, 0, 0, 0, 0];
  cells.forEach((c) => { wdTotals[c.wd] += c.count; });
  const busiestWd = wdTotals.indexOf(Math.max(...wdTotals));
  const wdMax = Math.max(...wdTotals, 1);

  const selectCls = 'rounded-full border border-[#ece8e0] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#6b655c] outline-none transition hover:border-[#d9d4c8]';

  return (
    <SectionCard
      eyebrow="When leads arrive"
      title="Lead heatmap"
      description={view === 'calendar'
        ? `${fmtNum(total)} leads in ${month === 'all' ? year : `${MONTHS[Number(month)]} ${year}`}`
        : `Busiest days and times across ${year}`}
      action={(
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-full border border-[#ece8e0] p-0.5">
            {[['calendar', 'Calendar'], ['time', 'By time']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${view === k ? 'bg-[#1c1916] text-white' : 'text-[#8a8278] hover:text-[#1c1916]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          {view === 'calendar' && (
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
              <option value="all">All months</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          )}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
    >
      {isLoading ? <Empty message="Loading…" height={150} /> : (view === 'calendar' ? total : timeTotal) === 0 ? <Empty message="No leads in this window." height={150} /> : (
        <div className="space-y-5">
          {view === 'calendar' ? (
            <>
              {/* Calendar grid */}
              <div className="overflow-x-auto pb-1">
                <div className="flex gap-2">
                  <div className="grid shrink-0 grid-rows-7 gap-[3px] pr-1 pt-[2px]">
                    {WEEKDAYS.map((w, i) => (
                      <span key={w} className="flex h-[13px] items-center text-[9px] font-semibold text-[#a8a299]">{i % 2 ? w : ''}</span>
                    ))}
                  </div>
                  <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                    {grid.map((c, i) => c === null
                      ? <span key={`b${i}`} className="h-[13px] w-[13px]" />
                      : (
                        <span
                          key={c.iso}
                          title={`${c.count} lead${c.count === 1 ? '' : 's'} · ${c.d} ${MONTHS[c.m]} ${year}`}
                          className="h-[13px] w-[13px] rounded-[3px] transition-transform hover:scale-125"
                          style={{ background: heatColor(c.count, max) }}
                        />
                      ))}
                  </div>
                </div>
              </div>

              {/* Leads by weekday */}
              <div className="grid grid-cols-7 gap-2 border-t border-[#ece8e0] pt-4">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className="text-center">
                    <div className="mx-auto flex h-20 items-end justify-center">
                      <div
                        className="w-7 rounded-t-[4px]"
                        style={{ height: `${Math.max(4, (wdTotals[i] / wdMax) * 100)}%`, background: i === busiestWd ? EMERALD : '#dfd9cc' }}
                      />
                    </div>
                    <p className="mt-1.5 nums text-[12px] font-bold text-[#1c1916]">{fmtNum(wdTotals[i])}</p>
                    <p className="text-[10px] font-semibold text-[#a8a299]">{w}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Time-of-day grid (day × hour) */
            <div className="overflow-x-auto pb-1">
              <div className="inline-grid gap-[4px]" style={{ gridTemplateColumns: '40px repeat(24, 22px)' }}>
                {/* hour labels */}
                <span />
                {Array.from({ length: 24 }).map((_, h) => (
                  <span key={`h${h}`} className="text-center text-[9px] font-semibold text-[#a8a299]">
                    {h % 3 === 0 ? hourLabel(h) : ''}
                  </span>
                ))}
                {/* rows */}
                {WEEKDAYS.map((w, di) => (
                  <Fragment key={w}>
                    <span className="flex items-center text-[10px] font-semibold text-[#a8a299]">{w}</span>
                    {timeGrid[di].map((c, h) => (
                      <span
                        key={h}
                        title={`${c} lead${c === 1 ? '' : 's'} · ${w} ${hourLabel(h)}`}
                        className="h-[22px] w-[22px] rounded-[5px] transition-transform hover:scale-110"
                        style={{ background: heatColor(c, timeMax) }}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-end gap-1.5 border-t border-[#ece8e0] pt-4 text-[10px] font-semibold text-[#a8a299]">
            Less
            {['#f1ede4', '#cfe8df', '#7cc4aa', '#3f9d82', '#0f8a6b'].map((c) => (
              <span key={c} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: c }} />
            ))}
            More
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ───────── Per-staff performance scorecards ───────── */

function StaffScorecards({ agents, revenueEnabled = true }) {
  if (!agents?.length) return null;
  const maxRev = Math.max(...agents.map((a) => a.revenue || 0), 1);
  const maxMsg = Math.max(...agents.map((a) => a.messagesSent || 0), 1);

  const scored = agents.map((a) => {
    const convPart = Math.min(50, (a.conversionRate || 0) * 2);
    const revPart = revenueEnabled ? ((a.revenue || 0) / maxRev) * 30 : 0;
    const actPart = ((a.messagesSent || 0) / maxMsg) * (revenueEnabled ? 20 : 50);
    return { ...a, score: Math.round(Math.min(100, convPart + revPart + actPart)) };
  }).sort((x, y) => y.score - x.score);

  return (
    <SectionCard
      title="Staff scorecards"
      eyebrow="Per-person performance"
      description={revenueEnabled ? 'Each team member at a glance - score blends conversion, revenue and activity' : 'Each team member at a glance - score blends conversion and activity'}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scored.map((a) => (
          <div key={a.id} className="flex items-center gap-4 rounded-[14px] border border-[#f1ede4] bg-[#fbfaf7] p-4">
            <Ring value={a.score} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[#1c1916]">{text(a.name)}</p>
              <p className="text-[11px] text-[#a8a299]">{text(a.role, 'Staff')}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                <div>
                  <p className="nums text-[13px] font-bold text-[#1c1916]">{fmtNum(a.leadsConverted)}/{fmtNum(a.leadsAssigned)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#a8a299]">Booked</p>
                </div>
                <div>
                  <p className="nums text-[13px] font-bold text-[#0f6a52]">{fmtPct(a.conversionRate)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#a8a299]">Conv.</p>
                </div>
                {revenueEnabled ? (
                  <div>
                    <p className="nums text-[13px] font-bold text-[#1c1916]">{formatCurrency(a.revenue)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#a8a299]">Revenue</p>
                  </div>
                ) : (
                  <div>
                    <p className="nums text-[13px] font-bold text-[#1c1916]">{fmtNum(a.messagesSent)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#a8a299]">Msgs</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   1 · PULSE — the brief overview
   ════════════════════════════════════════════════════════════════════════ */

function PulseReport({ params, periodLabel, revenueEnabled = true }) {
  const { data: salesRes, isLoading: l1 } = useSalesReport(params);
  const { data: growthRes, isLoading: l2 } = useGrowthReport(params);
  const { data: opRes, isLoading: l3 } = useOperationalReport(params);
  const { data: ltvRes, isLoading: l4 } = useCustomerLtvReport(params);
  const { data: bookRes } = useBookingReport(params);

  const sales = salesRes?.data || {};
  const g = growthRes?.data || {};
  const op = opRes?.data || {};
  const ltv = ltvRes?.data || {};
  const bookings = bookRes?.data || {};
  const departures = bookings.upcomingDepartures || [];

  const trend = useMemo(() => (g.monthlyTrend || []).map((r) => ({
    x: monthLabel(r.month), bookings: r.booked, leads: r.leads,
  })), [g.monthlyTrend]);

  if (l1 || l2 || l3 || l4) return <ReportSkeleton />;

  const health = Math.min(100, Math.round(revenueEnabled
    ? (g.conversionRate || 0) * 0.3 + (op.slaRate || 0) * 0.25 +
      (g.revenueChange > 0 ? 20 : 10) + (ltv.repeatRate || 0) * 0.25
    : (g.leadsChange > 0 ? 25 : 15) + (op.slaRate || 0) * 0.45 +
      ((op.missedFollowUps || 0) === 0 ? 30 : 15)));
  const verdict = health >= 75 ? 'In good health' : health >= 50 ? 'Holding steady' : 'Needs your attention';

  // Plain-language headline.
  const headline = revenueEnabled
    ? ((g.revenueChange || 0) >= 0
      ? `Revenue is up ${g.revenueChange || 0}% on the previous ${periodLabel.toLowerCase()}. Keep the pipeline warm.`
      : `Revenue slipped ${Math.abs(g.revenueChange || 0)}% versus the previous ${periodLabel.toLowerCase()}. Time to tighten follow-ups.`)
    : ((g.leadsChange || 0) >= 0
      ? `Leads are up ${g.leadsChange || 0}% on the previous ${periodLabel.toLowerCase()}. Keep response speed high.`
      : `Leads slipped ${Math.abs(g.leadsChange || 0)}% versus the previous ${periodLabel.toLowerCase()}. Review channels and follow-ups.`);

  // What needs attention.
  const attention = [];
  if (revenueEnabled && (g.revenueChange || 0) < 0) attention.push({ tone: 'critical', title: 'Revenue is falling', body: `Down ${Math.abs(g.revenueChange)}% period-over-period. Review open quotes and chase negotiating leads.` });
  if ((op.missedFollowUps || 0) > 0) attention.push({ tone: 'critical', title: `${op.missedFollowUps} leads going cold`, body: 'These have had no staff follow-up. Assign them before they’re lost.' });
  if ((op.slaRate || 0) < 80) attention.push({ tone: 'warning', title: 'Response time slipping', body: revenueEnabled ? `Only ${op.slaRate || 0}% of leads get a reply within 15 minutes. Speed wins bookings.` : `Only ${op.slaRate || 0}% of leads get a reply within 15 minutes. Speed protects opportunities.` });
  if (revenueEnabled && (ltv.repeatRate || 0) < 30) attention.push({ tone: 'neutral', title: 'Few repeat bookers', body: `${ltv.repeatRate || 0}% book again. Post-trip follow-ups lift lifetime value.` });
  if (!attention.length) attention.push({ tone: 'positive', title: 'Everything on track', body: 'No fires to put out. Focus on scaling your best channels and packages.' });

  // Pipeline snapshot.
  const pipeline = g.pipelineSnapshot || [];
  const pipeTotal = pipeline.reduce((s, r) => s + (r.count || 0), 0) || 1;

  return (
    <div className="space-y-5">
      {/* Hero band */}
      <Card className="brief-rise overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <Eyebrow>Business health · {periodLabel}</Eyebrow>
              <p className="font-brief nums mt-4 text-[52px] font-semibold leading-[0.92] tracking-[-0.02em] text-[#1c1916] sm:text-[64px]">
                {revenueEnabled ? formatCurrency(sales.totalRevenue || 0) : fmtNum(g.totalLeads || 0)}
              </p>
              <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-[#6b655c]">{headline}</p>
            </div>
            <div className="grid grid-cols-3 gap-5 border-t border-[#ece8e0] pt-5">
              <Stat variant="plain" label="New leads" value={fmtNum(g.totalLeads || 0)} delta={g.leadsChange} />
              {revenueEnabled ? (
                <>
                  <Stat variant="plain" label="Bookings" value={fmtNum(g.totalBookings || 0)} delta={g.bookingsChange} />
                  <Stat variant="plain" label="Conversion" value={fmtPct(g.conversionRate || 0, 1)} />
                </>
              ) : (
                <>
                  <Stat variant="plain" label="Avg reply" value={`${op.avgResponseMinutes || 0}m`} />
                  <Stat variant="plain" label="Within SLA" value={fmtPct(op.slaRate || 0)} />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] bg-[#fbfaf7] p-6">
            <Gauge value={health} />
            <p className="font-brief text-[17px] font-semibold text-[#1c1916]">{verdict}</p>
            <div className="grid w-full grid-cols-2 gap-3 border-t border-[#ece8e0] pt-4 text-center">
              <div>
                <p className="nums font-brief text-[20px] font-semibold text-[#1c1916]">{op.avgResponseMinutes || 0}m</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">Avg reply</p>
              </div>
              <div>
                <p className="nums font-brief text-[20px] font-semibold text-[#1c1916]">{fmtPct(op.slaRate || 0)}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">Within SLA</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Attention list */}
        <SectionCard title="What needs your attention" eyebrow="Priorities" description={revenueEnabled ? 'Ranked by impact on revenue' : 'Ranked by pipeline impact'}>
          <div className="space-y-3">
            {attention.slice(0, 4).map((a, i) => (
              <Note key={i} tone={a.tone} title={a.title}>{a.body}</Note>
            ))}
          </div>
        </SectionCard>

        {/* Pipeline snapshot */}
        <SectionCard title="Pipeline right now" eyebrow="Live" description="Where every open lead is sitting today">
          {pipeline.length === 0 ? <Empty /> : (
            <div className="space-y-0.5">
              {pipeline.map((stage, i) => {
                const pct = Math.round(((stage.count || 0) / pipeTotal) * 100);
                return (
                  <BarRow
                    key={i}
                    label={text(stage.status).replace(/_/g, ' ')}
                    value={fmtNum(stage.count)}
                    pct={pct}
                    color={SERIES[i % SERIES.length]}
                    trailing={<span className="nums text-[12px] font-medium text-[#a8a299]">{pct}%</span>}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Momentum strip */}
      <SectionCard title="Momentum" eyebrow="Last 12 months" description={revenueEnabled ? 'Bookings and leads, month by month' : 'Leads, month by month'}>
        {trend.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <ChartDefs />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="x" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<BriefTooltip />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
              <Bar dataKey="leads" name="Leads" fill="#e7e1d4" radius={[5, 5, 0, 0]} barSize={18} />
              {revenueEnabled && <Area type="monotone" dataKey="bookings" name="Bookings" stroke={EMERALD} strokeWidth={2.5} fill="url(#briefArea)" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Upcoming departures — operational CRM detail */}
      {revenueEnabled && <SectionCard title="Upcoming departures" eyebrow="Next 30 days" description="Trips leaving soon — make sure documents and payments are in order">
        {departures.length === 0 ? <Empty message="No departures scheduled in the next 30 days." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {departures.slice(0, 8).map((b, i) => (
              <div key={b.id || i} className="flex items-center gap-3 rounded-[12px] border border-[#f1ede4] bg-[#fbfaf7] px-4 py-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px] bg-white" style={{ border: '1px solid #ece8e0' }}>
                  <span className="font-brief nums text-[16px] font-semibold leading-none text-[#1c1916]">{b.travelDate ? new Date(b.travelDate).getDate() : '—'}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#a8a299]">{b.travelDate ? new Date(b.travelDate).toLocaleDateString('en-IN', { month: 'short' }) : ''}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#1c1916]">{text(b.customer?.name, 'Traveller')}</p>
                  <p className="truncate text-[11.5px] text-[#a8a299]">{text(b.package?.name, 'Package')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${b.status === 'CONFIRMED' ? 'bg-[#f3f8f5] text-[#0f6a52]' : 'bg-[#fbf7ec] text-[#8a6418]'}`}>{text(b.status)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2 · REVENUE — the money story
   ════════════════════════════════════════════════════════════════════════ */

function RevenueReport({ params }) {
  const { data: salesRes, isLoading: l1 } = useSalesReport(params);
  const { data: growthRes, isLoading: l2 } = useGrowthReport(params);
  const { data: profitRes, isLoading: l3 } = useProfitReport(params);
  const { data: bookRes, isLoading: l4 } = useBookingReport(params);

  const sales = salesRes?.data || {};
  const g = growthRes?.data || {};
  const profit = profitRes?.data || {};
  const bookings = bookRes?.data || {};

  const revTrend = useMemo(() => (sales.revenueByDay || []).map((r) => ({
    date: dayLabel(r.date), revenue: rupees(r.revenue), count: Number(r.count) || 0,
  })), [sales.revenueByDay]);

  const profitData = useMemo(() => (profit.byPackage || []).slice(0, 8).map((r) => ({
    name: (r.packageName || 'Unknown').slice(0, 16),
    revenue: rupees(r.selling), cost: rupees(r.cost), profit: rupees(r.profit),
  })), [profit.byPackage]);

  if (l1 || l2 || l3 || l4) return <ReportSkeleton />;

  const revPerLead = sales.totalRevenue > 0 && g.totalLeads > 0
    ? Math.round(sales.totalRevenue / g.totalLeads) : 0;

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Revenue', value: formatCurrency(sales.totalRevenue || 0), delta: sales.revenueChange, spark: toSpark(sales.revenueByDay, 'revenue') },
        { label: 'Estimated profit', value: formatCurrency(profit.totalProfit || 0), sub: `${fmtPct(profit.profitMargin || 0)} margin`, accent: EMERALD },
        { label: 'Avg booking value', value: formatCurrency(sales.avgBookingValue || 0) },
        { label: 'Outstanding', value: formatCurrency(sales.outstanding || 0), sub: 'pending payment', accent: sales.outstanding > 0 ? CLAY : INK },
      ]} />

      <div className="grid gap-4 md:grid-cols-3">
        <Note tone={profit.profitMargin >= 30 ? 'positive' : profit.profitMargin >= 15 ? 'warning' : 'critical'} title={`Profit margin · ${fmtPct(profit.profitMargin || 0)}`}>
          {profit.profitMargin >= 30 ? 'Healthy margins — your pricing is working.'
            : profit.profitMargin >= 15 ? 'Moderate margins. Upsell premium packages to lift this.'
            : 'Thin margins. Review supplier costs and package pricing.'}
        </Note>
        <Note tone={bookings.cancellationRate <= 5 ? 'positive' : bookings.cancellationRate <= 15 ? 'warning' : 'critical'} title={`Cancellations · ${fmtPct(bookings.cancellationRate || 0)}`}>
          {bookings.cancellationRate <= 5 ? 'Very low — customers are committed.'
            : 'Watch cancellation reasons and firm up your booking policy.'}
        </Note>
        <Note tone="neutral" title="Revenue per lead">
          {revPerLead > 0 ? `Each lead is worth ~${formatCurrency(revPerLead)} on average. Use it to cap your acquisition spend.`
            : 'Track revenue per lead to guide marketing spend.'}
        </Note>
      </div>

      <SectionCard
        title="Revenue over time" eyebrow="Cash in" description="Daily revenue and number of transactions"
        action={<ExportButton onClick={() => downloadCsv(analyticsApi, 'sales', params)} />}
      >
        {revTrend.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={revTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <ChartDefs />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={moneyTick} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<BriefTooltip formatter={(v, p) => (p?.dataKey === 'revenue' ? moneyTip(v) : fmtNum(v))} />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
              <Bar yAxisId="r" dataKey="count" name="Transactions" fill="#e7e1d4" radius={[5, 5, 0, 0]} barSize={14} />
              <Area yAxisId="l" type="monotone" dataKey="revenue" name="Revenue" stroke={EMERALD} strokeWidth={2.5} fill="url(#briefArea)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Profit by package" eyebrow="Margins" description="Revenue, estimated cost and profit per package">
        {profitData.length === 0 ? <Empty message="No profit data yet." /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={profitData} barGap={3} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" tick={{ ...axisTick, fill: INK_SOFT }} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={moneyTick} />
              <Tooltip content={<BriefTooltip formatter={moneyTip} />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill={INK} radius={[5, 5, 0, 0]} barSize={16} />
              <Bar dataKey="cost" name="Est. cost" fill="#d9d2c4" radius={[5, 5, 0, 0]} barSize={16} />
              <Bar dataKey="profit" name="Profit" fill={EMERALD} radius={[5, 5, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Top destinations by revenue" eyebrow="Where the money is" description="Your most lucrative places to sell">
        {(bookings.topDestinations || []).length === 0 ? <Empty message="No destination revenue yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ece8e0] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="py-2.5 pr-4">Destination</th>
                  <th className="px-3 py-2.5 text-right">Bookings</th>
                  <th className="px-3 py-2.5 text-right">Travellers</th>
                  <th className="py-2.5 pl-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {(bookings.topDestinations || []).map((r, i) => (
                  <tr key={i} className="text-[13px]">
                    <td className="py-3 pr-4 font-semibold text-[#1c1916]">{text(r.destination)}</td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(r.booking_count)}</td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(r.total_travellers)}</td>
                    <td className="nums py-3 pl-3 text-right font-bold text-[#1c1916]">{formatCurrency(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3 · LEADS — lead management
   ════════════════════════════════════════════════════════════════════════ */

function LeadsReport({ params, revenueEnabled = true }) {
  const { data: funnelRes, isLoading: l1 } = useLeadFunnelReport(params);
  const { data: growthRes, isLoading: l2 } = useGrowthReport(params);
  const { data: lostRes } = useLostLeadsReport(params);

  const d = funnelRes?.data || {};
  const g = growthRes?.data || {};
  const lost = lostRes?.data || {};

  const funnel = d.funnel || [];
  const maxFunnel = Math.max(...funnel.map((f) => f.count || 0), 1);

  const byDay = useMemo(() => (d.leadsByDay || []).map((r) => ({
    date: dayLabel(r.date), leads: Number(r.count) || 0,
  })), [d.leadsByDay]);

  const statusData = useMemo(() => (d.leadsByStatus || []).map((r) => ({
    name: text(r.status).replace(/_/g, ' '), value: Number(r.count) || 0,
  })), [d.leadsByStatus]);
  const statusTotal = statusData.reduce((s, r) => s + r.value, 0) || 1;

  const lostReasons = useMemo(() => {
    const rows = (lost.lostReasons || []).map((r) => ({ reason: text(r.lostReason, 'Other'), count: Number(r.count) || 0 }));
    if (lost.noReasonCount > 0) rows.push({ reason: 'No reason recorded', count: lost.noReasonCount });
    return rows.sort((a, b) => b.count - a.count);
  }, [lost.lostReasons, lost.noReasonCount]);
  const maxLost = Math.max(...lostReasons.map((r) => r.count), 1);

  if (l1 || l2) return <ReportSkeleton />;

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Total leads', value: fmtNum(d.totalLeads || 0), delta: d.leadsChange, spark: toSpark(d.leadsByDay, 'count') },
        ...(revenueEnabled ? [{ label: 'Lead → booking', value: fmtPct(d.conversionRate || 0, 1), accent: EMERALD }] : []),
        { label: 'Sales velocity', value: `${g.avgVelocityDays || 0} days`, sub: `median ${g.medianVelocityDays || 0}d` },
        ...(revenueEnabled ? [{ label: 'Booked', value: fmtNum((d.leadsByStatus || []).find((r) => text(r.status) === 'BOOKED')?.count || 0) }] : []),
      ]} />

      <Note tone={g.avgVelocityDays <= 7 ? 'positive' : g.avgVelocityDays <= 14 ? 'warning' : 'critical'} title="Pipeline velocity">
        {g.avgVelocityDays <= 7
          ? `Leads convert in just ${g.avgVelocityDays} days on average — a fast, efficient pipeline.`
          : g.avgVelocityDays <= 14
          ? `Leads take ${g.avgVelocityDays} days to convert. Faster first replies and nurturing will tighten this.`
          : `Leads take ${g.avgVelocityDays} days to convert — too slow. Add drip campaigns and quicker staff responses.`}
      </Note>

      <LeadHeatmap />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Conversion funnel" eyebrow="Lead journey" description="Enquiry → contacted → quoted → booked"
          action={<ExportButton onClick={() => downloadCsv(analyticsApi, 'leads', params)} />}
        >
          {funnel.length === 0 ? <Empty /> : (
            <div className="space-y-1.5 py-1">
              {funnel.map((stage, i) => {
                const pct = ((stage.count || 0) / maxFunnel) * 100;
                const rate = i > 0 && funnel[i - 1].count > 0 ? Math.round((stage.count / funnel[i - 1].count) * 100) : null;
                return (
                  <BarRow
                    key={i}
                    label={text(stage.stage, 'Stage')}
                    value={fmtNum(stage.count)}
                    pct={pct}
                    color={i === funnel.length - 1 ? EMERALD : INK}
                    trailing={rate !== null && <span className="rounded-full bg-[#f3f8f5] px-2 py-0.5 text-[11px] font-bold text-[#0f6a52]">{rate}%</span>}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Status mix" eyebrow="Distribution">
            {statusData.length === 0 ? <Empty height={120} /> : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" nameKey="name" paddingAngle={2} stroke="none">
                      {statusData.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip content={<BriefTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {statusData.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex items-center gap-2 truncate font-medium text-[#6b655c]">
                        <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                        {s.name}
                      </span>
                      <span className="nums font-bold text-[#1c1916]">{Math.round((s.value / statusTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Leads over time" eyebrow="Inbound" description="New leads per day">
            {byDay.length === 0 ? <Empty height={120} /> : (
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <ChartDefs />
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip content={<BriefTooltip />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke={SLATE} strokeWidth={2.5} fill="url(#briefAreaInk)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Why leads are lost */}
      <SectionCard
        title="Why you’re losing leads" eyebrow={`Loss rate · ${fmtPct(lost.lossRate || 0)}`}
        description={`${fmtNum(lost.lostCount || 0)} of ${fmtNum(lost.totalLeads || 0)} leads were lost or cancelled this period`}
      >
        {lostReasons.length === 0 ? <Empty message="No lost leads recorded — nicely done." /> : (
          <div className="space-y-0.5">
            {lostReasons.map((r, i) => (
              <BarRow key={i} label={r.reason} value={fmtNum(r.count)} pct={(r.count / maxLost) * 100} color={CLAY} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4 · CHANNELS — where leads come from (Instagram, Facebook, WhatsApp…)
   ════════════════════════════════════════════════════════════════════════ */

function ChannelsReport({ params, revenueEnabled = true }) {
  const { data: cacRes, isLoading: l1 } = useCacReport(params);
  const { data: srcRes, isLoading: l2 } = useSourceReport(params);
  const { data: adRes } = useLeadsByAdReport(params);

  const cac = cacRes?.data || {};
  const src = srcRes?.data || {};
  const ads = useMemo(() => (adRes?.data?.ads || []), [adRes]);
  const maxAdLeads = Math.max(...ads.map((a) => a.leads || 0), 1);

  const channels = useMemo(() => (cac.sources || [])
    .map((s) => ({ ...s, meta: channelMeta(s.source) }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0)), [cac.sources]);

  const totalLeads = channels.reduce((s, c) => s + (c.leads || 0), 0) || 1;
  const maxLeads = Math.max(...channels.map((c) => c.leads || 0), 1);
  const bestQuality = [...channels].filter((c) => c.leads >= 3).sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0];
  const bestRevenue = revenueEnabled ? [...channels].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0] : null;

  // Pivot daily source counts into a multi-line trend for the top channels.
  const topLabels = channels.slice(0, 4).map((c) => c.meta.label);
  const trend = useMemo(() => {
    const rows = {};
    (src.sourceByDay || []).forEach((r) => {
      const dl = dayLabel(r.date);
      const m = channelMeta(r.source);
      if (!topLabels.includes(m.label)) return;
      rows[dl] = rows[dl] || { date: dl };
      rows[dl][m.label] = (rows[dl][m.label] || 0) + (Number(r.count) || 0);
    });
    return Object.values(rows);
  }, [src.sourceByDay, topLabels.join(',')]);

  if (l1 || l2) return <ReportSkeleton />;

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Leads from channels', value: fmtNum(cac.totalLeads || totalLeads) },
        { label: 'Best for volume', value: channels[0]?.meta.label || '—', sub: `${fmtNum(channels[0]?.leads || 0)} leads`, accent: channels[0]?.meta.color },
        { label: 'Best for quality', value: bestQuality?.meta.label || '—', sub: bestQuality ? `${fmtPct(bestQuality.conversionRate)} convert` : 'n/a', accent: bestQuality?.meta.color },
        ...(revenueEnabled ? [{ label: 'Top earner', value: bestRevenue?.meta.label || '—', sub: bestRevenue ? formatCurrency(bestRevenue.revenue) : 'n/a', accent: EMERALD }] : []),
      ]} />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Where your leads come from" eyebrow="Acquisition" description="Share of leads by channel">
          {channels.length === 0 ? <Empty /> : (
            <div className="space-y-0.5">
              {channels.map((c, i) => (
                <BarRow
                  key={i}
                  label={c.meta.label}
                  meta={c.meta}
                  value={fmtNum(c.leads)}
                  pct={((c.leads || 0) / maxLeads) * 100}
                  color={c.meta.color}
                  trailing={<span className="nums text-[12px] font-medium text-[#a8a299]">{Math.round(((c.leads || 0) / totalLeads) * 100)}%</span>}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Channel quality" eyebrow="Conversion" description={revenueEnabled ? 'How well each channel turns into bookings' : 'How well each channel creates qualified leads'}>
          {channels.length === 0 ? <Empty /> : (
            <div className="overflow-hidden rounded-[12px] border border-[#ece8e0]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#fbfaf7] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-3 py-2.5 text-right">Leads</th>
                    <th className="px-3 py-2.5 text-right">Booked</th>
                    <th className="px-3 py-2.5 text-right">Conv.</th>
                    {revenueEnabled && <th className="px-4 py-2.5 text-right">Revenue</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1ede4]">
                  {channels.map((c, i) => (
                    <tr key={i} className="text-[13px]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-semibold text-[#3a352e]">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.meta.color }} />
                          {c.meta.label}
                        </span>
                      </td>
                      <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(c.leads)}</td>
                      <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(c.booked)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`nums rounded-full px-2 py-0.5 text-[11px] font-bold ${c.conversionRate >= 20 ? 'bg-[#f3f8f5] text-[#0f6a52]' : c.conversionRate >= 10 ? 'bg-[#fbf7ec] text-[#8a6418]' : 'bg-[#f1ede4] text-[#8a8278]'}`}>
                          {fmtPct(c.conversionRate)}
                        </span>
                      </td>
                      {revenueEnabled && <td className="nums px-4 py-3 text-right font-bold text-[#1c1916]">{formatCurrency(c.revenue)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Channel momentum" eyebrow="Trend" description="Daily leads from your top channels">
        {trend.length === 0 ? <Empty message="No channel trend for this period." /> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<BriefTooltip />} cursor={{ stroke: '#ece8e0' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              {channels.slice(0, 4).map((c) => (
                <Line key={c.meta.label} type="monotone" dataKey={c.meta.label} name={c.meta.label} stroke={c.meta.color} strokeWidth={2.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Leads by ad" eyebrow="Click-to-WhatsApp" description="Which Meta ad each lead came from — even when every ad points to the same WhatsApp number">
        {ads.length === 0 ? (
          <Empty message="No ad-attributed leads yet. New Click-to-WhatsApp leads will appear here automatically." />
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[#ece8e0]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#fbfaf7] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="px-4 py-2.5">Ad</th>
                  <th className="px-3 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  <th className="px-3 py-2.5 text-right">Booked</th>
                  <th className="px-3 py-2.5 text-right">Conv.</th>
                  <th className="px-4 py-2.5 w-32">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {ads.map((a) => (
                  <tr key={a.adId} className="text-[13px]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold text-[#3a352e]">
                        <span className="rounded bg-sky-600 px-1 text-[9px] font-bold uppercase tracking-wide text-white">Ad</span>
                        <span className="truncate max-w-[200px]">{a.adName}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#6b655c]">{a.campaignName || '—'}</td>
                    <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(a.leads)}</td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(a.booked)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`nums rounded-full px-2 py-0.5 text-[11px] font-bold ${a.conversionRate >= 20 ? 'bg-[#f3f8f5] text-[#0f6a52]' : a.conversionRate >= 10 ? 'bg-[#fbf7ec] text-[#8a6418]' : 'bg-[#f1ede4] text-[#8a8278]'}`}>
                        {fmtPct(a.conversionRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1ede4]">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${((a.leads || 0) / maxAdLeads) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   5 · MARKETING — broadcast / campaign ROI
   ════════════════════════════════════════════════════════════════════════ */

function MarketingReport({ params, revenueEnabled = true }) {
  const { data, isLoading } = useCampaignRoiReport(params);
  const d = data?.data || {};

  const chartData = (d.campaigns || []).slice(0, 10).map((c) => ({
    name: (c.name || 'Campaign').slice(0, 14),
    read: c.read || 0, leads: c.leadsGenerated || 0, revenue: rupees(c.revenue),
  }));

  if (isLoading) return <ReportSkeleton />;

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Campaigns sent', value: fmtNum(d.totalCampaigns || 0), sub: `${fmtNum(d.totalSent || 0)} messages` },
        { label: 'Delivery rate', value: fmtPct(d.avgDeliveryRate || 0), sub: `${fmtNum(d.totalDelivered || 0)} delivered` },
        { label: 'Read rate', value: fmtPct(d.avgReadRate || 0), sub: `${fmtNum(d.totalRead || 0)} read`, accent: GOLD },
        ...(revenueEnabled ? [{ label: 'Campaign revenue', value: formatCurrency(d.totalRevenue || 0), sub: `${fmtNum(d.totalBookings || 0)} bookings`, accent: EMERALD }] : []),
      ]} />

      <div className="grid gap-4 md:grid-cols-3">
        <Note tone={d.avgLeadRate >= 5 ? 'positive' : 'warning'} title={`Lead generation · ${fmtPct(d.avgLeadRate || 0)}`}>
          {d.avgLeadRate >= 5 ? 'Strong — each broadcast sparks real interest.' : 'Sharpen targeting and messaging to lift response.'}
        </Note>
        {revenueEnabled && (
          <Note tone={d.avgBookingRate >= 1 ? 'positive' : 'warning'} title={`Booking rate · ${fmtPct(d.avgBookingRate || 0)}`}>
            {d.avgBookingRate >= 1 ? 'Campaigns convert into bookings — scale your best templates.' : 'Add stronger CTAs and direct booking links.'}
          </Note>
        )}
        <Note tone="neutral" title={`Reply rate · ${fmtPct(d.avgReplyRate || 0)}`}>
          {d.avgReplyRate >= 10 ? 'High engagement — your audience is responding.' : 'Try more personal, interactive templates.'}
        </Note>
      </div>

      <SectionCard title="Top campaigns" eyebrow="Performance" description={revenueEnabled ? 'Reads, leads and revenue per broadcast' : 'Reads and leads per broadcast'}>
        {chartData.length === 0 ? <Empty message="No campaigns sent in this period." /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={moneyTick} />
              <Tooltip content={<BriefTooltip formatter={(v, p) => (p?.dataKey === 'revenue' ? moneyTip(v) : fmtNum(v))} />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar yAxisId="l" dataKey="read" name="Read" fill="#e0d8c8" radius={[5, 5, 0, 0]} barSize={14} />
              <Bar yAxisId="l" dataKey="leads" name="Leads" fill={SLATE} radius={[5, 5, 0, 0]} barSize={14} />
              {revenueEnabled && <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke={EMERALD} strokeWidth={2.5} dot={{ r: 3, fill: EMERALD }} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Campaign ledger" eyebrow="Detail" description="Every broadcast in this period">
        {(d.campaigns || []).length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ece8e0] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="py-2.5 pr-4">Campaign</th>
                  <th className="px-3 py-2.5 text-right">Sent</th>
                  <th className="px-3 py-2.5 text-right">Read</th>
                  <th className="px-3 py-2.5 text-right">Reply</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  {revenueEnabled && <th className="px-3 py-2.5 text-right">Bookings</th>}
                  {revenueEnabled && <th className="py-2.5 pl-3 text-right">Revenue</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {(d.campaigns || []).map((c) => (
                  <tr key={c.id} className="text-[13px]">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#1c1916]">{text(c.name)}</p>
                      <p className="text-[11px] text-[#a8a299]">{text(c.type, '')}</p>
                    </td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(c.sent)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`nums rounded-full px-2 py-0.5 text-[11px] font-bold ${c.readRate >= 50 ? 'bg-[#f3f8f5] text-[#0f6a52]' : c.readRate >= 25 ? 'bg-[#fbf7ec] text-[#8a6418]' : 'bg-[#f1ede4] text-[#8a8278]'}`}>{fmtPct(c.readRate)}</span>
                    </td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtPct(c.replyRate)}</td>
                    <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(c.leadsGenerated)}</td>
                    {revenueEnabled && <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(c.bookings)}</td>}
                    {revenueEnabled && <td className="nums py-3 pl-3 text-right font-bold text-[#1c1916]">{formatCurrency(c.revenue)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   6 · CUSTOMERS
   ════════════════════════════════════════════════════════════════════════ */

function CustomersReport({ params, revenueEnabled = true }) {
  const { data: ltvRes, isLoading: l1 } = useCustomerLtvReport(params);
  const { data: cacRes, isLoading: l2 } = useCacReport(params);

  const ltv = ltvRes?.data || {};
  const cac = cacRes?.data || {};
  const top = ltv.topCustomers || [];
  const maxSpent = Math.max(...top.map((c) => c.totalSpent || 0), 1);

  if (l1 || l2) return <ReportSkeleton />;

  return (
    <div className="space-y-5">
      <StatCards items={[
        ...(revenueEnabled ? [{ label: 'Avg lifetime value', value: formatCurrency(ltv.avgLtv || 0), accent: EMERALD }] : []),
        { label: 'Total customers', value: fmtNum(ltv.totalCustomers || 0) },
        ...(revenueEnabled ? [{ label: 'Repeat rate', value: fmtPct(ltv.repeatRate || 0), sub: '2+ bookings' }] : []),
        ...(revenueEnabled ? [{ label: 'Blended conversion', value: fmtPct(cac.avgConversionRate || 0), sub: 'lead → booking' }] : []),
      ]} />

      <div className="grid gap-4 md:grid-cols-2">
        <Note tone="neutral" title="Acquisition cost">{text(cac.note, 'Track spend per channel to compute cost per customer.')}</Note>
        {revenueEnabled && <Note tone={ltv.repeatRate >= 30 ? 'positive' : 'warning'} title="Repeat bookings">
          {ltv.repeatRate >= 30 ? 'Strong loyalty — launch a referral or loyalty program to push it higher.'
            : 'Most customers book once. Post-trip drips and referral incentives will change that.'}
        </Note>}
      </div>

      <SectionCard title={revenueEnabled ? 'Your most valuable customers' : 'Customer directory'} eyebrow={revenueEnabled ? 'Top by lifetime value' : 'Customers'} description={revenueEnabled ? 'The relationships worth protecting' : 'Known customers from your workspace'}>
        {top.length === 0 ? <Empty /> : (
          <div className="space-y-2.5">
            {top.map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-4 rounded-[12px] border border-[#f1ede4] bg-[#fbfaf7] px-4 py-3">
                <Rank n={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#1c1916]">{text(c.name)}</p>
                  <p className="text-[11.5px] text-[#a8a299]">{revenueEnabled ? `${text(c.phone, '')} · ${fmtNum(c.totalBookings)} bookings${c.lastBooking ? ` · last ${formatDate(c.lastBooking)}` : ''}` : text(c.phone, '')}</p>
                </div>
                {revenueEnabled && <div className="hidden w-40 sm:block">
                  <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#efe9dd]">
                    <div className="h-full rounded-full" style={{ width: `${((c.totalSpent || 0) / maxSpent) * 100}%`, background: EMERALD }} />
                  </div>
                </div>}
                {revenueEnabled && <div className="w-28 text-right">
                  <p className="nums text-[14px] font-bold text-[#1c1916]">{formatCurrency(c.totalSpent)}</p>
                  <p className="text-[11px] text-[#a8a299]">avg {formatCurrency(c.avgBookingValue)}</p>
                </div>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   7 · PACKAGES
   ════════════════════════════════════════════════════════════════════════ */

function PackagesReport({ params, revenueEnabled = true }) {
  const { data, isLoading } = usePackageReport(params);
  const packages = data?.data?.packages || [];

  if (isLoading) return <ReportSkeleton />;

  const totalBookings = packages.reduce((s, p) => s + (p.bookingCount || 0), 0);
  const totalRevenue = packages.reduce((s, p) => s + (p.totalRevenue || 0), 0);
  const avgConv = packages.length ? packages.reduce((s, p) => s + (p.conversionRate || 0), 0) / packages.length : 0;

  const revChart = packages.slice(0, 8).map((p) => ({
    name: (p.package?.name || 'N/A').slice(0, 14),
    bookings: p.bookingCount || 0, leads: p.leads || 0, revenue: rupees(p.totalRevenue),
  }));

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Live packages', value: fmtNum(packages.length) },
        ...(revenueEnabled ? [
          { label: 'Total bookings', value: fmtNum(totalBookings) },
          { label: 'Package revenue', value: formatCurrency(totalRevenue), accent: EMERALD },
          { label: 'Avg conversion', value: fmtPct(avgConv, 1) },
        ] : [
          { label: 'Package enquiries', value: fmtNum(packages.reduce((s, p) => s + (p.leads || 0), 0)) },
        ]),
      ]} />

      <SectionCard
        title="Package performance" eyebrow="Products" description={revenueEnabled ? 'Leads, bookings, conversion and revenue per package' : 'Leads per package'}
        action={<ExportButton onClick={() => downloadCsv(analyticsApi, 'packages', params)} />}
      >
        {packages.length === 0 ? <Empty message="No package data yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ece8e0] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-4">Package</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  {revenueEnabled && <th className="px-3 py-2.5 text-right">Bookings</th>}
                  {revenueEnabled && <th className="px-3 py-2.5 text-right">Conv.</th>}
                  {revenueEnabled && <th className="py-2.5 pl-3 text-right">Revenue</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {packages.map((p, i) => (
                  <tr key={p.package?.id || i} className="text-[13px]">
                    <td className="py-3 pr-3 text-[#a8a299]"><Rank n={i + 1} /></td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#1c1916]">{text(p.package?.name, 'N/A')}</p>
                      <p className="text-[11px] text-[#a8a299]">{text(p.package?.category, '')}</p>
                    </td>
                    <td className="px-3 py-3 text-[#6b655c]">{text((p.package?.destinations || []).join(', '), '—')}</td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(p.leads)}</td>
                    {revenueEnabled && <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(p.bookingCount)}</td>}
                    {revenueEnabled && (
                      <td className="px-3 py-3 text-right">
                        <span className={`nums rounded-full px-2 py-0.5 text-[11px] font-bold ${p.conversionRate >= 30 ? 'bg-[#f3f8f5] text-[#0f6a52]' : p.conversionRate >= 15 ? 'bg-[#fbf7ec] text-[#8a6418]' : 'bg-[#f1ede4] text-[#8a8278]'}`}>{fmtPct(p.conversionRate)}</span>
                      </td>
                    )}
                    {revenueEnabled && <td className="nums py-3 pl-3 text-right font-bold text-[#1c1916]">{formatCurrency(p.totalRevenue)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {revenueEnabled && revChart.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard title="Bookings vs enquiries" eyebrow="Demand">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revChart} barGap={3} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" tick={{ ...axisTick, fill: INK_SOFT }} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<BriefTooltip />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="leads" name="Enquiries" fill="#e0d8c8" radius={[5, 5, 0, 0]} barSize={20} />
                <Bar dataKey="bookings" name="Bookings" fill={INK} radius={[5, 5, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Revenue by package" eyebrow="Earnings">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" tick={{ ...axisTick, fill: INK_SOFT }} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={moneyTick} />
                <Tooltip content={<BriefTooltip formatter={moneyTip} />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
                <Bar dataKey="revenue" name="Revenue" fill={EMERALD} radius={[5, 5, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   8 · TEAM — staff & responsiveness
   ════════════════════════════════════════════════════════════════════════ */

function TeamReport({ params, revenueEnabled = true }) {
  const { data: agentRes, isLoading: l1 } = useAgentPerformanceReport(params);
  const { data: opRes, isLoading: l2 } = useOperationalReport(params);

  const agents = agentRes?.data?.agents || [];
  const op = opRes?.data || {};

  const responseDist = (op.responseDistribution || []).map((r) => ({ name: r.bucket, count: r.count || 0 }));
  const maxResp = Math.max(...responseDist.map((r) => r.count), 1);

  if (l1 || l2) return <ReportSkeleton />;

  const teamRevenue = agents.reduce((s, a) => s + (a.revenue || 0), 0);

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Team members', value: fmtNum(agents.length) },
        ...(revenueEnabled ? [{ label: 'Bookings won', value: fmtNum(agents.reduce((s, a) => s + (a.leadsConverted || 0), 0)) }] : []),
        { label: 'Leads going cold', value: fmtNum(op.missedFollowUps || 0), sub: 'no follow-up', accent: op.missedFollowUps > 0 ? CLAY : INK },
        ...(revenueEnabled ? [{ label: 'Team revenue', value: formatCurrency(teamRevenue), accent: EMERALD }] : []),
      ]} />

      <Note tone={op.missedFollowUps === 0 ? 'positive' : op.missedFollowUps <= 5 ? 'warning' : 'critical'} title="Follow-up coverage">
        {op.missedFollowUps === 0 ? 'Every lead has had at least one follow-up. Nothing slipping through.'
          : `${op.missedFollowUps} leads have had no agent follow-up — hot leads going cold. Assign them now.`}
      </Note>

      <SectionCard
        title="Staff leaderboard" eyebrow="Team performance" description={revenueEnabled ? 'Ranked by revenue generated' : 'Ranked by lead handling activity'}
        action={<ExportButton onClick={() => downloadCsv(analyticsApi, 'agents', params)} />}
      >
        {agents.length === 0 ? <Empty message="No team members found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ece8e0] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-4">Staff</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  {revenueEnabled && <th className="px-3 py-2.5 text-right">Booked</th>}
                  {revenueEnabled && <th className="px-3 py-2.5 text-right">Conv.</th>}
                  <th className="px-3 py-2.5 text-right">Messages</th>
                  {revenueEnabled && <th className="py-2.5 pl-3 text-right">Revenue</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {agents.map((a, i) => (
                  <tr key={a.id || i} className="text-[13px]">
                    <td className="py-3 pr-3"><Rank n={i + 1} /></td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#1c1916]">{text(a.name)}</p>
                      <p className="text-[11px] text-[#a8a299]">{text(a.role, '')}</p>
                    </td>
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(a.leadsAssigned)}</td>
                    {revenueEnabled && <td className="nums px-3 py-3 text-right font-semibold text-[#1c1916]">{fmtNum(a.leadsConverted)}</td>}
                    {revenueEnabled && (
                      <td className="px-3 py-3 text-right">
                        <span className={`nums rounded-full px-2 py-0.5 text-[11px] font-bold ${a.conversionRate >= 20 ? 'bg-[#f3f8f5] text-[#0f6a52]' : a.conversionRate >= 10 ? 'bg-[#fbf7ec] text-[#8a6418]' : 'bg-[#f1ede4] text-[#8a8278]'}`}>{fmtPct(a.conversionRate)}</span>
                      </td>
                    )}
                    <td className="nums px-3 py-3 text-right text-[#6b655c]">{fmtNum(a.messagesSent)}</td>
                    {revenueEnabled && <td className="nums py-3 pl-3 text-right font-bold text-[#1c1916]">{formatCurrency(a.revenue)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <StaffScorecards agents={agents} revenueEnabled={revenueEnabled} />

      <SectionCard title="How fast your team replies" eyebrow="Responsiveness" description="Distribution of first-response times">
        {responseDist.length === 0 ? <Empty /> : (
          <div className="space-y-0.5">
            {responseDist.map((r, i) => (
              <BarRow key={i} label={r.name} value={fmtNum(r.count)} pct={(r.count / maxResp) * 100} color={i === 0 ? EMERALD : SLATE} />
            ))}
          </div>
        )}
      </SectionCard>

      {(op.agentWorkload || []).length > 0 && (
        <SectionCard title="Workload balance" eyebrow="Distribution" description={revenueEnabled ? 'Leads, messages and bookings handled per person' : 'Leads and messages handled per person'}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={(op.agentWorkload || []).slice(0, 8).map((a) => ({
                name: (a.name || 'Staff').split(' ')[0],
                leads: a.leadsAssigned, messages: a.messagesSent, bookings: a.conversions,
              }))}
              barGap={3} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" tick={{ ...axisTick, fill: INK_SOFT }} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<BriefTooltip />} cursor={{ fill: 'rgba(28,25,20,0.03)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="leads" name="Leads" fill="#dfd9cc" radius={[5, 5, 0, 0]} barSize={16} />
              <Bar dataKey="messages" name="Messages" fill={SLATE} radius={[5, 5, 0, 0]} barSize={16} />
              {revenueEnabled && <Bar dataKey="bookings" name="Bookings" fill={EMERALD} radius={[5, 5, 0, 0]} barSize={16} />}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   9 · REVIEWS
   ════════════════════════════════════════════════════════════════════════ */

function ReviewsReport({ params }) {
  const { data, isLoading } = useReviewReport(params);
  const d = data?.data || {};

  const ratingRows = useMemo(() => [5, 4, 3, 2, 1].map((r) => {
    const match = (d.ratingDistribution || []).find((x) => parseInt(x.rating, 10) === r);
    return { stars: r, count: parseInt(match?.count || '0', 10) };
  }), [d.ratingDistribution]);
  const maxRating = Math.max(...ratingRows.map((r) => r.count), 1);

  if (isLoading) return <ReportSkeleton />;

  const sentiment = d.avgRating >= 4.5 ? 'Promoter-heavy' : d.avgRating >= 3.5 ? 'Mixed' : 'Detractor-heavy';
  const sentimentTone = d.avgRating >= 4.5 ? EMERALD : d.avgRating >= 3.5 ? GOLD : CLAY;
  const negatives = d.negativeReviews || [];

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Average rating', value: `${d.avgRating || 0} ★`, accent: GOLD },
        { label: 'Total reviews', value: fmtNum(d.totalReviews || 0) },
        { label: 'Negative reviews', value: fmtNum(negatives.length), sub: 'rating ≤ 2', accent: negatives.length ? CLAY : INK },
        { label: 'Sentiment', value: sentiment, accent: sentimentTone },
      ]} />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Rating distribution" eyebrow="Satisfaction">
          <div className="space-y-0.5">
            {ratingRows.map((r) => (
              <BarRow key={r.stars} label={`${r.stars} ★`} value={fmtNum(r.count)} pct={(r.count / maxRating) * 100} color={r.stars >= 4 ? EMERALD : r.stars === 3 ? GOLD : CLAY} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Best-loved destinations" eyebrow="By rating" description="Where you delight customers most">
          {(d.reviewsByDestination || []).length === 0 ? <Empty message="No destination reviews yet." /> : (
            <div className="space-y-2">
              {(d.reviewsByDestination || []).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-[12px] border border-[#f1ede4] bg-[#fbfaf7] px-4 py-3">
                  <span className="text-[13px] font-semibold text-[#3a352e]">{text(r.destination)}</span>
                  <span className="flex items-center gap-2">
                    <span className="nums text-[13px] font-bold" style={{ color: GOLD }}>{r.avgRating} ★</span>
                    <span className="text-[11px] text-[#a8a299]">({fmtNum(r.count)})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {negatives.length > 0 && (
        <SectionCard title="Needs a personal call" eyebrow="Negative feedback" description="Reviews rated 2 stars or lower">
          <div className="grid gap-3 md:grid-cols-2">
            {negatives.map((r, i) => (
              <div key={i} className="rounded-[12px] border border-[#eccfc4] bg-[#fbf2ee] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#1c1916]">{text(r.customer?.name, 'Anonymous')}</p>
                  <span className="nums text-[13px] font-bold text-[#b4533a]">{r.rating} ★</span>
                </div>
                {r.testimonial && <p className="mt-2 text-[12.5px] italic leading-relaxed text-[#6b655c]">“{r.testimonial}”</p>}
                {r.destination && <p className="mt-1.5 text-[11px] text-[#a8a299]">{text(r.destination)}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ORCHESTRATOR
   ════════════════════════════════════════════════════════════════════════ */

const ITEM_FINANCE_TYPES = [
  { key: 'PACKAGE', label: 'Package', endpoint: '/packages', name: (item) => item.name, meta: (item) => (item.destinations || []).join(', ') || item.duration },
  { key: 'PROPERTY', label: 'Property', endpoint: '/properties', name: (item) => item.name, meta: (item) => item.location || item.propertyType },
  { key: 'CRUISE', label: 'Cruise', endpoint: '/cruises', name: (item) => item.name, meta: (item) => item.cruiseLine || item.departurePort },
  { key: 'VISA', label: 'Visa', endpoint: '/visas', name: (item) => `${item.country || 'Visa'}${item.visaType ? ` - ${item.visaType}` : ''}`, meta: (item) => item.processingTime },
  { key: 'SERVICE', label: 'Service', endpoint: '/services', name: (item) => item.name, meta: (item) => item.category || item.pricingType },
];

function listFromResponse(response) {
  const data = response?.data;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function ItemFinanceReport() {
  const navigate = useNavigate();
  const [itemType, setItemType] = useState('PACKAGE');
  const selectedType = ITEM_FINANCE_TYPES.find((type) => type.key === itemType) || ITEM_FINANCE_TYPES[0];

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['report-item-finance-catalog', selectedType.key],
    queryFn: () => client.get(selectedType.endpoint, { params: { limit: 200 } }).then(listFromResponse),
  });

  const openReport = (item) => {
    if (selectedType.key === 'PACKAGE') {
      navigate(`/packages/${item.id}/finance`);
      return;
    }
    navigate(`/finance/${selectedType.key}/${item.id}`);
  };

  return (
    <div className="space-y-5">
      <StatCards items={[
        { label: 'Report type', value: 'P&L' },
        { label: 'Receivables', value: 'Customer wise', accent: EMERALD },
        { label: 'Payables', value: 'Vendor wise', accent: CLAY },
        { label: 'Current catalog', value: fmtNum(items.length) },
      ]} />

      <SectionCard
        title="Item finance reports"
        eyebrow="Finance"
        description="Open profit & loss, receivables, payables and vendor analysis for any package, property, cruise, visa or service."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {ITEM_FINANCE_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => setItemType(type.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${itemType === type.key
                ? 'bg-[#1c1916] text-white shadow-sm'
                : 'border border-[#ece8e0] bg-white text-[#8a8278] hover:border-[#d9d4c8] hover:text-[#1c1916]'}`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {isLoading ? <ReportSkeleton /> : items.length === 0 ? <Empty message={`No ${selectedType.label.toLowerCase()} records found.`} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ece8e0] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-4">{selectedType.label}</th>
                  <th className="px-3 py-2.5">Details</th>
                  <th className="py-2.5 pl-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1ede4]">
                {items.map((item, index) => (
                  <tr key={item.id || index} className="text-[13px]">
                    <td className="py-3 pr-3 text-[#a8a299]"><Rank n={index + 1} /></td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#1c1916]">{text(selectedType.name(item), selectedType.label)}</p>
                      <p className="text-[11px] text-[#a8a299]">{item.isActive === false ? 'Inactive' : 'Active'}</p>
                    </td>
                    <td className="px-3 py-3 text-[#6b655c]">{text(selectedType.meta(item), '-')}</td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => openReport(item)}
                        className="rounded-full bg-[#0f8a6b] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b7258]"
                      >
                        Open Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

const REPORTS = [
  { key: 'pulse', label: 'Pulse', Component: PulseReport },
  { key: 'crm', label: 'CRM', Component: CrmReport },
  { key: 'revenue', label: 'Revenue', Component: RevenueReport, requiresRevenue: true },
  { key: 'leads', label: 'Leads', Component: LeadsReport },
  { key: 'channels', label: 'Channels', Component: ChannelsReport },
  { key: 'marketing', label: 'Marketing', Component: MarketingReport },
  { key: 'customers', label: 'Customers', Component: CustomersReport },
  { key: 'packages', label: 'Packages', Component: PackagesReport },
  { key: 'item-finance', label: 'Item Finance', Component: ItemFinanceReport },
  { key: 'team', label: 'Team', Component: TeamReport },
  { key: 'reviews', label: 'Reviews', Component: ReviewsReport },
];

export default function Analytics() {
  const [active, setActive] = useState('pulse');
  const [preset, setPreset] = useState(30);
  const { moduleEnabled } = useIndustry();
  const revenueEnabled = moduleEnabled('/bookings') && moduleEnabled('/revenue');
  const params = useMemo(() => getDateRange(preset), [preset]);
  const periodLabel = DATE_PRESETS.find((p) => p.value === preset)?.label || '30 days';
  const visibleReports = useMemo(
    () => REPORTS.filter((report) => revenueEnabled || !report.requiresRevenue),
    [revenueEnabled]
  );

  useEffect(() => {
    if (!visibleReports.some((report) => report.key === active)) {
      setActive('pulse');
    }
  }, [active, visibleReports]);

  const current = visibleReports.find((r) => r.key === active) || visibleReports[0];
  const Active = current.Component;

  return (
    <div className="min-h-full bg-[#fbfaf8] p-4 sm:p-6 lg:p-8">
      {/* Toolbar — section nav + date range */}
      <div className="flex flex-col gap-3 border-b border-[#ece8e0] lg:flex-row lg:items-center lg:justify-between">
        <nav className="hide-scrollbar -mb-px flex gap-0.5 overflow-x-auto">
          {visibleReports.map((r) => {
            const on = active === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setActive(r.key)}
                className={`relative shrink-0 px-3.5 py-3 text-[13.5px] font-semibold transition ${on ? 'text-[#1c1916]' : 'text-[#a8a299] hover:text-[#6b655c]'}`}
              >
                {r.label}
                {on && <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] rounded-full bg-[#0f8a6b]" />}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-1.5 pb-3 lg:pb-0 lg:pl-4">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPreset(p.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${preset === p.value
                ? 'bg-[#1c1916] text-white shadow-sm'
                : 'border border-[#ece8e0] bg-white text-[#8a8278] hover:border-[#d9d4c8] hover:text-[#1c1916]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active report */}
      <main key={active} className="mt-6 page-enter">
        <Active params={params} periodLabel={periodLabel} revenueEnabled={revenueEnabled} />
      </main>
    </div>
  );
}
