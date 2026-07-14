// FILE: mobile/src/features/home/api.ts
// Real analytics endpoints — no mock fallbacks. If the dashboard call fails the
// screen shows ErrorState; it never renders invented numbers.
//
// Two endpoints back the dashboard because neither alone covers it:
//   GET /analytics/crm?from&to    -> lead counts, funnel, attention, suggestions
//   GET /analytics/sales?from&to  -> revenue total + trend + booking counts
// Both take the period as from/to, which is what makes the 7/30/90 control real.
//
// GET /analytics/summary is deliberately NOT used: it takes no period argument
// (getSummary(agencyId) ignores req.query), so it cannot drive the segmented control.
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

/* ------------------------------------------------------------------ types -- */

export type DashboardPeriod = 7 | 30 | 90;

export interface PipelineStageCount {
  id: string;
  name: string;
  count: number;
  kind: 'OPEN' | 'WON' | 'LOST';
}

export interface AttentionItem {
  leadId: string;
  name: string;
  daysSinceContact: number;
  leadScore: number;
  priority: 'High' | 'Medium';
  reason: string;
}

export interface DashboardSummary {
  leads: {
    total: number;
    open: number;
    won: number;
    lost: number;
    /** Percent, already rounded by the backend. */
    conversion: number;
    hot: number;
  };
  revenue: {
    /** Paise. */
    total: number;
    changePct: number | null;
    bookings: number;
    bookingsChangePct: number | null;
    avgBookingValue: number;
    outstanding: number;
  };
  /** Paid payments per day across the period. Amounts in paise. */
  revenueTrend: { date: string; amount: number }[];
  /** The agency's configured funnel, in stage order. */
  pipeline: PipelineStageCount[];
  attentionCounts: { hot: number; overdue: number; stale: number };
  attentionItems: AttentionItem[];
}

export interface Departure {
  id: string;
  bookingRef: string | null;
  customerId: string | null;
  customerName: string;
  itemName: string;
  travelDate: string | null;
  status: string;
}

/* ---------------------------------------------------------------- helpers -- */

/** The API's date filters are inclusive day bounds; send plain YYYY-MM-DD. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodRange(days: DashboardPeriod) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
}

/** Postgres SUM/COUNT come back as strings over the wire. */
function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/* ---------------------------------------------------------------- queries -- */

export function useDashboardSummary(days: DashboardPeriod) {
  const { from, to } = periodRange(days);

  return useQuery({
    // `days` is in the key, so changing the segmented control refetches.
    queryKey: ['dashboard', 'summary', days],
    queryFn: async (): Promise<DashboardSummary> => {
      const [crmRes, salesRes] = await Promise.all([
        api.get('/analytics/crm', { params: { from, to } }),
        api.get('/analytics/sales', { params: { from, to } }),
      ]);
      const crm = crmRes.data.data;
      const sales = salesRes.data.data;

      return {
        leads: {
          total: num(crm.cards?.totalLeads),
          open: num(crm.cards?.openDeals),
          won: num(crm.cards?.wonInRange),
          lost: num(crm.cards?.lostInRange),
          conversion: num(crm.cards?.conversion),
          hot: num(crm.cards?.hot),
        },
        revenue: {
          total: num(sales.totalRevenue),
          changePct: sales.revenueChange ?? null,
          bookings: num(sales.totalBookings),
          bookingsChangePct: pctChange(num(sales.totalBookings), num(sales.prevBookings)),
          avgBookingValue: num(sales.avgBookingValue),
          outstanding: num(sales.outstanding),
        },
        revenueTrend: (sales.revenueByDay ?? []).map((row: any) => ({
          date: String(row.date),
          amount: num(row.revenue),
        })),
        pipeline: (crm.funnel ?? []).map((stage: any) => ({
          id: stage.id,
          name: stage.name,
          count: num(stage.count),
          kind: stage.kind,
        })),
        attentionCounts: {
          hot: num(crm.needsAttention?.hot),
          overdue: num(crm.needsAttention?.overdue),
          stale: num(crm.needsAttention?.stale),
        },
        attentionItems: (crm.smartSuggestions ?? []).map((item: any) => ({
          leadId: item.leadId,
          name: item.name,
          daysSinceContact: num(item.daysSinceContact),
          leadScore: num(item.leadScore),
          priority: item.priority,
          reason: item.reason,
        })),
      };
    },
  });
}

/**
 * Bookings whose travelDate is today. Separate from the dashboard query because
 * it needs the bookings permission, not the analytics one — an agent without it
 * should still see the rest of the dashboard.
 */
export function useTodaysDepartures() {
  const today = isoDay(new Date());

  return useQuery({
    queryKey: ['dashboard', 'departures', today],
    queryFn: async (): Promise<Departure[]> => {
      const res = await api.get('/bookings', {
        params: { dateFrom: today, dateTo: today, pageSize: 10 },
      });
      const bookings = res.data.data?.data ?? [];
      return bookings.map((booking: any) => ({
        id: booking.id,
        bookingRef: booking.bookingRef ?? null,
        customerId: booking.customer?.id ?? null,
        customerName: booking.customer?.name || booking.customer?.phone || 'Customer',
        itemName:
          booking.customItemName ||
          booking.package?.name ||
          booking.property?.name ||
          booking.cruise?.name ||
          booking.service?.name ||
          booking.visa?.country ||
          booking.itemType,
        travelDate: booking.travelDate ?? null,
        status: booking.status,
      }));
    },
  });
}
