// FILE: /frontend/src/components/LeadPipeline.jsx

import { useState } from 'react';
import { useLeads, useUpdateLead } from '../hooks/useLeads';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import LeadCard from './LeadCard';
import { LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';
import { getStatusDotColor, getStatusAccent } from './uiHelpers';
import { InboxIcon } from '@heroicons/react/24/outline';

export default function LeadPipeline({ onLeadClick }) {
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const updateLead = useUpdateLead();
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const leads = data?.data?.data || [];

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

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
        {LEAD_PIPELINE_COLUMNS.map((col) => (
          <div key={col.key} className="w-[300px] shrink-0 animate-pulse rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
            <div className="h-8 bg-neutral-100 rounded-lg mb-3" />
            <div className="space-y-3">
              <div className="h-32 bg-neutral-50 rounded-xl" />
              <div className="h-32 bg-neutral-50 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
      {LEAD_PIPELINE_COLUMNS.map((col) => {
        const colLeads = getLeadsByStatus(col.key);
        const isDragOver = dragOverCol === col.key;
        const accentColor = getStatusAccent(col.key);

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
            <div className="flex items-center justify-between mb-4">
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
                <div className="flex flex-col items-center justify-center h-32 border border-dashed border-neutral-200 rounded-[var(--radius-md)] bg-neutral-50/50">
                  <InboxIcon className="w-6 h-6 text-neutral-300 mb-2" />
                  <p className="text-xs text-neutral-400 font-medium">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
