import { formatDate, formatDateTime, formatPhone, truncate } from '../utils/formatters';
import {
  BanknotesIcon,
  CalendarIcon,
  MapPinIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { getStatusTone, getStatusAccent } from './uiHelpers';
import {
  getAttentionBadges,
  getLeadValueLabel,
  getNextAction,
  getNextFollowUp,
} from '../utils/leadInsights';
import { mergeAssignedAgentOption } from '../utils/agentOptions';

export default function LeadCard({ lead, onClick, onAssignAgent, agents = [] }) {
  const customer = lead.customer || {};
  const agent = lead.assignedAgent;
  const agentOptions = mergeAssignedAgentOption(agents, lead);
  const accentColor = getStatusAccent(lead.status);
  const attentionBadges = getAttentionBadges(lead);
  const nextFollowUp = getNextFollowUp(lead);
  const isOverdue = attentionBadges.some((badge) => badge.key === 'overdue');

  return (
    <div
      onClick={() => onClick?.(lead)}
      className={`rounded-[var(--radius-md)] border bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 group relative overflow-hidden ${
        isOverdue ? 'border-rose-200 ring-1 ring-rose-100' : 'border-neutral-200'
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[var(--radius-md)]"
        style={{ background: accentColor }}
      />

      <div className="mb-3 flex items-start justify-between gap-3 pl-1">
        <div className="flex min-w-0 items-center gap-2.5">
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
          </div>
        </div>
        <span className={`badge ${getStatusTone(lead.status)} shrink-0 px-2 py-0.5 text-[9px]`}>
          {lead.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {attentionBadges.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 pl-1">
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

      <div className="mb-3 space-y-1.5 pl-1">
        {lead.destination && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
        {lead.travelDates && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{lead.travelDates}</span>
          </div>
        )}
        {lead.budgetPerPerson && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <BanknotesIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{getLeadValueLabel(lead)}</span>
          </div>
        )}
        {lead.travellers && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <UserGroupIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{lead.travellers} travellers</span>
          </div>
        )}
        {nextFollowUp && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>Next: {formatDateTime(nextFollowUp.scheduledAt)}</span>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
        {getNextAction(lead)}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2.5 pl-1">
        <p className="shrink-0 text-[11px] font-medium text-neutral-400">{formatDate(lead.createdAt)}</p>
        <div className="flex min-w-0 items-center gap-2">
          {agent && (
            <span className="truncate rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
              {agent.name}
            </span>
          )}
          <select
            value={lead.assignedAgentId || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onAssignAgent?.(lead.id, e.target.value)}
            className="max-w-[88px] cursor-pointer bg-transparent text-[11px] text-neutral-400 outline-none hover:text-neutral-600"
          >
            <option value="">Assign</option>
            {agentOptions.map((agentOption) => (
              <option key={agentOption.id} value={agentOption.id}>
                {agentOption.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
