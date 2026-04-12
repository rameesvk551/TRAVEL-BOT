// FILE: /frontend/src/pages/Payments.jsx

import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../utils/formatters';
import PaymentBadge from '../components/PaymentBadge';
import { CreditCardIcon } from '@heroicons/react/24/outline';

export default function Payments() {
  const { data, isLoading } = useQuery({
    queryKey: ['all-bookings-for-payments'],
    queryFn: () => client.get('/bookings', { params: { pageSize: 100 } }).then((r) => r.data),
  });

  const bookings = data?.data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-sm text-surface-400 mt-0.5">Track all payment status</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Booking</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Paid</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Balance</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Travel</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-700/20 animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-700/30 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                  <CreditCardIcon className="w-8 h-8 mx-auto mb-2 text-surface-600" />
                  No payments yet
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-surface-700/20 hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-white">{booking.bookingRef}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{booking.customer?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-white font-medium">{formatCurrency(booking.totalAmount)}</td>
                  <td className="px-4 py-3 text-sm text-green-400">{formatCurrency(booking.advancePaid)}</td>
                  <td className="px-4 py-3 text-sm text-amber-400">{formatCurrency(booking.totalAmount - booking.advancePaid)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={booking.status} /></td>
                  <td className="px-4 py-3 text-xs text-surface-400">{formatDate(booking.travelDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
