// FILE: /frontend/src/components/LeadPipeline.jsx

import { useState } from 'react';
import { useLeads, useUpdateLead } from '../hooks/useLeads';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import LeadCard from './LeadCard';
import { LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';

export default function LeadPipeline({ onLeadClick }) {
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const updateLead = useUpdateLead();
  const [draggedLead, setDraggedLead] = useState(null);

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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_PIPELINE_COLUMNS.map((col) => (
          <div key={col.key} className="w-[280px] shrink-0 animate-pulse rounded-[14px] border border-[#e5e5e5] bg-white p-4">
            <div className="h-8 bg-[#ebebeb] rounded mb-3" />
            <div className="space-y-3">
              <div className="h-32 bg-[#f5f5f5] rounded-xl" />
              <div className="h-32 bg-[#f5f5f5] rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {LEAD_PIPELINE_COLUMNS.map((col) => {
        const colLeads = getLeadsByStatus(col.key);

        return (
          <div
            key={col.key}
            className="w-[280px] shrink-0 rounded-[14px] border border-[#e5e5e5] bg-white p-4 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#2d2d2d]">
                {col.label}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#f0f0f0] text-[#525252]">
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
                <div className="flex items-center justify-center h-32 border-2 border-dashed border-[#e5e5e5] rounded-xl">
                  <p className="text-xs text-[#8a8a8a]">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
