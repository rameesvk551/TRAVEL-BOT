// FILE: mobile/src/features/insights/api.ts
//
// The three report screens map to three real analytics endpoints:
//   AnalyticsScreen     → GET /analytics/sales
//   CRMReportScreen     → GET /analytics/crm
//   CallingReportScreen → GET /analytics/calls   (tracked outbound/inbound call
//                          logs — NOT /missed-calls, which is the separate
//                          inbound-WhatsApp-call log with its own page.)
//
// Envelope: { success: true, data: ... }.
// Money: revenue amounts are integer PAISE.
//
// Postgres SUM()/COUNT() come back as strings over JSON, so the raw aggregate
// rows are coerced to numbers here — screens receive clean numeric types.

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export type RangeKey = '7D' | '30D' | '90D' | 'YTD';

export const RANGE_KEYS: RangeKey[] = ['7D', '30D', '90D', 'YTD'];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Every range is sent explicitly. The backend defaults to the last 30 days when
 * from/to are omitted, so an "All time" segment would silently be a 30-day lie.
 */
export function rangeParams(key: RangeKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);

  if (key === '7D') from.setDate(to.getDate() - 6);
  else if (key === '30D') from.setDate(to.getDate() - 29);
  else if (key === '90D') from.setDate(to.getDate() - 89);
  else from.setMonth(0, 1); // YTD → 1 Jan

  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Postgres aggregates arrive as strings. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Seconds → "4m 12s" / "45s" / "1h 05m". */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(num(seconds)));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${String(mins % 60).padStart(2, '0')}m`;
}

/**
 * Charts stay readable to ~7 categories. Keep the top N and fold the rest into
 * a single "Other" bar so the tail is represented, not dropped.
 */
export function foldTail<T>(
  rows: T[],
  topN: number,
  toDatum: (row: T) => { label: string; value: number },
): { label: string; value: number }[] {
  const data = rows.map(toDatum);
  if (data.length <= topN) return data;
  const head = data.slice(0, topN);
  const tail = data.slice(topN);
  const otherValue = tail.reduce((sum, d) => sum + d.value, 0);
  if (otherValue > 0) head.push({ label: 'Other', value: otherValue });
  return head;
}

// ---------------------------------------------------------------------------
// Sales — AnalyticsScreen
// ---------------------------------------------------------------------------

export interface RevenueDay {
  date: string;
  /** Paise. */
  revenue: number;
  count: number;
}

export interface RevenueDestination {
  destination: string;
  /** Paise. */
  revenue: number;
  bookingCount: number;
}

export interface SalesReport {
  /** Paise. */
  totalRevenue: number;
  prevRevenue: number;
  /** Percent vs the previous equal-length window; null when there is no baseline. */
  revenueChange: number | null;
  totalBookings: number;
  prevBookings: number;
  /** Percent vs the previous window; null when there is no baseline. */
  bookingsChange: number | null;
  /** Paise. */
  avgBookingValue: number;
  /** Paise — pending payments, all time. */
  outstanding: number;
  revenueByDay: RevenueDay[];
  revenueByDestination: RevenueDestination[];
}

export function useSalesReport(range: RangeKey) {
  return useQuery({
    queryKey: ['analytics', 'sales', range],
    queryFn: async (): Promise<SalesReport> => {
      const res = await api.get('/analytics/sales', { params: rangeParams(range) });
      const d = res.data.data ?? {};

      const totalBookings = num(d.totalBookings);
      const prevBookings = num(d.prevBookings);

      return {
        totalRevenue: num(d.totalRevenue),
        prevRevenue: num(d.prevRevenue),
        revenueChange: d.revenueChange == null ? null : num(d.revenueChange),
        totalBookings,
        prevBookings,
        bookingsChange:
          prevBookings > 0
            ? Math.round(((totalBookings - prevBookings) / prevBookings) * 1000) / 10
            : null,
        avgBookingValue: num(d.avgBookingValue),
        outstanding: num(d.outstanding),
        revenueByDay: (d.revenueByDay ?? []).map((r: any) => ({
          date: String(r.date),
          revenue: num(r.revenue),
          count: num(r.count),
        })),
        // Raw SQL → snake_case keys.
        revenueByDestination: (d.revenueByDestination ?? []).map((r: any) => ({
          destination: String(r.destination ?? 'Unknown'),
          revenue: num(r.revenue),
          bookingCount: num(r.booking_count),
        })),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// CRM — CRMReportScreen
// ---------------------------------------------------------------------------

export interface CrmCards {
  totalLeads: number;
  activeLeads: number;
  openDeals: number;
  won: number;
  /** Percent. */
  conversion: number;
  wonInRange: number;
  lostInRange: number;
  hot: number;
}

export interface FunnelStage {
  id: string;
  name: string;
  kind: 'OPEN' | 'WON' | 'LOST';
  count: number;
}

export interface MonthMetric {
  value: number;
  /** Percent vs last calendar month. */
  change: number;
}

export interface MonthAtGlance {
  thisMonthLabel: string;
  lastMonthLabel: string;
  newLeads: MonthMetric;
  won: MonthMetric;
  lost: MonthMetric;
}

export interface NeedsAttention {
  hot: number;
  overdue: number;
  stale: number;
}

export interface LeadSource {
  source: string;
  count: number;
}

export interface SmartSuggestion {
  leadId: string;
  name: string;
  daysSinceContact: number;
  priority: string;
  reason: string;
}

export interface CrmReport {
  cards: CrmCards;
  /** Ordered pipeline stages — render with BarChart variant="ordinal". */
  funnel: FunnelStage[];
  monthAtGlance: MonthAtGlance;
  needsAttention: NeedsAttention;
  topSources: LeadSource[];
  smartSuggestions: SmartSuggestion[];
}

export function useCrmReport(range: RangeKey) {
  return useQuery({
    queryKey: ['analytics', 'crm', range],
    queryFn: async (): Promise<CrmReport> => {
      const res = await api.get('/analytics/crm', { params: rangeParams(range) });
      const d = res.data.data ?? {};

      return {
        cards: d.cards,
        funnel: (d.funnel ?? []).map((s: any) => ({
          id: String(s.id),
          name: String(s.name),
          kind: s.kind,
          count: num(s.count),
        })),
        monthAtGlance: d.monthAtGlance,
        needsAttention: d.needsAttention,
        topSources: (d.topSources ?? []).map((s: any) => ({
          source: String(s.source ?? 'unknown'),
          count: num(s.count),
        })),
        smartSuggestions: d.smartSuggestions ?? [],
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Calling — CallingReportScreen
// ---------------------------------------------------------------------------

export interface CallKpis {
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  /** Percent. */
  answerRate: number;
  totalTalkSec: number;
  avgTalkSec: number;
  avgTimeToAnswerSec: number;
  recordedCalls: number;
  uniqueLeadsCalled: number;
}

export interface CallDeltas {
  /** Percent change vs the previous equal-length window. */
  totalCalls: number;
  /** Percentage-point change in answer rate. */
  answerRate: number;
}

export interface CallDay {
  date: string;
  total: number;
  connected: number;
  missed: number;
}

export interface CallStatusCount {
  /** Twilio call status — completed, no-answer, busy, failed, canceled… */
  status: string;
  count: number;
}

export interface CallAgentStat {
  agentId: string;
  name: string;
  total: number;
  connected: number;
  missed: number;
  /** Percent. */
  answerRate: number;
  avgTalkSec: number;
}

export interface BestWindow {
  /** Hour of day, 0-23. */
  hour: number;
  /** Percent. */
  connectRate: number;
  calls: number;
}

export interface CallingReport {
  kpis: CallKpis;
  deltas: CallDeltas;
  byDay: CallDay[];
  byStatus: CallStatusCount[];
  bestWindow: BestWindow | null;
  agentStats: CallAgentStat[];
}

export function useCallingReport(range: RangeKey) {
  return useQuery({
    queryKey: ['analytics', 'calls', range],
    queryFn: async (): Promise<CallingReport> => {
      const res = await api.get('/analytics/calls', { params: rangeParams(range) });
      const d = res.data.data ?? {};

      return {
        kpis: d.kpis,
        deltas: d.deltas,
        byDay: (d.byDay ?? []).map((r: any) => ({
          date: String(r.date),
          total: num(r.total),
          connected: num(r.connected),
          missed: num(r.missed),
        })),
        byStatus: (d.byStatus ?? []).map((r: any) => ({
          status: String(r.status ?? 'unknown'),
          count: num(r.count),
        })),
        bestWindow: d.bestWindow ?? null,
        agentStats: (d.agentStats ?? []).map((a: any) => ({
          agentId: String(a.agentId),
          name: String(a.name),
          total: num(a.total),
          connected: num(a.connected),
          missed: num(a.missed),
          answerRate: num(a.answerRate),
          avgTalkSec: num(a.avgTalkSec),
        })),
      };
    },
  });
}

/**
 * A Twilio call status genuinely means good/bad, so the status bar chart is the
 * one legitimate use of variant="status" here.
 */
export function callStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'no-answer' || s === 'no_answer' || s === 'busy') return 'warning';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'danger';
  return 'neutral';
}
