import { formatDateTime, formatPhone, truncate } from '../utils/formatters';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { getStatusAccent, getInitials, getStagePillStyle } from './uiHelpers';
import {
  getAttentionBadges,
  getLeadValueLabel,
  getLeadStageColor,
  getLeadStageLabel,
  getNextAction,
  getNextFollowUp,
} from '../utils/leadInsights';

export default function LeadCard({ lead, onClick, agents = [], isSelected = false, onToggleSelect, onAssignClick, onStatusClick }) {
  const customer = lead.customer || {};
  const accentColor = getStatusAccent(lead.status);
  const attentionBadges = getAttentionBadges(lead);
  const isOverdue = attentionBadges.some((badge) => badge.key === 'overdue');
  const statusLabel = getLeadStageLabel(lead);
  const nextFollowUp = getNextFollowUp(lead);
  const hasBudget = Boolean(lead.budgetPerPerson);
  const phone = formatPhone(customer.phone);

  return (
    <div
      onClick={() => onClick?.(lead)}
      className={`rounded-[var(--radius-md)] border bg-white p-3.5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 group relative overflow-hidden ${
        isOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-neutral-200'
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[var(--radius-md)]"
        style={{ background: accentColor }}
      />

      {/* Header: identity + status + select */}
      <div className="mb-2.5 flex items-start justify-between gap-2 pl-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
            {getInitials(customer.name, 'L')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
              {customer.name || 'Unknown'}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-neutral-400">
              {phone || customer.email || 'No phone'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStatusClick?.(lead); }}
            style={statusLabel ? getStagePillStyle(getLeadStageColor(lead)) : undefined}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusLabel ? '' : 'border border-dashed border-neutral-300 text-neutral-400'}`}
          >
            {statusLabel || 'Set status'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(lead.id); }}
            aria-pressed={isSelected}
            aria-label={isSelected ? 'Unselect lead' : 'Select lead'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${isSelected ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-400 hover:bg-neutral-50'}`}
          >
            {isSelected ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Attention badges */}
      {attentionBadges.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 pl-1">
          {attentionBadges.slice(0, 3).map((badge) => (
            <span
              key={badge.key}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Trip + value */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
        {lead.destination && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-600">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="truncate font-medium">{truncate(lead.destination, 28)}</span>
          </div>
        )}
        {hasBudget && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            {getLeadValueLabel(lead)}
          </span>
        )}
      </div>

      {/* Next action */}
      <div className="mb-2.5 flex items-center gap-1.5 pl-1 text-xs">
        <CalendarDaysIcon className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? 'text-rose-500' : 'text-neutral-400'}`} />
        <span className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-neutral-700'}`}>{getNextAction(lead)}</span>
        {nextFollowUp && (
          <span className="truncate text-neutral-400">· {formatDateTime(nextFollowUp.scheduledAt)}</span>
        )}
      </div>

      {/* Tags */}
      {(lead.tags || []).length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1 pl-1">
          {(lead.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-neutral-100 pt-2.5 pl-1">
        {lead.assignedAgent ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAssignClick?.(lead); }}
            className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            {lead.assignedAgent.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAssignClick?.(lead); }}
            className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-sky-600 hover:text-sky-700"
          >
            Assign owner
          </button>
        )}

        {phone && (
          <a
            href={`tel:${customer.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-bold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <PhoneIcon className="h-3.5 w-3.5" />
            Call
          </a>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.(lead); }}
          className="flex h-9 items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[11px] font-bold text-white transition-colors hover:bg-black"
        >
          Details
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
