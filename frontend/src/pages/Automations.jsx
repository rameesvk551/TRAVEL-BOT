import React, { useState } from 'react';
import { Plus, Workflow, Zap, MoreVertical } from 'lucide-react';
import { useDrips } from '../hooks/useDrips';

export default function Automations() {
  const { data, isLoading } = useDrips();
  const trips = data?.data || [];

  return (
   <div className="p-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations & Drips</h1>
          <p className="text-slate-500 mt-1">Set up multi-step workflows triggered by events.</p>
        </div>
        <button className="shell-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500">Loading workflows...</div>
      ) : trips.length === 0 ? (
        <div className="shell-panel p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-[#f0f0f0] rounded-full flex items-center justify-center mb-6">
                <Workflow className="w-10 h-10 text-[#404040]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Build your first automation</h2>
            <p className="text-slate-500 max-w-md mb-8">Nurture leads, combat cart abandonment, or send post-trip check-ins completely on autopilot.</p>
            <button className="shell-button-primary">Create a Drip Sequence</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {trips.map(sequence => (
            <div key={sequence.id} className="shell-panel p-0 flex flex-col hover:-translate-y-1 transition-transform duration-200">
               <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                  <div>
                     <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-md ${sequence.isActive ? 'bg-[#f0f0f0] text-[#404040]' : 'bg-slate-100 text-slate-400'}`}>
                           <Workflow className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900">{sequence.name}</h3>
                     </div>
                     <p className="text-sm text-slate-500 pl-12 line-clamp-1">{sequence.description || 'No description provided'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={sequence.isActive} readOnly />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f0f0f0]0"></div>
                     </label>
                     <button className="text-slate-400 hover:text-slate-900 p-1"><MoreVertical className="w-5 h-5"/></button>
                  </div>
               </div>
               
               <div className="p-6 flex items-center justify-between text-sm bg-slate-50/50">
                  <div className="flex items-center gap-2 text-slate-600">
                     <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                     <span className="font-semibold text-slate-800">Trigger:</span> {sequence.trigger.replace(/_/g, ' ')}
                  </div>
                  <div className="flex gap-4 border-l border-slate-200 pl-4">
                     <div className="text-center">
                        <p className="text-slate-500 text-xs">Steps</p>
                        <p className="font-bold text-slate-900">{sequence.steps?.length || 0}</p>
                     </div>
                     <div className="text-center">
                        <p className="text-slate-500 text-xs">Enrolled</p>
                        <p className="font-bold text-slate-900">{sequence.enrollmentCount}</p>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
