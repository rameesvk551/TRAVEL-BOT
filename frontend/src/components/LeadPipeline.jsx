// FILE: /frontend/src/components/LeadPipeline.jsx

import { useState } from 'react';
import { useLeads, useUpdateLead } from '../hooks/useLeads';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import LeadCard from './LeadCard';
import { LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';
import { getStatusDotColor } from './uiHelpers';
import { InboxIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/formatters';
import { getAttentionBadges, getPipelineValue } from '../utils/leadInsights';

export default function LeadPipeline({ onLeadClick, leads: providedLeads }) {
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const updateLead = useUpdateLead();
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [mobileStatus, setMobileStatus] = useState(LEAD_PIPELINE_COLUMNS[0]?.key);

  const hasProvidedLeads = Array.isArray(providedLeads);
  const leads = hasProvidedLeads ? providedLeads : data?.data?.data || [];

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((r) => r.data),
  });

  const agents = agentsResponse?.data || [];

  const getLeadsByStatus = (status) =>
    leads.filter((l) => l.status === status);

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedLead && draggedLead.status !== newStatus) {
      updateLead.mutate({ id: draggedLead.id, data: { status: newStatus } });
    }
    setDraggedLead(null);
  };

  function handleStatusChange(leadId, newStatus) {
    if (!leadId) return;
    updateLead.mutate({ id: leadId, data: { status: newStatus } });
  }

  function handleAssignAgent(leadId, agentId) {
    if (!leadId) return;
    updateLead.mutate({ id: leadId, data: { assignedAgentId: agentId || null } });
  }

  if (!hasProvidedLeads && isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
        {LEAD_PIPELINE_COLUMNS.map((col) => (
          <div key={col.key} className="w-[320px] shrink-0 rounded-2xl border border-neutral-200/60 bg-neutral-50/30 p-5">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 bg-neutral-200 rounded-md w-24 animate-pulse" />
              <div className="h-5 bg-neutral-200 rounded-full w-8 animate-pulse" />
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 bg-white rounded-2xl border border-neutral-200/50 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-neutral-100 rounded w-1/2 animate-pulse" />
                      <div className="h-2 bg-neutral-50 rounded w-1/3 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-16 bg-neutral-50/50 rounded-xl animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeMobileColumn = LEAD_PIPELINE_COLUMNS.find((col) => col.key === mobileStatus) || LEAD_PIPELINE_COLUMNS[0];
  const mobileLeads = getLeadsByStatus(activeMobileColumn?.key);

  return (
    <>
    <div className="md:hidden">
      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 hide-scrollbar">
        {LEAD_PIPELINE_COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => setMobileStatus(col.key)}
            className={`shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold transition ${
              mobileStatus === col.key ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-500'
            }`}
          >
            {col.label} ({getLeadsByStatus(col.key).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mobileLeads.length === 0 ? (
          <div className="mobile-record-card text-center">
            <InboxIcon className="mx-auto mb-2 h-7 w-7 text-neutral-300" />
            <p className="text-sm font-semibold text-neutral-700">No leads in {activeMobileColumn?.label}</p>
          </div>
        ) : (
          mobileLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={onLeadClick}
              onStatusChange={handleStatusChange}
              onAssignAgent={handleAssignAgent}
              agents={agents}
            />
          ))
        )}
      </div>
    </div>

    <div className="hidden gap-4 overflow-x-auto pb-4 md:flex hide-scrollbar">
      {LEAD_PIPELINE_COLUMNS.map((col) => {
        const colLeads = getLeadsByStatus(col.key);
        const isDragOver = dragOverCol === col.key;
        const overdueCount = colLeads.filter((lead) =>
          getAttentionBadges(lead).some((badge) => badge.key === 'overdue')
        ).length;
        const pipelineValue = getPipelineValue(colLeads);

        return (
          <div
            key={col.key}
            className={`w-[300px] shrink-0 rounded-[var(--radius-lg)] border bg-white p-4 min-h-[400px] transition-all duration-200 ${
              isDragOver
                ? 'border-indigo-300 bg-indigo-50/30 shadow-md'
                : 'border-neutral-200'
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(col.key)}`}
                  />
                  <h3 className="text-sm font-semibold text-neutral-800">
                    {col.label}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 min-w-[24px] text-center">
                  {colLeads.length}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2">
                <span className="text-[11px] font-semibold text-neutral-500">
                  {pipelineValue > 0 ? formatCurrency(pipelineValue) : 'No value'}
                </span>
                {overdueCount > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                    {overdueCount} overdue
                  </span>
                )}
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3 flex-1">
              {colLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <LeadCard
                    lead={lead}
                    onClick={onLeadClick}
                    onStatusChange={handleStatusChange}
                    onAssignAgent={handleAssignAgent}
                    agents={agents}
                  />
                </div>
              ))}

              {colLeads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-neutral-200/60 rounded-2xl bg-neutral-50/40 text-center transition-colors group-hover:border-neutral-300 group-hover:bg-neutral-50/60">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-neutral-100 mb-3">
                    <InboxIcon className="w-5 h-5 text-neutral-300" />
                  </div>
                  <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider mb-1">Empty Column</p>
                  <p className="text-[10px] text-neutral-400 max-w-[120px] leading-tight">Drag and drop leads here to change status</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
