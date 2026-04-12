// FILE: /frontend/src/components/LeadPipeline.jsx

import { useState } from 'react';
import { useLeads, useUpdateLead } from '../hooks/useLeads';
import LeadCard from './LeadCard';

const COLUMNS = [
  { key: 'NEW', label: 'New', color: 'blue' },
  { key: 'QUOTED', label: 'Quoted', color: 'purple' },
  { key: 'BOOKED', label: 'Booked', color: 'green' },
  { key: 'LOST', label: 'Lost', color: 'red' },
];

export default function LeadPipeline({ onLeadClick }) {
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const updateLead = useUpdateLead();
  const [draggedLead, setDraggedLead] = useState(null);

  const leads = data?.data?.data || [];

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

  const colorBorderMap = {
    blue: 'border-blue-500/30',
    purple: 'border-purple-500/30',
    green: 'border-green-500/30',
    red: 'border-red-500/30',
  };

  const colorTextMap = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  const colorBgMap = {
    blue: 'bg-blue-500/10',
    purple: 'bg-purple-500/10',
    green: 'bg-green-500/10',
    red: 'bg-red-500/10',
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="kanban-column animate-pulse">
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
      {COLUMNS.map((col) => {
        const colLeads = getLeadsByStatus(col.key);

        return (
          <div
            key={col.key}
            className={`kanban-column border ${colorBorderMap[col.color]} min-h-[400px]`}
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
                  <LeadCard lead={lead} onClick={onLeadClick} />
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
