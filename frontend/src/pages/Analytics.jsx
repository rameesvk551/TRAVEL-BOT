// FILE: /frontend/src/pages/Analytics.jsx

import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { formatCurrency } from '../utils/formatters';
import StatsCard from '../components/StatsCard';
import {
  UserGroupIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function Analytics() {
  const { data, isLoading } = useAnalyticsSummary();
  const analytics = data?.data || {};

  const leadsByStatus = analytics.leadsByStatus || [];
  const topPackages = analytics.topPackages || [];
  const revenueByMonth = analytics.revenueByMonth || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Leads" value={analytics.totalLeads || 0} icon={UserGroupIcon} color="blue" />
        <StatsCard title="Conversion Rate" value={`${analytics.conversionRate || 0}%`} icon={ArrowTrendingUpIcon} color="green" />
        <StatsCard title="Total Revenue" value={formatCurrency(analytics.totalRevenue || 0)} icon={BanknotesIcon} color="purple" />
        <StatsCard title="Confirmed Bookings" value={analytics.confirmedBookings || 0} icon={CalendarDaysIcon} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Status */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-brand-400" />
            Leads by Status
          </h3>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface-700/30 rounded animate-pulse" />
              ))
            ) : leadsByStatus.length === 0 ? (
              <p className="text-surface-500 text-sm">No data yet</p>
            ) : (
              leadsByStatus.map((item) => {
                const max = Math.max(...leadsByStatus.map((l) => parseInt(l.count) || 0));
                const pct = max > 0 ? (parseInt(item.count) / max) * 100 : 0;
                return (
                  <div key={item.status} className="flex items-center gap-3">
                    <span className="text-xs text-surface-400 w-24">{item.status}</span>
                    <div className="flex-1 bg-surface-800/50 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">{item.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Packages */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">🏆 Top Packages</h3>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-surface-700/30 rounded animate-pulse" />
              ))
            ) : topPackages.length === 0 ? (
              <p className="text-surface-500 text-sm">No bookings yet</p>
            ) : (
              topPackages.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-surface-700/20 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm text-white">{item.package?.name || 'Unknown'}</p>
                      <p className="text-xs text-surface-400">{formatCurrency(item.package?.basePrice || 0)}/person</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-brand-400">{item.bookingCount} bookings</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Revenue by Month */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4">📈 Revenue (Last 6 Months)</h3>
          <div className="flex items-end gap-4 h-48">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 bg-surface-700/30 rounded-t animate-pulse" style={{ height: `${30 + i * 15}%` }} />
              ))
            ) : revenueByMonth.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">No revenue data</div>
            ) : (
              revenueByMonth.map((item, i) => {
                const maxRev = Math.max(...revenueByMonth.map((r) => parseInt(r.revenue) || 0));
                const heightPct = maxRev > 0 ? (parseInt(item.revenue) / maxRev) * 100 : 10;
                const date = new Date(item.month);
                const monthLabel = date.toLocaleDateString('en', { month: 'short' });

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] text-surface-400">{formatCurrency(parseInt(item.revenue))}</span>
                    <div
                      className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t transition-all duration-700 hover:from-brand-500 hover:to-brand-300"
                      style={{ height: `${Math.max(heightPct, 5)}%` }}
                    />
                    <span className="text-xs text-surface-500">{monthLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
