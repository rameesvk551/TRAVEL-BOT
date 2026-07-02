// FILE: /frontend/src/pages/reports/CallingReport.jsx
//
// Calling report — the all-in-one telephony brief. KPIs (volume, answer rate,
// talk time), daily volume trend, status mix, best-call-window, a per-staff
// leaderboard and a per-lead table with inline recording playback, plus
// rule-based recommendations. Streams from GET /api/analytics/calls.
// Staff-wise and lead-wise filters; non-admins are scoped to their own calls.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  PhoneIcon, PhoneArrowUpRightIcon, PhoneXMarkIcon, ClockIcon,
  MicrophoneIcon, SparklesIcon, PlayIcon,
} from '@heroicons/react/24/outline';
import {
  SectionCard, StatCards, BarRow, Empty, ReportSkeleton, Note, Rank,
  fmtNum, fmtPct, BriefTooltip, axisTick, gridProps,
  INK, EMERALD, CLAY, GOLD, SLATE,
} from './reportKit';
import { useCallingReport } from '../../hooks/useAnalytics';
import { callsApi } from '../../api/callsApi';

/* ───────────────────────── helpers ───────────────────────── */

function fmtClock(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  if (!mins) return `${secs}s`;
  return `${mins}m ${pad(secs)}s`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

function statusLabel(status = '') {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// Color a status by outcome.
function statusColor(status) {
  if (status === 'completed' || status === 'in_progress' || status === 'agent_answered') return EMERALD;
  if (status === 'no_answer' || status === 'busy' || status === 'failed' || status === 'canceled') return CLAY;
  return SLATE;
}

const SEVERITY_TONE = {
  critical: 'critical',
  warning: 'warning',
  positive: 'positive',
  neutral: 'neutral',
};

/* ───────────────────────── recording playback ───────────────────────── */

function RecordingButton({ callId }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const blob = await callsApi.recording(callId);
      setAudioUrl(URL.createObjectURL(blob));
    } catch {
      setError('Unavailable');
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) return <audio controls src={audioUrl} className="h-8 w-44" />;

  return (
    <button
      type="button"
      onClick={load}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-full border border-[#ece8e0] bg-[#fbfaf7] px-2.5 py-1 text-[11.5px] font-semibold text-[#6b655c] transition hover:border-[#d9d4c8] hover:text-[#1c1916] disabled:opacity-60"
    >
      <PlayIcon className="h-3.5 w-3.5" />
      {loading ? '…' : error || 'Play'}
    </button>
  );
}

/* ───────────────────────── main report ───────────────────────── */

export default function CallingReport({ params }) {
  const [agentId, setAgentId] = useState('all');
  const [leadId, setLeadId] = useState('all');

  const queryParams = useMemo(
    () => ({ ...params, agentId, leadId }),
    [params, agentId, leadId],
  );
  const { data: res, isLoading } = useCallingReport(queryParams);
  const d = res?.data || {};

  const k = d.kpis || {};
  const staff = d.staff || [];
  const leadStats = d.leadStats || [];
  const agentStats = d.agentStats || [];
  const suggestions = d.suggestions || [];

  const trendData = useMemo(
    () => (d.byDay || []).map((r) => ({ day: shortDate(r.date), Connected: r.connected, Missed: r.missed })),
    [d.byDay],
  );
  const hourData = useMemo(
    () => (d.byHour || []).map((r) => ({
      label: `${pad(r.hour)}h`,
      total: r.total,
      connectPct: r.total ? Math.round((r.connected / r.total) * 100) : 0,
    })),
    [d.byHour],
  );
  const statusTotal = useMemo(
    () => (d.byStatus || []).reduce((a, b) => a + b.count, 0),
    [d.byStatus],
  );
  const agentMax = useMemo(
    () => Math.max(1, ...agentStats.map((a) => a.total)),
    [agentStats],
  );

  if (isLoading) return <ReportSkeleton />;

  const hasFilters = staff.length > 1 || leadStats.length > 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Filters */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {staff.length > 1 && (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-full border border-[#ece8e0] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#6b655c] focus:border-[#d9d4c8] focus:outline-none"
            >
              <option value="all">All staff</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {leadStats.length > 0 && (
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="max-w-[240px] rounded-full border border-[#ece8e0] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#6b655c] focus:border-[#d9d4c8] focus:outline-none"
            >
              <option value="all">All leads</option>
              {leadStats.map((l) => (
                <option key={l.leadId} value={l.leadId}>{l.customerName} ({l.total})</option>
              ))}
            </select>
          )}
          {(agentId !== 'all' || leadId !== 'all') && (
            <button
              onClick={() => { setAgentId('all'); setLeadId('all'); }}
              className="text-[12.5px] font-semibold text-[#a8a299] underline-offset-2 hover:text-[#1c1916] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* KPI band */}
      <StatCards
        items={[
          { label: 'Total Calls', value: fmtNum(k.totalCalls), delta: d.deltas?.totalCalls, sub: `${fmtNum(k.uniqueLeadsCalled)} leads` },
          { label: 'Answer Rate', value: fmtPct(k.answerRate, 1), delta: d.deltas?.answerRate, sub: `${fmtNum(k.connectedCalls)} connected`, accent: EMERALD },
          { label: 'Missed', value: fmtNum(k.missedCalls), sub: 'no-answer / busy / failed', accent: k.missedCalls > 0 ? CLAY : undefined },
          { label: 'Avg Talk Time', value: fmtClock(k.avgTalkSec), sub: `${fmtClock(k.totalTalkSec)} total` },
          { label: 'Avg Pickup', value: fmtClock(k.avgTimeToAnswerSec), sub: 'time to answer' },
          { label: 'Recorded', value: fmtNum(k.recordedCalls), sub: 'calls with audio', accent: GOLD },
        ]}
      />

      {/* Recommendations */}
      <SectionCard
        eyebrow="Recommendations"
        title="What to do next"
        action={<span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#a8a299]"><SparklesIcon className="h-4 w-4" /> auto-generated</span>}
      >
        {suggestions.length === 0 ? (
          <Empty message="No recommendations right now — calling looks healthy." height={120} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((s) => (
              <Note key={s.id} tone={SEVERITY_TONE[s.severity] || 'neutral'} title={s.title}>
                {s.detail}
              </Note>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Volume trend + status mix */}
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" eyebrow="Call Volume" title="Connected vs missed" description="By day, this period">
          {trendData.every((r) => r.Connected === 0 && r.Missed === 0) ? (
            <Empty message="No calls in this period yet." height={220} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1ede4' }} content={<BriefTooltip />} />
                <Bar dataKey="Connected" stackId="c" fill={EMERALD} radius={[0, 0, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Missed" stackId="c" fill={CLAY} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard eyebrow="Outcomes" title="Status mix">
          {(d.byStatus || []).length === 0 ? (
            <Empty message="No call outcomes yet." height={200} />
          ) : (
            <div className="space-y-0.5">
              {d.byStatus.map((s) => (
                <BarRow
                  key={s.status}
                  label={statusLabel(s.status)}
                  value={fmtNum(s.count)}
                  pct={statusTotal ? (s.count / statusTotal) * 100 : 0}
                  color={statusColor(s.status)}
                  meta={{ color: statusColor(s.status) }}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Best call window */}
      <SectionCard
        eyebrow="Best Call Window"
        title="When calls connect"
        description={d.bestWindow ? `Peak: ${pad(d.bestWindow.hour)}:00–${pad((d.bestWindow.hour + 1) % 24)}:00 · ${d.bestWindow.connectRate}% connect` : 'Connect rate by hour of day'}
      >
        {hourData.every((r) => r.total === 0) ? (
          <Empty message="Not enough calls to find a pattern yet." height={180} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} unit="%" />
              <Tooltip cursor={{ fill: '#f1ede4' }} content={<BriefTooltip formatter={(v) => `${v}%`} />} />
              <Bar dataKey="connectPct" name="Connect rate" radius={[4, 4, 0, 0]} maxBarSize={20}>
                {hourData.map((entry, i) => (
                  <Cell key={i} fill={d.bestWindow && entry.label === `${pad(d.bestWindow.hour)}h` ? EMERALD : '#d9d4c8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Staff leaderboard */}
      {agentStats.length > 1 && (
        <SectionCard eyebrow="Staff" title="Calling leaderboard" description="Ranked by call volume">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-[#ece8e0] text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 pr-3">Staff</th>
                  <th className="py-2.5 pr-3 text-right">Calls</th>
                  <th className="py-2.5 pr-3 text-right">Connected</th>
                  <th className="py-2.5 pr-3 text-right">Answer %</th>
                  <th className="py-2.5 pr-3 text-right">Avg Talk</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a, i) => (
                  <tr key={a.agentId} className="border-b border-[#f3efe7] last:border-0">
                    <td className="py-2.5 pr-3"><Rank n={i + 1} /></td>
                    <td className="py-2.5 pr-3 text-[13.5px] font-semibold text-[#1c1916]">{a.name}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] text-[#3a352e]">{fmtNum(a.total)}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] text-[#3a352e]">{fmtNum(a.connected)}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] font-bold" style={{ color: a.answerRate >= 50 ? EMERALD : CLAY }}>{fmtPct(a.answerRate, 0)}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] text-[#3a352e]">{fmtClock(a.avgTalkSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Lead-wise call activity */}
      <SectionCard eyebrow="Leads" title="Call activity by lead" description="Most-called leads first">
        {leadStats.length === 0 ? (
          <Empty message="No leads have been called in this period." height={160} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-[#ece8e0] text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">Lead</th>
                  <th className="py-2.5 pr-3 text-right">Calls</th>
                  <th className="py-2.5 pr-3 text-right">Connected</th>
                  <th className="py-2.5 pr-3 text-right">Missed</th>
                  <th className="py-2.5 pr-3">Last Call</th>
                  <th className="py-2.5 pr-3">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {leadStats.slice(0, 40).map((l) => (
                  <tr key={l.leadId} className="border-b border-[#f3efe7] last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="text-[13.5px] font-semibold text-[#1c1916]">{l.customerName}</div>
                      <div className="text-[11.5px] text-[#a8a299]">{l.customerPhone}</div>
                    </td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] text-[#3a352e]">{fmtNum(l.total)}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] font-semibold text-[#0f8a6b]">{fmtNum(l.connected)}</td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] font-semibold" style={{ color: l.missed > 0 ? CLAY : '#a8a299' }}>{fmtNum(l.missed)}</td>
                    <td className="py-2.5 pr-3 text-[12.5px] text-[#6b655c]">{dateTime(l.lastCallAt)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: statusColor(l.lastStatus) }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: statusColor(l.lastStatus) }} />
                        {statusLabel(l.lastStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Recent call log with recordings */}
      <SectionCard eyebrow="Call Log" title="Recent calls" description="Latest 50 · play recordings inline">
        {(d.recentCalls || []).length === 0 ? (
          <Empty message="No calls logged in this period." height={160} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-[#ece8e0] text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#a8a299]">
                  <th className="py-2.5 pr-3">When</th>
                  <th className="py-2.5 pr-3">Staff</th>
                  <th className="py-2.5 pr-3">Customer</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3 text-right">Duration</th>
                  <th className="py-2.5 pr-3">Recording</th>
                </tr>
              </thead>
              <tbody>
                {d.recentCalls.map((c) => (
                  <tr key={c.id} className="border-b border-[#f3efe7] last:border-0">
                    <td className="py-2.5 pr-3 text-[12.5px] text-[#6b655c]">{dateTime(c.startedAt)}</td>
                    <td className="py-2.5 pr-3 text-[13px] font-semibold text-[#1c1916]">{c.agentName || '—'}</td>
                    <td className="py-2.5 pr-3 text-[13px] text-[#3a352e]">{c.customerName || c.customerPhone}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: statusColor(c.status) }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: statusColor(c.status) }} />
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="nums py-2.5 pr-3 text-right text-[13px] text-[#3a352e]">{fmtClock(c.durationSeconds)}</td>
                    <td className="py-2.5 pr-3">{c.hasRecording ? <RecordingButton callId={c.id} /> : <span className="text-[12px] text-[#bdb7ac]">—</span>}</td>
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
