import { formatPhone, truncate } from '../utils/formatters';
import {
  MapPinIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { getStatusTone, getStatusAccent } from './uiHelpers';
import {
  getAttentionBadges,
} from '../utils/leadInsights';

export default function LeadCard({ lead, onClick, onAssignAgent, agents = [], isSelected = false, onToggleSelect, onAssignClick, onStatusClick }) {
  const customer = lead.customer || {};
  const accentColor = getStatusAccent(lead.status);
  const attentionBadges = getAttentionBadges(lead);
  const isOverdue = attentionBadges.some((badge) => badge.key === 'overdue');

  return (
    <div
      onClick={() => onClick?.(lead)}
      className={`rounded-[var(--radius-md)] border bg-white p-3 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 group relative overflow-hidden ${
        isOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-neutral-200'
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[var(--radius-md)]"
        style={{ background: accentColor }}
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-neutral-200">
            <UserCircleIcon className="h-5 w-5 text-neutral-500" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
              {customer.name || 'Unknown'}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-400">
              {formatPhone(customer.phone) || 'No phone'}
            </p>
            {lead.assignedAgent && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAssignClick?.(lead); }}
                className="mt-1 inline-block text-[11px] text-neutral-600 hover:underline"
              >
                Assigned to {lead.assignedAgent.name}
              </button>
            )}
          </div>
        </div>

        {/* Status badge + Select checkbox – side by side, no overlap */}
        <div className="flex shrink-0 items-center gap-2">
          <span className={`badge ${getStatusTone(lead.status)} shrink-0 px-2 py-0.5 text-[9px]`}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onStatusClick?.(lead); }} className="text-[9px] font-bold">
              {lead.status?.replace(/_/g, ' ')}
            </button>
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(lead.id); }}
            aria-pressed={isSelected}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${isSelected ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400 hover:bg-neutral-50'}`}
            title={isSelected ? 'Unselect' : 'Select'}
          >
            {isSelected ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/></svg>
            )}
          </button>
        </div>
      </div>

      <div className="mb-2 space-y-1 pl-1">
        {lead.destination && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
      </div>

      {(lead.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 pl-1">
          {(lead.tags || []).slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
