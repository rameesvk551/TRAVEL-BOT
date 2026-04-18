import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  CheckCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { useLeads, useLead, useCreateLead, useUpdateLead, useAddFollowUp, useUpdateFollowUp, useDeleteFollowUp, useAddNote } from '../hooks/useLeads';
import { formatDate, formatDateTime, formatPhone, formatTime, timeAgo } from '../utils/formatters';
import { LEAD_STATUS_OPTIONS, LEAD_PIPELINE_COLUMNS } from '../utils/leadStatuses';
import { getInitials, getStatusTone } from '../components/uiHelpers';
import LeadPipeline from '../components/LeadPipeline';

const TABS = ['All Leads', 'Just Contacted', 'Package Searched', 'Package Interested', 'Contacted', 'Booked', 'Converted', 'Lost'];

export default function Leads() {
  const [activeTab, setActiveTab] = useState('All Leads');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list'); // list or kanban
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  
  // Data Fetching
  const leadsQuery = useLeads({ pageSize: 200 }); // Increase for now, could be paginated
  const leads = leadsQuery.data?.data?.data || [];
  
  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((r) => r.data),
  });
  const agents = agentsResponse?.data || [];
  
  const updateLead = useUpdateLead();

  // Derived Data
  const filteredLeads = useMemo(() => {
    let filtered = leads;
    if (activeTab !== 'All Leads') {
      filtered = filtered.filter(l => l.status.toLowerCase().replace('_', ' ') === activeTab.toLowerCase());
    }
    if (search) {
      filtered = filtered.filter(l => 
        l.customer?.name?.toLowerCase().includes(search.toLowerCase()) || 
        l.customer?.phone?.includes(search) ||
        l.customer?.email?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }, [leads, activeTab, search]);

  const metrics = useMemo(() => {
    return {
      totalDeals: leads.length,
      totalCompanies: new Set(leads.map(l => l.customerId)).size,
      won: leads.filter(l => l.status === 'CONVERTED').length,
      lost: leads.filter(l => l.status === 'LOST').length,
    };
  }, [leads]);

  return (
    <div className="w-full pb-10">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lead Management</h1>
        <div className="flex items-center gap-3">
           <div className="bg-slate-100 p-1 rounded-lg flex items-center shadow-sm">
             <button onClick={() => setView('list')} className={`px-4 py-1.5 text-sm font-medium rounded-md ${view === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Table</button>
             <button onClick={() => setView('kanban')} className={`px-4 py-1.5 text-sm font-medium rounded-md ${view === 'kanban' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Kanban</button>
           </div>
           
           <select className="shell-input-rect bg-white w-32 py-2">
             <option>All Sources</option>
           </select>
           
           <button className="shell-button-secondary bg-white text-slate-700 py-2">
             Newest First
           </button>
           
           <button className="shell-button-primary py-2 px-4 shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-0">
             <PlusIcon className="w-4 h-4 mr-2" /> New Lead
           </button>
        </div>
      </div>
      
      {/* Search & Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email, phone..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-[14px] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors bg-white shadow-sm"
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <div className="bg-white border text-center relative border-slate-200 rounded-[16px] p-5 flex items-center gap-4 shadow-sm">
           <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
             <span className="font-bold text-xl">📁</span>
           </div>
           <div>
             <div className="text-2xl font-bold text-slate-900 leading-none">{metrics.totalDeals}</div>
             <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Total Deals</div>
           </div>
         </div>
         <div className="bg-white border relative border-slate-200 rounded-[16px] p-5 flex items-center gap-4 shadow-sm">
           <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
             <span className="font-bold text-xl">🏢</span>
           </div>
           <div>
             <div className="text-2xl font-bold text-slate-900 leading-none">{metrics.totalCompanies}</div>
             <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Total Companies</div>
           </div>
         </div>
         <div className="bg-white border relative border-emerald-200 rounded-[16px] p-5 flex items-center gap-4 shadow-sm">
           <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
             <span className="font-bold text-xl">🏆</span>
           </div>
           <div>
             <div className="text-2xl font-bold text-emerald-700 leading-none">{metrics.won}</div>
             <div className="text-xs font-semibold text-emerald-600/80 mt-1 uppercase tracking-wider">Won</div>
           </div>
         </div>
         <div className="bg-white border relative border-rose-200 rounded-[16px] p-5 flex items-center gap-4 shadow-sm">
           <div className="w-12 h-12 rounded-full border-2 border-rose-500/30 bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
             <span className="font-bold text-xl">🚫</span>
           </div>
           <div>
             <div className="text-2xl font-bold text-rose-600 leading-none">{metrics.lost}</div>
             <div className="text-xs font-semibold text-rose-500/80 mt-1 uppercase tracking-wider">Lost</div>
           </div>
         </div>
      </div>
      
      {/* Filters secondary */}
      <div className="flex justify-end mb-4 gap-2">
        <div className="bg-slate-100 rounded-md p-0.5 inline-flex text-xs font-medium text-slate-600 shadow-sm border border-slate-200">
          <button className="px-3 py-1 bg-blue-600 text-white rounded-md shadow-sm">All</button>
          <button className="px-3 py-1 hover:bg-slate-200 rounded-md transition-colors">Month</button>
          <button className="px-3 py-1 hover:bg-slate-200 rounded-md transition-colors">Year</button>
          <button className="px-3 py-1 hover:bg-slate-200 rounded-md transition-colors">Custom</button>
        </div>
      </div>

      {/* Main Content Area */}
      {view === 'kanban' ? (
        <LeadPipeline onLeadClick={(lead) => setSelectedLeadId(lead.id)} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-16">SL NO</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">LEAD</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">CONTACT</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">SOURCE</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">NEXT CONTACT</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">ASSIGNED TO</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadsQuery.isLoading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-sm text-slate-500">Loading leads...</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-16 text-center">
                      <div className="text-slate-400 mb-2">No leads found.</div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, i) => (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <td className="py-4 px-4 text-sm text-blue-500 font-medium">#{i + 1}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                            {getInitials(lead.customer?.name, 'L')}
                          </div>
                          <span className="font-semibold text-slate-900 text-sm">{lead.customer?.name || 'Unnamed Lead'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-500">
                        <div className="flex flex-col gap-1 text-xs">
                          {lead.customer?.phone && <span className="flex items-center gap-1"><span className="text-slate-400">📞</span> {lead.customer.phone}</span>}
                          {lead.customer?.email && <span className="flex items-center gap-1"><span className="text-slate-400">✉️</span> {lead.customer.email}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">{lead.source?.replace('_', ' ') || 'Direct'}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {lead.followUps?.length > 0 
                          ? formatDateTime(lead.followUps[0].scheduledAt) 
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                        <select
                          className="bg-transparent border-0 text-sm font-medium text-slate-600 cursor-pointer focus:ring-0 appearance-none hover:bg-slate-100 rounded-md py-1 px-2"
                          value={lead.assignedAgentId || ''}
                          onChange={(e) => updateLead.mutate({ id: lead.id, data: { assignedAgentId: e.target.value }})}
                        >
                          <option value="">Unassigned</option>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                        <select
                           className={`border-0 appearance-none text-xs font-bold rounded-full px-3 py-1 bg-emerald-100 text-emerald-700 cursor-pointer focus:ring-0 ${getStatusTone(lead.status)}`}
                           value={lead.status}
                           onChange={(e) => updateLead.mutate({ id: lead.id, data: { status: e.target.value }})}
                        >
                           {LEAD_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-out Drawer */}
      <LeadDrawer 
        leadId={selectedLeadId} 
        onClose={() => setSelectedLeadId(null)} 
        agents={agents} 
      />

    </div>
  );
}

function LeadDrawer({ leadId, onClose, agents }) {
  const { data, isLoading } = useLead(leadId);
  const lead = data?.data;
  
  const [activeTab, setActiveTab] = useState('Notes');
  const [noteContent, setNoteContent] = useState('');
  
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');

  const updateLead = useUpdateLead();
  const addNote = useAddNote();
  const addFollowup = useAddFollowUp();
  const updateFollowup = useUpdateFollowUp();
  
  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <aside className="absolute right-0 top-0 h-full w-full max-w-[500px] border-l border-slate-200 bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          {isLoading ? (
            <div className="animate-pulse flex gap-4 w-full">
              <div className="h-12 w-12 rounded-full bg-slate-200 shrink-0"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/3"></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-lg shrink-0">
                {getInitials(lead?.customer?.name, 'L')}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 truncate">
                  {lead?.customer?.name?.toUpperCase() || 'UNNAMED LEAD'}
                </h2>
                <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className={`badge ${getStatusTone(lead?.status)} text-[10px] px-2 py-0.5`}>{lead?.status}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <PencilIcon className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead Properties Grid */}
        {!isLoading && lead && (
          <div className="px-6 py-4 grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
             <div>
               <div className="text-slate-400 text-xs mb-1">Project</div>
               <div className="font-medium text-slate-900">—</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Source</div>
               <div className="font-medium text-slate-900">{lead.source?.replace('_', ' ') || 'organic'}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Contact Person</div>
               <div className="font-medium text-slate-900">{lead.customer?.name?.toUpperCase()}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Phone</div>
               <div className="font-medium text-slate-900">{lead.customer?.phone || '—'}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Email</div>
               <div className="font-medium text-slate-900">{lead.customer?.email || '—'}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Bill Value</div>
               <div className="font-medium text-slate-900">{lead.budgetPerPerson ? `₹${Math.round(lead.budgetPerPerson/100)}` : '—'}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Created</div>
               <div className="font-medium text-slate-900">{formatDate(lead.createdAt)}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Last Contact</div>
               <div className="font-medium text-slate-900">
                 {lead.messages?.length > 0 ? formatDate(lead.messages[0].createdAt) : '—'}
               </div>
             </div>
             <div>
               <div className="text-slate-400 text-xs mb-1">Next Contact</div>
               <div className="font-medium text-slate-900">
                 {lead.followUps?.find(f => f.status === 'Scheduled') ? formatDate(lead.followUps.find(f => f.status === 'Scheduled').scheduledAt) : '—'}
               </div>
             </div>
             <div>
                <div className="text-slate-400 text-xs mb-1 flex items-center justify-between">
                  Assigned To
                </div>
                <div className="font-medium text-slate-900 flex items-center gap-2">
                   <select
                      className="bg-transparent border-0 font-medium text-blue-600 appearance-none p-0 cursor-pointer focus:ring-0 text-sm"
                      value={lead.assignedAgentId || ''}
                      onChange={(e) => updateLead.mutate({ id: lead.id, data: { assignedAgentId: e.target.value }})}
                    >
                      <option value="">— Change</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
             </div>
          </div>
        )}

        {/* Tabs Row */}
        <div className="border-b border-slate-100 px-6 flex gap-6 overflow-x-auto hide-scrollbar shrink-0">
          {['Notes', 'Follow-ups', 'Activity Reports', 'Timeline'].map(tab => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                 activeTab === tab ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
               }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50 hide-scrollbar">
          {!isLoading && lead && (
            <>
              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-[12px] p-1 border border-slate-200 flex flex-col gap-2">
                    <textarea 
                      placeholder="Add a new note..."
                      className="w-full text-sm outline-none border-0 px-3 py-2 bg-transparent resize-none focus:ring-0"
                      rows="3"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                    />
                    <div className="flex justify-end px-2 pb-2">
                      <button 
                        disabled={addNote.isPending || !noteContent.trim()}
                        onClick={() => {
                          addNote.mutate({ id: lead.id, data: { content: noteContent.trim() }});
                          setNoteContent('');
                        }}
                        className="shell-button-primary py-1.5 px-4 text-xs"
                      >
                        {addNote.isPending ? 'Adding...' : 'Add Note'}
                      </button>
                    </div>
                  </div>
                  
                  {(!lead.notesList || lead.notesList.length === 0) ? (
                    <div className="text-center py-10 bg-white border border-slate-100 rounded-xl mt-4">
                      <div className="text-slate-500 text-sm">No notes yet. Add your first note above.</div>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {lead.notesList.map(note => (
                        <div key={note.id} className="bg-white border text-sm border-slate-200 rounded-xl p-4">
                          <div className="whitespace-pre-wrap text-slate-700">{note.content}</div>
                          <div className="mt-3 text-xs text-slate-400 font-medium flex justify-between">
                            <span>{note.agent?.name || 'Agent'}</span>
                            <span>{formatDateTime(note.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Follow-ups' && (
                <div className="space-y-4">
                  <form 
                     className="bg-white rounded-[14px] p-4 border border-emerald-500 shadow-[0_2px_10px_-2px_rgba(16,185,129,0.15)] flex flex-col gap-3"
                     onSubmit={(e) => {
                       e.preventDefault();
                       addFollowup.mutate({ id: lead.id, data: { scheduledAt: new Date(followupDate).toISOString(), note: followupNote }});
                       setFollowupDate(''); setFollowupNote('');
                     }}
                  >
                    <h4 className="text-sm font-bold text-slate-800">Schedule Follow-Up</h4>
                    <input 
                      type="datetime-local" 
                      required
                      value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                      className="shell-input-rect bg-slate-50 text-sm"
                    />
                    <textarea 
                      placeholder="Follow-up note (e.g., Call him back regarding pricing)"
                      className="shell-input-rect bg-slate-50 text-sm py-2 resize-none"
                      rows="2"
                      required
                      value={followupNote}
                      onChange={e => setFollowupNote(e.target.value)}
                    />
                    <button type="submit" disabled={addFollowup.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors w-full">
                       {addFollowup.isPending ? 'Scheduling...' : 'Schedule Follow-Up'}
                    </button>
                  </form>

                  {(!lead.followUps || lead.followUps.length === 0) ? (
                    <div className="text-center py-10 bg-white border border-slate-100 rounded-xl">
                      <div className="text-slate-500 text-sm">No follow-ups scheduled</div>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                       {lead.followUps.map(f => (
                         <div key={f.id} className={`bg-white border p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden ${f.status === 'Done' ? 'border-slate-200 opacity-60' : 'border-blue-100'}`}>
                           {f.status === 'Scheduled' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />}
                           <div className="flex items-center justify-between">
                             <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{f.status}</div>
                             <div className="text-sm font-semibold text-slate-700">{formatDateTime(f.scheduledAt)}</div>
                           </div>
                           <p className="text-sm text-slate-800">{f.note}</p>
                           {f.status === 'Scheduled' && (
                             <div className="flex justify-end mt-2">
                               <button 
                                 className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-100 transition-colors"
                                 onClick={() => updateFollowup.mutate({ id: lead.id, followUpId: f.id, data: { status: 'Done' }})}
                               >
                                 <CheckCircleIcon className="w-4 h-4" /> Mark Done
                               </button>
                             </div>
                           )}
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Activity Reports' && (
                 <div className="text-center py-10 bg-white border border-slate-100 rounded-xl">
                   <div className="text-slate-500 text-sm">No activity reports generated yet.</div>
                 </div>
              )}

              {activeTab === 'Timeline' && (
                 <div className="space-y-4">
                   <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
                     <div className="w-6 flex flex-col items-center shrink-0">
                       <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                         <CheckCircleIcon className="w-4 h-4" />
                       </div>
                       <div className="w-px h-full bg-slate-200 mt-2"></div>
                     </div>
                     <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                           <div>
                             <h4 className="text-sm font-bold text-slate-800">Lead Created</h4>
                             <p className="text-xs text-slate-500 mt-1">Lead {lead.customer?.name} created via {lead.source || 'Bot'}</p>
                           </div>
                           <span className="text-xs text-slate-400">{formatDateTime(lead.createdAt)}</span>
                        </div>
                     </div>
                   </div>

                   {lead.messages?.map((msg, i) => (
                     <div key={msg.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4">
                       <div className="w-6 flex flex-col items-center shrink-0">
                         <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[10px] font-bold">
                           {msg.direction === 'IN' ? 'IN' : 'OUT'}
                         </div>
                         {i !== lead.messages.length - 1 && <div className="w-px h-full bg-slate-200 mt-2"></div>}
                       </div>
                       <div className="flex-1 pb-2">
                          <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <h4 className="text-sm font-bold text-slate-800">{msg.direction === 'IN' ? 'Message Received' : 'Message Sent'}</h4>
                               <p className="text-sm text-slate-600 mt-1 break-words line-clamp-3">{msg.content}</p>
                             </div>
                             <span className="text-xs text-slate-400 pl-4 shrink-0">{formatDateTime(msg.timestamp)}</span>
                          </div>
                       </div>
                     </div>
                   ))}
                 </div>
              )}
            </>
          )}
        </div>

      </aside>
    </div>
  );
}
