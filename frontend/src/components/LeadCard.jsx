// FILE: /frontend/src/components/LeadCard.jsx

import { formatCurrency, formatDate, getStatusBadgeClass, truncate } from '../utils/formatters';
import { UserCircleIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { LEAD_STATUS_OPTIONS } from '../utils/leadStatuses';
import { getStatusTone, getStatusAccent } from './uiHelpers';

export default function LeadCard({ lead, onClick, onStatusChange, onAssignAgent, agents = [] }) {
  const customer = lead.customer || {};
  const agent = lead.assignedAgent;
  const accentColor = getStatusAccent(lead.status);

  return (
    <div
      onClick={() => onClick?.(lead)}
      className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 group relative overflow-hidden"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 w-1 h-full rounded-l-[var(--radius-md)]"
        style={{ background: accentColor }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 pl-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center ring-1 ring-neutral-200">
            <UserCircleIcon className="w-5 h-5 text-neutral-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900 leading-tight">{customer.name || 'Unknown'}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{customer.phone}</p>
          </div>
        </div>
        <span className={`badge ${getStatusTone(lead.status)} text-[9px] px-2 py-0.5`}>
          {lead.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-3 pl-1">
        {lead.destination && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <MapPinIcon className="w-3.5 h-3.5 text-neutral-400" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
        {lead.travelDates && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <CalendarIcon className="w-3.5 h-3.5 text-neutral-400" />
            <span>{lead.travelDates}</span>
          </div>
        )}
        {lead.budgetPerPerson && (
          <p className="text-xs text-neutral-400">
            💰 {formatCurrency(lead.budgetPerPerson)}/person · 👥 {lead.travellers || '?'}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 pl-1">
        <p className="text-[11px] text-neutral-400 font-medium">{formatDate(lead.createdAt)}</p>
        <div className="flex items-center gap-2">
          {agent && (
            <span className="text-[11px] font-medium text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded-full">
              {agent.name}
            </span>
          )}
          <select
            value={lead.assignedAgentId || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onAssignAgent?.(lead.id, e.target.value)}
            className="text-[11px] bg-transparent text-neutral-400 outline-none cursor-pointer hover:text-neutral-600"
          >
            <option value="">Assign</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
