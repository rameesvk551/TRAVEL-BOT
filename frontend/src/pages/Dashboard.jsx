import { Link } from 'react-router-dom';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { useLiveMessages } from '../hooks/useMessages';
import { useBookings } from '../hooks/useBookings';
import { formatDate, formatTime, timeAgo, truncate } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';

function MetricCard({ label, value, note }) {
  return (
    <div className="rounded-[12px] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function statusCount(leadsByStatus, key) {
  return Number(leadsByStatus?.find((item) => item.status === key)?.count || 0);
}

export default function Dashboard() {
  const { data: analyticsResponse } = useAnalyticsSummary();
  const { data: liveResponse } = useLiveMessages();
  const { data: bookingsResponse } = useBookings({ pageSize: 6 });

  const analytics = analyticsResponse?.data || {};
  const liveMessages = liveResponse?.data || [];
  const bookings = bookingsResponse?.data?.data || [];
  const leadsByStatus = analytics.leadsByStatus || [];

  return (
    <div className="w-full space-y-4">
      <section className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Dashboard</h1>
        <p className="text-sm text-slate-500">Daily operating view for live conversations, pipeline movement, and upcoming departures.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="New Leads" value={analytics.newLeadsToday || 0} note="Created today" />
        <MetricCard label="Conversion" value={`${analytics.conversionRate || 0}%`} note="Lead to booking" />
        <MetricCard label="Confirmed Bookings" value={analytics.confirmedBookings || 0} note="Active departures" />
        <MetricCard label="Revenue" value={`Rs ${(analytics.totalRevenue || 0) / 100 >= 1 ? ((analytics.totalRevenue || 0) / 100).toLocaleString('en-IN') : '0'}`} note="Total confirmed" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[12px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Recent Conversations</h2>
              <p className="text-xs text-slate-500">Latest inbound WhatsApp messages</p>
            </div>
            <Link to="/leads" className="text-sm font-medium text-[#0f766e]">Open inbox</Link>
          </div>

          <div className="divide-y divide-slate-100">
            {liveMessages.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500">No recent inbound messages.</div>
            ) : (
              liveMessages.slice(0, 6).map((message) => (
                <div key={message.id} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_90px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{message.customer?.name || 'Guest lead'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{timeAgo(message.timestamp)}</p>
                  </div>
                  <p className="truncate text-sm text-slate-600">{truncate(message.content, 110)}</p>
                  <p className="text-right text-xs text-slate-400">{formatTime(message.timestamp)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[12px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">Pipeline Snapshot</h2>
            <p className="text-xs text-slate-500">Current lead distribution</p>
          </div>

          <div className="space-y-3 px-4 py-4">
            {[
              ['NEW', 'New inquiry'],
              ['CONTACTED', 'Qualification'],
              ['QUOTED', 'Proposal sent'],
              ['NEGOTIATING', 'Negotiating'],
              ['BOOKED', 'Booked'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-[10px] bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-600">{label}</span>
                <span className={`badge ${getStatusTone(key)}`}>{statusCount(leadsByStatus, key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Upcoming Departures</h2>
            <p className="text-xs text-slate-500">Bookings ordered by travel date</p>
          </div>
          <Link to="/payments" className="text-sm font-medium text-[#0f766e]">View payments</Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Traveler', 'Trip', 'Travel date', 'Status'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-sm text-slate-500">No upcoming bookings found.</td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{booking.customer?.name || booking.bookingRef}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{booking.package?.name || 'Custom itinerary'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(booking.travelDate)}</td>
                    <td className="px-4 py-3"><span className={`badge ${getStatusTone(booking.status)}`}>{booking.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
