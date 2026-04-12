// FILE: /frontend/src/pages/Bookings.jsx

import { useState } from 'react';
import { useBookings } from '../hooks/useBookings';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../utils/formatters';
import BookingTimeline from '../components/BookingTimeline';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

export default function Bookings() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, status: '' });
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const { data, isLoading } = useBookings(filters);

  const bookings = data?.data?.data || [];
  const total = data?.data?.total || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings</h1>
          <p className="text-sm text-surface-400 mt-0.5">{total} bookings</p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6">
        {['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((status) => (
          <button
            key={status || 'all'}
            onClick={() => setFilters((f) => ({ ...f, status, page: 1 }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filters.status === status
                ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                : 'bg-surface-800/50 text-surface-400 hover:text-white border border-transparent'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Bookings list */}
        <div className="flex-1 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="h-5 bg-surface-700/50 rounded w-1/3 mb-2" />
                <div className="h-4 bg-surface-700/30 rounded w-2/3" />
              </div>
            ))
          ) : bookings.length === 0 ? (
            <div className="glass-card p-12 text-center text-surface-500 text-sm">No bookings found</div>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                onClick={() => setSelectedBookingId(booking.id)}
                className={`glass-card p-4 cursor-pointer transition-all duration-200 hover:border-brand-500/30 ${
                  selectedBookingId === booking.id ? 'border-brand-500/50 shadow-lg shadow-brand-500/5' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-500/10">
                      <CalendarDaysIcon className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{booking.bookingRef}</p>
                      <p className="text-xs text-surface-400">{booking.customer?.name} · {booking.package?.name || 'Custom'}</p>
                    </div>
                  </div>
                  <span className={`badge ${getStatusBadgeClass(booking.status)}`}>{booking.status}</span>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t border-surface-700/30">
                  <div>
                    <p className="text-[10px] text-surface-500 uppercase">Travel</p>
                    <p className="text-xs text-surface-300">{formatDate(booking.travelDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-500 uppercase">Total</p>
                    <p className="text-xs text-white font-medium">{formatCurrency(booking.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-500 uppercase">Paid</p>
                    <p className="text-xs text-green-400">{formatCurrency(booking.advancePaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-500 uppercase">Balance</p>
                    <p className="text-xs text-amber-400">{formatCurrency(booking.totalAmount - booking.advancePaid)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Timeline sidebar */}
        {selectedBookingId && (
          <div className="w-[320px] glass-card p-4 h-fit sticky top-24 animate-slide-in">
            <h3 className="text-sm font-semibold text-white mb-4">Booking Timeline</h3>
            <BookingTimeline bookingId={selectedBookingId} />
          </div>
        )}
      </div>
    </div>
  );
}
