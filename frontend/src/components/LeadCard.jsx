// FILE: /frontend/src/components/LeadCard.jsx

import { formatCurrency, formatDate, getStatusBadgeClass, truncate } from '../utils/formatters';
import { UserCircleIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { LEAD_STATUS_OPTIONS } from '../utils/leadStatuses';

export default function LeadCard({ lead, onClick, onStatusChange, onAssignAgent, agents = [] }) {
  const customer = lead.customer || {};
  const agent = lead.assignedAgent;

  return (
    <div
      onClick={() => onClick?.(lead)}
      className="glass-card p-4 cursor-pointer transition-all duration-200 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center">
            <UserCircleIcon className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{customer.name || 'Unknown'}</p>
            <p className="text-xs text-surface-400">{customer.phone}</p>
          </div>
        </div>
        <select
          value={lead.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange?.(lead.id, e.target.value)}
          className={`badge ${getStatusBadgeClass(lead.status)} border-transparent outline-none cursor-pointer hover:opacity-80 appearance-none text-center pb-[2px] pt-[2px]`}
        >
          {LEAD_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-3">
        {lead.destination && (
          <div className="flex items-center gap-2 text-xs text-surface-300">
            <MapPinIcon className="w-3.5 h-3.5 text-surface-500" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
        {lead.travelDates && (
          <div className="flex items-center gap-2 text-xs text-surface-300">
            <CalendarIcon className="w-3.5 h-3.5 text-surface-500" />
            <span>{lead.travelDates}</span>
          </div>
        )}
        {lead.budgetPerPerson && (
          <p className="text-xs text-surface-400">
            💰 {formatCurrency(lead.budgetPerPerson)}/person · 👥 {lead.travellers || '?'}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-700/30">
        <p className="text-[10px] text-surface-500">{formatDate(lead.createdAt)}</p>
        <div className="flex items-center gap-2">
          {agent ? (
            <p className="text-[10px] text-surface-400">→ {agent.name}</p>
          ) : null}

          <select
            value={lead.assignedAgentId || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onAssignAgent?.(lead.id, e.target.value)}
            className="text-[10px] bg-transparent text-surface-400 outline-none"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
