import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { formatCurrency } from '../utils/formatters';

function Metric({ label, value }) {
  return (
    <div className="rounded-[12px] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

export default function Analytics() {
  const { data, isLoading } = useAnalyticsSummary();
  const analytics = data?.data || {};
  const leadsByStatus = analytics.leadsByStatus || [];
  const topPackages = analytics.topPackages || [];
  const revenueByMonth = analytics.revenueByMonth || [];
  const maxRevenue = Math.max(...revenueByMonth.map((item) => Number(item.revenue) || 0), 1);

  return (
    <div className="w-full space-y-4">
      <section className="border-b border-slate-200 pb-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Analytics</h1>
        <p className="text-sm text-slate-500">Operational reporting for demand, conversion, and revenue.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Leads" value={analytics.totalLeads || 0} />
        <Metric label="Conversion Rate" value={`${analytics.conversionRate || 0}%`} />
        <Metric label="Confirmed Bookings" value={analytics.confirmedBookings || 0} />
        <Metric label="Revenue" value={formatCurrency(analytics.totalRevenue || 0)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[12px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Lead Status Breakdown</h2>
          </div>
          <div className="space-y-3 px-4 py-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-8 animate-pulse rounded bg-slate-100" />)
            ) : leadsByStatus.length === 0 ? (
              <p className="text-sm text-slate-500">No status data yet.</p>
            ) : (
              leadsByStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-[10px] bg-slate-50 px-3 py-2.5">
                  <span className="text-sm text-slate-600">{item.status}</span>
                  <span className="text-sm font-medium text-slate-900">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[12px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Revenue by Month</h2>
          </div>
          <div className="flex h-72 items-end gap-4 px-4 py-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex-1 animate-pulse rounded-t-[8px] bg-slate-100" style={{ height: `${40 + index * 20}px` }} />)
            ) : revenueByMonth.length === 0 ? (
              <div className="flex h-full flex-1 items-center justify-center text-sm text-slate-500">No revenue data yet.</div>
            ) : (
              revenueByMonth.map((item) => {
                const height = Math.max(28, Math.round(((Number(item.revenue) || 0) / maxRevenue) * 220));
                const month = new Date(item.month).toLocaleDateString('en-IN', { month: 'short' });

                return (
                  <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t-[8px] bg-[#0f766e]" style={{ height }} />
                    <span className="text-xs text-slate-500">{month}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Top Packages</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {topPackages.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No package performance data yet.</div>
          ) : (
            topPackages.map((item, index) => (
              <div key={`${item.package?.id || index}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.package?.name || 'Unnamed package'}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatCurrency(item.package?.basePrice || 0)} per traveler</p>
                </div>
                <p className="text-sm font-medium text-slate-700">{item.bookingCount} bookings</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
