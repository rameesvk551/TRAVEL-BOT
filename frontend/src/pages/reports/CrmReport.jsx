// FILE: /frontend/src/pages/reports/CrmReport.jsx
//
// CRM dashboard — fully dynamic. Cards, configurable sales funnel, month-on-month
// movement, won/lost trend, source mix, action queues and an activity pulse all
// stream from GET /api/analytics/crm. Pipeline stages are agency-configurable via
// the "Manage stages" modal (GET/POST/PUT/DELETE /api/crm/pipeline-stages).

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  FireIcon, ExclamationTriangleIcon, ClockIcon, PhoneIcon, CalendarDaysIcon,
  ChatBubbleLeftRightIcon, PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon,
  ArrowUpIcon, ArrowDownIcon, Cog6ToothIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  SectionCard, Stat, StatCards, BarRow, Delta, Empty, ReportSkeleton, Note, Rank,
  channelMeta, fmtNum, fmtPct, BriefTooltip, axisTick, gridProps,
  INK, EMERALD, CLAY, GOLD, SLATE,
} from './reportKit';
import {
  useCrmReport, usePipelineStages, usePipelineStageMutations,
} from '../../hooks/useAnalytics';

const LEAD_STATUSES = [
  'JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY',
  'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAGE_SWATCHES = [SLATE, '#7c5a83', GOLD, '#c0703a', EMERALD, CLAY, '#3f9d82', '#9c8b6e'];

function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function timeAgo(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(value);
}

function timeOfDay(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

const ACTIVITY_META = {
  note: { Icon: PencilSquareIcon, label: 'Note', color: SLATE },
  call: { Icon: PhoneIcon, label: 'Call', color: EMERALD },
  followup: { Icon: ClockIcon, label: 'Follow-up', color: GOLD },
};

/* ───────────────────────── Manage-stages modal ───────────────────────── */

function StageModal({ onClose }) {
  const { data: res, isLoading } = usePipelineStages();
  const { create, update, remove, reorder } = usePipelineStageMutations();
  const stages = res?.data || [];
  const busy = create.isPending || update.isPending || remove.isPending || reorder.isPending;

  const move = (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorder.mutate(ids);
  };

  const toggleStatus = (stage, status) => {
    const has = stage.leadStatuses.includes(status);
    const leadStatuses = has
      ? stage.leadStatuses.filter((s) => s !== status)
      : [...stage.leadStatuses, status];
    update.mutate({ id: stage.id, body: { leadStatuses } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1c1916]/40 p-4 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div
        className="brief-card my-auto w-full max-w-2xl rounded-[20px] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ece8e0] px-6 py-5">
          <div>
            <h3 className="font-brief text-[19px] font-semibold tracking-[-0.01em] text-[#1c1916]">Pipeline stages</h3>
            <p className="mt-0.5 text-[13px] font-medium text-[#8a8278]">Rename, recolor, reorder and map lead statuses into each stage.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#a8a299] transition hover:bg-[#f1ede4] hover:text-[#1c1916]">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="py-8 text-center text-[13px] text-[#a8a299]">Loading…</p>
          ) : stages.length === 0 ? (
            <Empty message="No stages yet." height={120} />
          ) : (
            stages.map((s, i) => (
              <div key={s.id} className="rounded-[14px] border border-[#ece8e0] p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="text-[#bdb7ac] transition enabled:hover:text-[#1c1916] disabled:opacity-30">
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === stages.length - 1 || busy} className="text-[#bdb7ac] transition enabled:hover:text-[#1c1916] disabled:opacity-30">
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => update.mutate({ id: s.id, body: { color: e.target.value } })}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-[#ece8e0] bg-transparent p-0.5"
                    title="Stage color"
                  />
                  <input
                    defaultValue={s.name}
                    onBlur={(e) => e.target.value !== s.name && update.mutate({ id: s.id, body: { name: e.target.value } })}
                    className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1.5 text-[14px] font-semibold text-[#1c1916] transition hover:border-[#ece8e0] focus:border-[#d9d4c8] focus:outline-none"
                  />
                  <select
                    value={s.kind}
                    onChange={(e) => update.mutate({ id: s.id, body: { kind: e.target.value } })}
                    className="rounded-md border border-[#ece8e0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#6b655c] focus:outline-none"
                  >
                    <option value="OPEN">Open</option>
                    <option value="WON">Won</option>
                    <option value="LOST">Lost</option>
                  </select>
                  <button
                    onClick={() => remove.mutate(s.id)}
                    disabled={busy}
                    className="rounded-md p-1.5 text-[#bdb7ac] transition hover:bg-[#fbf2ee] hover:text-[#b4533a] disabled:opacity-30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 pl-[42px]">
                  {LEAD_STATUSES.map((status) => {
                    const on = s.leadStatuses.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => toggleStatus(s, status)}
                        disabled={busy}
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                          on
                            ? 'border-transparent text-white'
                            : 'border-[#ece8e0] bg-white text-[#a8a299] hover:border-[#d9d4c8] hover:text-[#6b655c]'
                        }`}
                        style={on ? { background: s.color } : undefined}
                      >
                        {status.replace(/_/g, ' ').toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#ece8e0] px-6 py-4">
          <button
            onClick={() => create.mutate({ name: 'New stage', color: STAGE_SWATCHES[stages.length % STAGE_SWATCHES.length] })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ece8e0] bg-[#fbfaf7] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#6b655c] transition hover:border-[#d9d4c8] hover:text-[#1c1916] disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" /> Add stage
          </button>
          <button onClick={onClose} className="rounded-full bg-[#1c1916] px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-[#000]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Small building blocks ───────────────────────── */

function AttentionChip({ Icon, label, count, tone }) {
  const tones = {
    critical: 'border-[#eccfc4] bg-[#fbf2ee] text-[#93412d]',
    warning: 'border-[#ece2c8] bg-[#fbf7ec] text-[#8a6418]',
    neutral: 'border-[#d8e0e8] bg-[#f4f6f8] text-[#46586a]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="nums rounded-full bg-white/70 px-1.5 text-[11px]">{fmtNum(count)}</span>
    </span>
  );
}

function ScheduleTile({ Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[#ece8e0] bg-[#fbfaf7] p-3.5">
      <div className="rounded-full p-2" style={{ background: `${color}1a`, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="nums font-brief text-[20px] font-semibold leading-none text-[#1c1916]">{fmtNum(value)}</div>
        <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#a8a299]">{label}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Main report ───────────────────────── */

export default function CrmReport({ params, periodLabel = 'period' }) {
  const { data: res, isLoading } = useCrmReport(params);
  const [showStages, setShowStages] = useState(false);
  const d = res?.data || {};

  const funnelMax = useMemo(() => Math.max(1, ...(d.funnel || []).map((s) => s.count)), [d.funnel]);
  const sourceTotal = useMemo(() => (d.topSources || []).reduce((a, b) => a + b.count, 0), [d.topSources]);
  const wonLostData = useMemo(
    () => (d.wonVsLost8w || []).map((r) => ({ week: shortDate(r.weekStart), Won: r.won, Lost: r.lost })),
    [d.wonVsLost8w],
  );
  const pulseData = useMemo(
    () => (d.activityPulse?.monthlyVolume || []).map((r) => ({ month: MONTHS[r.month - 1], events: r.events })),
    [d.activityPulse],
  );

  if (isLoading) return <ReportSkeleton />;

  const c = d.cards || {};
  const mag = d.monthAtGlance || {};
  const na = d.needsAttention || {};
  const sched = d.todaySchedule || {};
  const pulse = d.activityPulse || {};

  return (
    <div className="space-y-5 pb-10">
      {/* KPI band */}
      <StatCards
        items={[
          { label: 'Total Leads', value: fmtNum(c.totalLeads), sub: `${fmtNum(c.activeLeads)} active` },
          { label: 'Open Deals', value: fmtNum(c.openDeals), sub: 'in your pipeline' },
          { label: 'Won', value: fmtNum(c.won), sub: 'this month', accent: EMERALD },
          { label: 'Conversion', value: fmtPct(c.conversion, 1), sub: `${fmtNum(c.wonInRange)} won · ${fmtNum(c.lostInRange)} lost` },
          { label: 'Hot', value: fmtNum(c.hot), sub: 'high-intent & open', accent: c.hot > 0 ? CLAY : undefined },
        ]}
      />

      {/* Funnel + Month at a glance */}
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          eyebrow="Sales Funnel"
          title="Where your leads stand"
          description="Your configurable pipeline, this period"
          action={
            <button
              onClick={() => setShowStages(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ece8e0] bg-[#fbfaf7] px-3.5 py-1.5 text-[12px] font-semibold text-[#6b655c] transition hover:border-[#d9d4c8] hover:text-[#1c1916]"
            >
              <Cog6ToothIcon className="h-4 w-4" /> Manage stages
            </button>
          }
        >
          {(d.funnel || []).length === 0 || c.totalLeads === 0 ? (
            <Empty message="No leads in this period yet." height={180} />
          ) : (
            <div className="space-y-0.5">
              {d.funnel.map((s) => (
                <BarRow
                  key={s.id}
                  label={s.name}
                  value={fmtNum(s.count)}
                  pct={(s.count / funnelMax) * 100}
                  color={s.color}
                  meta={{ color: s.color }}
                  trailing={<span className="nums text-[11px] font-semibold text-[#a8a299]">{fmtPct(c.totalLeads ? (s.count / c.totalLeads) * 100 : 0)}</span>}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard eyebrow="Month at a Glance" title={mag.thisMonthLabel || 'This month'} description={mag.lastMonthLabel ? `vs ${mag.lastMonthLabel}` : undefined}>
          <div className="flex h-full flex-col justify-center divide-y divide-[#ece8e0]">
            {[
              { label: 'New Leads', obj: mag.newLeads, accent: INK },
              { label: 'Won', obj: mag.won, accent: EMERALD },
              { label: 'Lost', obj: mag.lost, accent: CLAY, invert: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3.5">
                <span className="text-[13px] font-semibold text-[#3a352e]">{row.label}</span>
                <div className="flex items-center gap-3">
                  <span className="nums text-[15px] font-bold" style={{ color: row.accent }}>{fmtNum(row.obj?.value || 0)}</span>
                  <Delta value={row.obj?.change} invert={row.invert} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Won vs Lost + Top sources */}
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" eyebrow="Last 8 weeks" title="Won vs Lost" description="Bucketed by close date">
          {wonLostData.every((r) => r.Won === 0 && r.Lost === 0) ? (
            <Empty message="No closed leads in the last 8 weeks yet." height={200} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={wonLostData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={4}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1ede4' }} content={<BriefTooltip />} />
                <Bar dataKey="Won" fill={EMERALD} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Lost" fill={CLAY} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard eyebrow="Top Sources" title="Where leads come from">
          {(d.topSources || []).length === 0 ? (
            <Empty message="No source data yet." height={200} />
          ) : (
            <div className="space-y-0.5">
              {d.topSources.slice(0, 7).map((s) => {
                const meta = channelMeta(s.source);
                return (
                  <BarRow
                    key={s.source}
                    label={meta.label}
                    value={fmtNum(s.count)}
                    pct={sourceTotal ? (s.count / sourceTotal) * 100 : 0}
                    color={meta.color}
                    meta={meta}
                  />
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Needs attention + Top performers */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard eyebrow="Needs Attention" title="Act on these today">
          <div className="flex flex-wrap gap-2">
            <AttentionChip Icon={FireIcon} label="Hot" count={na.hot || 0} tone="critical" />
            <AttentionChip Icon={ExclamationTriangleIcon} label="Overdue" count={na.overdue || 0} tone="warning" />
            <AttentionChip Icon={ClockIcon} label="Stale" count={na.stale || 0} tone="neutral" />
          </div>
          <div className="mt-4">
            {(na.hot || na.overdue || na.stale) ? (
              <Note tone={na.overdue ? 'critical' : na.hot ? 'warning' : 'neutral'}>
                {na.overdue ? `${fmtNum(na.overdue)} follow-up${na.overdue === 1 ? '' : 's'} overdue. ` : ''}
                {na.hot ? `${fmtNum(na.hot)} hot lead${na.hot === 1 ? '' : 's'} waiting. ` : ''}
                {na.stale ? `${fmtNum(na.stale)} lead${na.stale === 1 ? '' : 's'} gone quiet for a week.` : ''}
              </Note>
            ) : (
              <Note tone="positive" title="All clear">No overdue follow-ups or stale leads. Nicely on top of it.</Note>
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Top Performers" title="Closed-won · last 30 days">
          {(d.topPerformers || []).length === 0 ? (
            <Empty message="No closed leads in the recent window." height={160} />
          ) : (
            <div className="space-y-1">
              {d.topPerformers.map((p, i) => (
                <div key={p.agentId} className="flex items-center gap-3 py-2">
                  <Rank n={i + 1} />
                  <span className="flex-1 truncate text-[14px] font-semibold text-[#1c1916]">{p.name}</span>
                  <span className="nums text-[14px] font-bold text-[#0f8a6b]">{fmtNum(p.won)}</span>
                  <span className="text-[12px] font-medium text-[#a8a299]">won</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Today's schedule + Recent activity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard eyebrow="Today" title="Your schedule">
          <div className="grid grid-cols-3 gap-3">
            <ScheduleTile Icon={PhoneIcon} value={sched.calls || 0} label="Calls" color={EMERALD} />
            <ScheduleTile Icon={CalendarDaysIcon} value={sched.followUps || 0} label="Follow-ups" color={SLATE} />
            <ScheduleTile Icon={ExclamationTriangleIcon} value={sched.overdue || 0} label="Overdue" color={GOLD} />
          </div>
          <div className="mt-4 space-y-1">
            {(sched.items || []).length === 0 ? (
              <Empty message="Nothing scheduled today." height={90} />
            ) : (
              sched.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#ece8e0] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[#1c1916]">{it.who}</p>
                    {it.note && <p className="truncate text-[12px] text-[#8a8278]">{it.note}</p>}
                  </div>
                  <span className="nums shrink-0 text-[12px] font-semibold text-[#a8a299]">{timeOfDay(it.at)}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Recent Activity" title="Latest CRM events">
          {(d.recentActivity || []).length === 0 ? (
            <Empty message="No recent activity yet." height={160} />
          ) : (
            <div className="space-y-3">
              {d.recentActivity.map((a, i) => {
                const meta = ACTIVITY_META[a.type] || ACTIVITY_META.note;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full p-1.5" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <meta.Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#3a352e]">
                        <span className="font-semibold text-[#1c1916]">{meta.label}</span>
                        {' · '}{a.who}
                      </p>
                      {a.detail && <p className="truncate text-[12px] text-[#8a8278]">{a.detail}</p>}
                    </div>
                    <span className="nums shrink-0 text-[11.5px] font-medium text-[#a8a299]">{timeAgo(a.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Activity pulse */}
      <SectionCard
        eyebrow="Activity Pulse"
        title={`Monthly volume · ${pulse.year || ''}`}
        description={pulse.bestWeekday ? `Busiest day: ${pulse.bestWeekday}` : undefined}
        action={<Stat label="Total events" value={fmtNum(pulse.totalEvents || 0)} variant="plain" className="text-right" />}
      >
        {(pulse.totalEvents || 0) === 0 ? (
          <Empty message={`No activity recorded in ${pulse.year || 'this year'}.`} height={160} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pulseData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1ede4' }} content={<BriefTooltip />} />
              <Bar dataKey="events" radius={[4, 4, 0, 0]} maxBarSize={34}>
                {pulseData.map((entry, i) => (
                  <Cell key={i} fill={entry.events === Math.max(...pulseData.map((p) => p.events)) ? EMERALD : '#d9d4c8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Smart suggestions */}
      <SectionCard
        eyebrow="Smart Suggestions"
        title="Leads worth your next move"
        action={<span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#a8a299]"><SparklesIcon className="h-4 w-4" /> auto-ranked</span>}
      >
        {(d.smartSuggestions || []).length === 0 ? (
          <Empty message="No leads need a nudge right now." height={120} />
        ) : (
          <div className="space-y-2">
            {d.smartSuggestions.map((s) => (
              <div key={s.leadId} className="flex items-center justify-between gap-4 rounded-[14px] border border-[#ece8e0] p-3.5 transition hover:border-[#d9d4c8]">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-[#fbf7ec] p-1.5 text-[#8a6418]">
                    <ClockIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${s.priority === 'High' ? 'text-[#b4533a]' : 'text-[#8a6418]'}`}>{s.priority}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a8a299]">Score {s.leadScore}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[13.5px] font-semibold text-[#1c1916]">{s.name}</p>
                    <p className="truncate text-[12px] text-[#8a8278]">{s.reason}</p>
                  </div>
                </div>
                <ChatBubbleLeftRightIcon className="h-5 w-5 shrink-0 text-[#bdb7ac]" />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {showStages && <StageModal onClose={() => setShowStages(false)} />}
    </div>
  );
}
