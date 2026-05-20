import { formatDate, formatDateTime, formatPhone, truncate } from '../utils/formatters';
import {
  CalendarIcon,
  MapPinIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { getStatusTone, getInitials } from './uiHelpers';

export default function FollowUpCard({ followUp, onStatusChange }) {
  const lead = followUp.lead || {};
  const customer = lead.customer || {};
  
  const isOverdue = followUp?.status === 'Scheduled' && new Date(followUp.scheduledAt).getTime() < Date.now();

  function getFollowUpTone(status) {
    const tones = {
      Scheduled: 'bg-indigo-100 text-indigo-700',
      Done: 'bg-emerald-100 text-emerald-700',
      Cancelled: 'bg-rose-100 text-rose-700',
    };
    return tones[status] || 'bg-slate-100 text-slate-600';
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border bg-white p-4 transition-all duration-200 hover:shadow-lg group relative overflow-hidden ${
        isOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-neutral-200'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3 pl-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
            {customer.name ? getInitials(customer.name, 'L') : <UserCircleIcon className="h-5 w-5 text-neutral-500" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
              {customer.name || 'Unknown'}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-400">
              {formatPhone(customer.phone) || customer.email || 'No phone'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`badge ${getFollowUpTone(followUp.status)} shrink-0 px-2 py-0.5 text-[9px]`}>
            {followUp.status}
          </span>
          {lead.status && (
            <span className={`badge ${getStatusTone(lead.status)} shrink-0 px-2 py-0.5 text-[9px] uppercase`}>
              {lead.status?.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {isOverdue && (
        <div className="mb-3 pl-1">
          <span className="rounded-full border border-rose-200 bg-rose-50 text-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Overdue
          </span>
        </div>
      )}

      <div className="mb-3 space-y-1.5 pl-1">
        {lead.destination && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span className={isOverdue ? 'text-rose-600 font-medium' : ''}>Due: {formatDateTime(followUp.scheduledAt)}</span>
        </div>
      </div>

      <div className="mb-3 rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700">
        {followUp.note || 'No note'}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2.5 pl-1">
        <p className="shrink-0 text-[11px] font-medium text-neutral-400">{formatDate(followUp.createdAt)}</p>
        <div className="flex items-center gap-2">
          {followUp.status === 'Scheduled' && (
            <div className="flex gap-2">
              <button
                onClick={() => onStatusChange(followUp, 'Done')}
                className="rounded text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
              >
                Mark Done
              </button>
              <button
                onClick={() => onStatusChange(followUp, 'Cancelled')}
                className="rounded text-[11px] font-bold text-rose-500 hover:text-rose-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
