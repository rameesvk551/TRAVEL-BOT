// FILE: /frontend/src/components/BookingTimeline.jsx

import { useBookingTimeline } from '../hooks/useBookings';
import { formatDateTime } from '../utils/formatters';
import {
  CheckCircleIcon,
  CreditCardIcon,
  BellAlertIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const iconMap = {
  BOOKING_CREATED: CheckCircleIcon,
  PAYMENT_PAID: CreditCardIcon,
  PAYMENT_PENDING: ClockIcon,
  PAYMENT_EXPIRED: XCircleIcon,
  PAYMENT_FAILED: XCircleIcon,
  REMINDER_PENDING: BellAlertIcon,
  REMINDER_SENT: BellAlertIcon,
  REMINDER_CANCELLED: XCircleIcon,
};

const colorMap = {
  BOOKING_CREATED: 'text-green-400 bg-green-500/10',
  PAYMENT_PAID: 'text-[#8a8a8a] bg-[#f5f5f5]0/10',
  PAYMENT_PENDING: 'text-amber-400 bg-amber-500/10',
  PAYMENT_EXPIRED: 'text-red-400 bg-red-500/10',
  PAYMENT_FAILED: 'text-red-400 bg-red-500/10',
  REMINDER_PENDING: 'text-blue-400 bg-blue-500/10',
  REMINDER_SENT: 'text-green-400 bg-green-500/10',
  REMINDER_CANCELLED: 'text-surface-400 bg-surface-500/10',
};

export default function BookingTimeline({ bookingId }) {
  const { data, isLoading } = useBookingTimeline(bookingId);
  const events = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-700/50" />
            <div className="flex-1">
              <div className="h-4 bg-surface-700/50 rounded w-2/3 mb-1" />
              <div className="h-3 bg-surface-700/30 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-surface-700/50" />

      <div className="space-y-6">
        {events.map((event, i) => {
          const Icon = iconMap[event.type] || CheckCircleIcon;
          const color = colorMap[event.type] || 'text-surface-400 bg-surface-500/10';

          return (
            <div key={i} className="flex items-start gap-4 relative animate-in">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-white">{event.title}</p>
                {event.description && (
                  <p className="text-xs text-surface-400 mt-0.5">{event.description}</p>
                )}
                <p className="text-[10px] text-surface-500 mt-1">{formatDateTime(event.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
