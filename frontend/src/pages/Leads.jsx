// FILE: /frontend/src/pages/Leads.jsx

import { useState } from 'react';
import { useLeads } from '../hooks/useLeads';
import { formatCurrency, formatDate, getStatusBadgeClass, formatPhone } from '../utils/formatters';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

export default function Leads() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, status: '', search: '' });
  const { data, isLoading } = useLeads(filters);

  const leads = data?.data?.data || [];
  const total = data?.data?.total || 0;

  const statuses = ['', 'NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'LOST', 'CANCELLED'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-surface-400 mt-0.5">{total} total leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            className="input-field pl-10 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-surface-500" />
          {statuses.map((status) => (
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
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Destination</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Dates</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Budget</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-surface-700/20 animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-700/30 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">No leads found</td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-surface-700/20 hover:bg-surface-800/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{lead.customer?.name || '—'}</p>
                      <p className="text-xs text-surface-400">{formatPhone(lead.customer?.phone)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-300">{lead.destination || '—'}</td>
                    <td className="px-4 py-3 text-sm text-surface-300">{lead.travelDates || '—'}</td>
                    <td className="px-4 py-3 text-sm text-surface-300">
                      {lead.budgetPerPerson ? `${formatCurrency(lead.budgetPerPerson)}/pp` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-300">{lead.assignedAgent?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusBadgeClass(lead.status)}`}>{lead.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-400">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > filters.pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700/50">
            <p className="text-xs text-surface-400">
              Page {filters.page} of {Math.ceil(total / filters.pageSize)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                disabled={filters.page <= 1}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page >= Math.ceil(total / filters.pageSize)}
                className="btn-ghost text-xs disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
