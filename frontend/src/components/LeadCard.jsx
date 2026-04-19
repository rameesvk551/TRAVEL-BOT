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
      className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 cursor-pointer transition-all duration-200 hover:border-[#d4d4d4] hover:shadow-lg hover:shadow-black/5 group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#ebebeb] flex items-center justify-center">
            <UserCircleIcon className="w-5 h-5 text-[#6b6b6b]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1a1a1a]">{customer.name || 'Unknown'}</p>
            <p className="text-xs text-[#8a8a8a]">{customer.phone}</p>
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
          <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
            <MapPinIcon className="w-3.5 h-3.5 text-[#8a8a8a]" />
            <span>{truncate(lead.destination, 30)}</span>
          </div>
        )}
        {lead.travelDates && (
          <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
            <CalendarIcon className="w-3.5 h-3.5 text-[#8a8a8a]" />
            <span>{lead.travelDates}</span>
          </div>
        )}
        {lead.budgetPerPerson && (
          <p className="text-xs text-[#8a8a8a]">
            💰 {formatCurrency(lead.budgetPerPerson)}/person · 👥 {lead.travellers || '?'}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#ebebeb]">
        <p className="text-[10px] text-[#8a8a8a]">{formatDate(lead.createdAt)}</p>
        <div className="flex items-center gap-2">
          {agent ? (
            <p className="text-[10px] text-[#6b6b6b]">→ {agent.name}</p>
          ) : null}

          <select
            value={lead.assignedAgentId || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onAssignAgent?.(lead.id, e.target.value)}
            className="text-[10px] bg-transparent text-[#6b6b6b] outline-none"
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
