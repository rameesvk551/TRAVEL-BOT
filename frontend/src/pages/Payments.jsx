import { useQuery } from '@tanstack/react-query';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import client from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import PaymentBadge from '../components/PaymentBadge';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';

export default function Payments() {
  const { data, isLoading } = useQuery({
    queryKey: ['all-bookings-for-payments'],
    queryFn: () => client.get('/bookings', { params: { pageSize: 100 } }).then((response) => response.data),
  });

  const bookings = data?.data?.data || [];

  return (
    <div className="w-full space-y-5">
      <section>
        <p className="eyebrow">Collections</p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">Payments</h1>
        <p className="mt-2 text-sm text-slate-500">Track deposits, balances, and payment status across every active booking.</p>
      </section>

      <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_22px_70px_-48px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-extrabold text-slate-950">Payment overview</h2>
        </div>

        <div className="mobile-card-list p-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="mobile-record-card">
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((__, cell) => <div key={cell} className="h-10 animate-pulse rounded bg-slate-100" />)}
                </div>
              </div>
            ))
          ) : bookings.length === 0 ? (
            <div className="mobile-record-card text-center text-sm text-slate-500">
              <CreditCardIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              No payment records yet.
            </div>
          ) : (
            bookings.map((booking) => (
              <MobileRecordCard
                key={booking.id}
                title={booking.bookingRef}
                subtitle={booking.customer?.name || 'Traveler'}
                badge={<PaymentBadge status={booking.status} />}
              >
                <MobileField label="Total" value={formatCurrency(booking.totalAmount)} />
                <MobileField label="Paid" value={formatCurrency(booking.advancePaid)} />
                <MobileField label="Balance" value={formatCurrency(booking.totalAmount - booking.advancePaid)} />
                <MobileField label="Travel" value={formatDate(booking.travelDate)} />
              </MobileRecordCard>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50/80">
              <tr>
                {['Booking', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Travel'].map((heading) => (
                  <th key={heading} className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, row) => (
                  <tr key={row} className="border-t border-slate-100">
                    {Array.from({ length: 7 }).map((_, cell) => (
                      <td key={cell} className="px-6 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">
                    <CreditCardIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    No payment records yet.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-bold text-slate-950">{booking.bookingRef}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{booking.customer?.name || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{formatCurrency(booking.totalAmount)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#2d2d2d]">{formatCurrency(booking.advancePaid)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-amber-700">{formatCurrency(booking.totalAmount - booking.advancePaid)}</td>
                    <td className="px-6 py-4"><PaymentBadge status={booking.status} /></td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(booking.travelDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
