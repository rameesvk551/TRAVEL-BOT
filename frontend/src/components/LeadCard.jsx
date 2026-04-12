// FILE: /frontend/src/components/LeadCard.jsx

import { formatCurrency, formatDate, getStatusBadgeClass, truncate } from '../utils/formatters';
import { UserCircleIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function LeadCard({ lead, onClick }) {
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
        <span className={`badge ${getStatusBadgeClass(lead.status)}`}>
          {lead.status}
        </span>
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
        {agent && (
          <p className="text-[10px] text-surface-400">
            → {agent.name}
          </p>
        )}
      </div>
    </div>
  );
}
