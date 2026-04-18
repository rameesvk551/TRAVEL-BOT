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

  const colorBorderMap = {
    blue: 'border-blue-500/30',
    amber: 'border-amber-500/30',
    indigo: 'border-indigo-500/30',
    purple: 'border-purple-500/30',
    violet: 'border-violet-500/30',
    emerald: 'border-emerald-500/30',
    green: 'border-green-500/30',
    rose: 'border-rose-500/30',
    red: 'border-red-500/30',
    slate: 'border-slate-500/30',
  };

  const colorTextMap = {
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    indigo: 'text-indigo-400',
    purple: 'text-purple-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    green: 'text-green-400',
    rose: 'text-rose-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };

  const colorBgMap = {
    blue: 'bg-blue-500/10',
    amber: 'bg-amber-500/10',
    indigo: 'bg-indigo-500/10',
    purple: 'bg-purple-500/10',
    violet: 'bg-violet-500/10',
    emerald: 'bg-emerald-500/10',
    green: 'bg-green-500/10',
    rose: 'bg-rose-500/10',
    red: 'bg-red-500/10',
    slate: 'bg-slate-500/10',
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_PIPELINE_COLUMNS.map((col) => (
          <div key={col.key} className="kanban-column w-[280px] shrink-0 animate-pulse">
            <div className="h-8 bg-surface-700/50 rounded mb-3" />
            <div className="space-y-3">
              <div className="h-32 bg-surface-700/30 rounded-xl" />
              <div className="h-32 bg-surface-700/30 rounded-xl" />
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
            className={`kanban-column w-[280px] shrink-0 border ${colorBorderMap[col.color]} min-h-[400px]`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${colorTextMap[col.color]}`}>
                {col.label}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorBgMap[col.color]} ${colorTextMap[col.color]}`}
              >
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
                <div className="flex items-center justify-center h-32 border-2 border-dashed border-surface-700/30 rounded-xl">
                  <p className="text-xs text-surface-500">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
