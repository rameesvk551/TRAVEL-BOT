import React, { useState } from 'react';
import { Plus, Search, Users, Activity, BarChart2 } from 'lucide-react';
import { useCampaigns } from '../hooks/useCampaigns';
import { formatDateTime } from '../utils/formatters';

export default function Campaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading } = useCampaigns();
  
  const campaigns = data?.data || [];

  return (
    <div className="p-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Push Campaigns</h1>
          <p className="text-slate-500 mt-1">Broadcast promotional messages to segmented audiences.</p>
        </div>
        <button className="shell-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="shell-panel p-4 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Campaigns</p>
            <p className="text-2xl font-bold text-slate-900">{campaigns.filter(c => c.status === 'SENDING' || c.status === 'SCHEDULED').length}</p>
          </div>
        </div>
        
        <div className="shell-panel p-4 flex gap-4 items-center border-l-4 border-l-teal-500">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
             <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Contacts Reached</p>
            <p className="text-2xl font-bold text-slate-900">{campaigns.reduce((sum, c) => sum + c.totalRecipients, 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="shell-panel p-4 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
             <BarChart2 className="w-6 h-6" />
          </div>
          <div>
             <p className="text-sm font-medium text-slate-500">Read Rate</p>
             <p className="text-2xl font-bold text-slate-900">
               {campaigns.length ? 
                 Math.round((campaigns.reduce((sum, c) => sum + c.read, 0) / Math.max(1, campaigns.reduce((sum, c) => sum + c.delivered, 0))) * 100)
                 : 0}%
             </p>
          </div>
        </div>
      </div>

      <div className="shell-panel p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="shell-input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-sm font-medium border-b border-slate-200">
                <th className="p-4 whitespace-nowrap">Campaign Name</th>
                <th className="p-4 whitespace-nowrap">Status</th>
                <th className="p-4 whitespace-nowrap">Template Used</th>
                <th className="p-4 whitespace-nowrap text-right">Recipients</th>
                <th className="p-4 text-center">Performance (Delivered / Read)</th>
                <th className="p-4 whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Loading campaigns...</td></tr>
              ) : campaigns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                 <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Activity className="w-8 h-8 text-slate-400" />
                       </div>
                       <p className="text-lg font-medium text-slate-900">No campaigns yet</p>
                       <p className="mt-1 mb-4">Start reaching your audience with push notifications.</p>
                       <button className="shell-button-primary">Create Your First Campaign</button>
                    </td>
                 </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors group">
                    <td className="p-4">
                       <div className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">{c.name}</div>
                       <div className="text-xs text-slate-500">{c.type}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${c.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'DRAFT' ? 'bg-slate-100 text-slate-600 border-slate-200' : c.status === 'SENDING' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {c.template?.displayName || <span className="text-slate-400">Custom Manual</span>}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-700">
                      {c.totalRecipients.toLocaleString()}
                    </td>
                    <td className="p-4 w-64 text-center">
                       {c.status === 'DRAFT' ? (
                          <span className="text-slate-400 text-sm">-</span>
                       ) : (
                          <div className="flex items-center gap-2">
                             <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden flex">
                                <div className="bg-teal-500 h-full" style={{ width: `${Math.max(5, (c.read / c.totalRecipients) * 100)}%` }}></div>
                                <div className="bg-emerald-300 h-full" style={{ width: `${Math.max(0, ((c.delivered - c.read) / c.totalRecipients) * 100)}%` }}></div>
                             </div>
                             <span className="text-xs font-medium text-slate-600">{Math.round((c.read / Math.max(1, c.totalRecipients)) * 100)}% Read</span>
                          </div>
                       )}
                    </td>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                       {c.status === 'SENT' ? formatDateTime(c.sentAt) : c.status === 'SCHEDULED' ? formatDateTime(c.scheduledAt) : formatDateTime(c.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
