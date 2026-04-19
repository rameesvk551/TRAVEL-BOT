import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  TrophyIcon,
  XCircleIcon,
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
  const leadsQuery = useLeads({ pageSize: 200 });
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
      won: leads.filter(l => l.status === 'CONVERTED').length,
      lost: leads.filter(l => l.status === 'LOST').length,
    };
  }, [leads]);

  return (
    <div className="w-full pb-10">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Lead Management</h1>
          <p className="text-neutral-500 mt-1.5 font-medium">Track and manage your sales pipeline with ease</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-neutral-100/80 p-1 rounded-xl flex items-center shadow-inner border border-neutral-200/50">
             <button onClick={() => setView('list')} className={`px-5 py-2 text-sm font-bold rounded-[var(--radius-md)] transition-all duration-300 ${view === 'list' ? 'bg-white shadow-md text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>Table</button>
             <button onClick={() => setView('kanban')} className={`px-5 py-2 text-sm font-bold rounded-[var(--radius-md)] transition-all duration-300 ${view === 'kanban' ? 'bg-white shadow-md text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>Kanban</button>
           </div>
           
           <select className="shell-input-rect bg-white w-32 py-2 h-11 border-neutral-200">
             <option>All Sources</option>
           </select>
           
           <button className="shell-button-secondary h-11 px-5 border-neutral-200 group">
             Newest First
           </button>
           
           <button className="shell-button-primary h-11 px-6 bg-neutral-900 hover:bg-black transition-all group">
             <PlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" /> <span className="ml-1">New Lead</span>
           </button>
        </div>
      </div>
      
      {/* Search & Tabs */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative w-full max-w-sm group">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-neutral-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name, email, phone..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="shell-input-rect pl-11 bg-white h-12 shadow-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 transition-all rounded-xl"
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-neutral-900 text-neutral-900' 
                  : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <div className="kpi-card">
           <div className="flex items-center gap-4">
             <div className="kpi-icon bg-sky-50 text-sky-600">
               <BriefcaseIcon className="w-5 h-5" />
             </div>
             <div>
               <div className="text-2xl font-bold text-neutral-900 leading-none">{metrics.totalDeals}</div>
               <div className="text-[11px] font-semibold text-neutral-400 mt-1 uppercase tracking-wider">Total Deals</div>
             </div>
           </div>
         </div>
         <div className="kpi-card">
           <div className="flex items-center gap-4">
             <div className="kpi-icon bg-emerald-50 text-emerald-600">
               <TrophyIcon className="w-5 h-5" />
             </div>
             <div>
               <div className="text-2xl font-bold text-neutral-900 leading-none">{metrics.won}</div>
               <div className="text-[11px] font-semibold text-neutral-400 mt-1 uppercase tracking-wider">Won</div>
             </div>
           </div>
         </div>
         <div className="kpi-card">
           <div className="flex items-center gap-4">
             <div className="kpi-icon bg-rose-50 text-rose-600">
               <XCircleIcon className="w-5 h-5" />
             </div>
             <div>
               <div className="text-2xl font-bold text-neutral-900 leading-none">{metrics.lost}</div>
               <div className="text-[11px] font-semibold text-neutral-400 mt-1 uppercase tracking-wider">Lost</div>
             </div>
           </div>
         </div>
      </div>
      
      {/* Filters secondary */}
      <div className="flex justify-end mb-4 gap-2">
        <div className="bg-neutral-100 rounded-[var(--radius-sm)] p-0.5 inline-flex text-xs font-medium text-neutral-600">
          <button className="px-3 py-1.5 bg-neutral-900 text-white rounded-md shadow-sm transition-all">All</button>
          <button className="px-3 py-1.5 hover:bg-neutral-200 rounded-md transition-colors">Month</button>
          <button className="px-3 py-1.5 hover:bg-neutral-200 rounded-md transition-colors">Year</button>
          <button className="px-3 py-1.5 hover:bg-neutral-200 rounded-md transition-colors">Custom</button>
        </div>
      </div>

      {/* Main Content Area */}
      {view === 'kanban' ? (
        <LeadPipeline onLeadClick={(lead) => setSelectedLeadId(lead.id)} />
      ) : (
        <div className="data-table-wrapper">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="data-table-head">
                  <th className="data-table-th w-16">SL NO</th>
                  <th className="data-table-th">LEAD</th>
                  <th className="data-table-th">CONTACT</th>
                  <th className="data-table-th">SOURCE</th>
                  <th className="data-table-th">NEXT CONTACT</th>
                  <th className="data-table-th">ASSIGNED TO</th>
                  <th className="data-table-th">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {leadsQuery.isLoading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-sm text-neutral-400">Loading leads...</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-20 text-center">
                      <div className="flex flex-col items-center justify-center animate-fade-in">
                        <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-4 border border-neutral-100 shadow-inner">
                          <BriefcaseIcon className="w-10 h-10 text-neutral-300" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900">No leads found</h3>
                        <p className="text-sm text-neutral-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                          We couldn't find any leads matching your current filters. Try adjusting your search or tabs.
                        </p>
                        <button 
                          onClick={() => {setSearch(''); setActiveTab('All Leads');}}
                          className="mt-6 text-sm font-bold text-neutral-900 hover:underline decoration-2 underline-offset-4 transition-all"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, i) => (
                    <tr 
                      key={lead.id} 
                      className="data-table-row group"
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <td className="data-table-td text-neutral-400 font-medium">#{i + 1}</td>
                      <td className="data-table-td">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-neutral-200">
                            {getInitials(lead.customer?.name, 'L')}
                          </div>
                          <span className="font-semibold text-neutral-900 text-sm">{lead.customer?.name || 'Unnamed Lead'}</span>
                        </div>
                      </td>
                      <td className="data-table-td text-neutral-500">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {lead.customer?.phone && <span>{lead.customer.phone}</span>}
                          {lead.customer?.email && <span className="text-neutral-400">{lead.customer.email}</span>}
                        </div>
                      </td>
                      <td className="data-table-td text-neutral-600">{lead.source?.replace('_', ' ') || 'Direct'}</td>
                      <td className="data-table-td text-neutral-600">
                        {lead.followUps?.length > 0 
                          ? formatDateTime(lead.followUps[0].scheduledAt) 
                          : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="data-table-td" onClick={e => e.stopPropagation()}>
                        <select
                          className="bg-transparent border-0 text-sm font-medium text-neutral-600 cursor-pointer focus:ring-0 appearance-none hover:bg-neutral-50 rounded-md py-1 px-2 transition-colors"
                          value={lead.assignedAgentId || ''}
                          onChange={(e) => updateLead.mutate({ id: lead.id, data: { assignedAgentId: e.target.value }})}
                        >
                          <option value="">Unassigned</option>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="data-table-td" onClick={e => e.stopPropagation()}>
                        <select
                           className={`border-0 appearance-none text-[10px] font-bold rounded-full px-3 py-1 cursor-pointer focus:ring-0 ${getStatusTone(lead.status)}`}
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <aside className="absolute right-0 top-0 h-full w-full max-w-[500px] border-l border-neutral-200 bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-neutral-100 flex items-start justify-between">
          {isLoading ? (
            <div className="animate-pulse flex gap-4 w-full">
              <div className="h-12 w-12 rounded-full bg-neutral-100 shrink-0"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-neutral-100 rounded w-1/2"></div>
                <div className="h-3 bg-neutral-100 rounded w-1/3"></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-600 font-bold flex items-center justify-center text-lg shrink-0 ring-2 ring-neutral-200">
                {getInitials(lead?.customer?.name, 'L')}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 truncate">
                  {lead?.customer?.name || 'Unnamed Lead'}
                </h2>
                <div className="text-sm text-neutral-400 flex items-center gap-2 mt-0.5">
                  <span className={`badge ${getStatusTone(lead?.status)} text-[10px] px-2 py-0.5`}>{lead?.status?.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <PencilIcon className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead Properties Grid */}
        {!isLoading && lead && (
          <div className="px-6 py-4 grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-b border-neutral-100">
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Project</div>
               <div className="font-medium text-neutral-900">—</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Source</div>
               <div className="font-medium text-neutral-900">{lead.source?.replace('_', ' ') || 'organic'}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Contact Person</div>
               <div className="font-medium text-neutral-900">{lead.customer?.name}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Phone</div>
               <div className="font-medium text-neutral-900">{lead.customer?.phone || '—'}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Email</div>
               <div className="font-medium text-neutral-900">{lead.customer?.email || '—'}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Bill Value</div>
               <div className="font-medium text-neutral-900">{lead.budgetPerPerson ? `₹${Math.round(lead.budgetPerPerson/100)}` : '—'}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Created</div>
               <div className="font-medium text-neutral-900">{formatDate(lead.createdAt)}</div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Last Contact</div>
               <div className="font-medium text-neutral-900">
                 {lead.messages?.length > 0 ? formatDate(lead.messages[0].createdAt) : '—'}
               </div>
             </div>
             <div>
               <div className="text-neutral-400 text-xs mb-1 font-medium">Next Contact</div>
               <div className="font-medium text-neutral-900">
                 {lead.followUps?.find(f => f.status === 'Scheduled') ? formatDate(lead.followUps.find(f => f.status === 'Scheduled').scheduledAt) : '—'}
               </div>
             </div>
             <div>
                <div className="text-neutral-400 text-xs mb-1 font-medium">Assigned To</div>
                <div className="font-medium text-neutral-900 flex items-center gap-2">
                   <select
                      className="bg-transparent border-0 font-medium text-neutral-700 appearance-none p-0 cursor-pointer focus:ring-0 text-sm"
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
        <div className="border-b border-neutral-100 px-6 flex gap-6 overflow-x-auto hide-scrollbar shrink-0">
          {['Notes', 'Follow-ups', 'Activity Reports', 'Timeline'].map(tab => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                 activeTab === tab ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
               }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-neutral-50/50 hide-scrollbar">
          {!isLoading && lead && (
            <>
              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-[var(--radius-md)] p-1 border border-neutral-200 flex flex-col gap-2 shadow-sm">
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
                    <div className="text-center py-10 bg-white border border-neutral-200 rounded-[var(--radius-md)] mt-4">
                      <div className="text-neutral-400 text-sm">No notes yet. Add your first note above.</div>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {lead.notesList.map(note => (
                        <div key={note.id} className="bg-white border text-sm border-neutral-200 rounded-[var(--radius-md)] p-4 shadow-sm">
                          <div className="whitespace-pre-wrap text-neutral-600">{note.content}</div>
                          <div className="mt-3 text-xs text-neutral-400 font-medium flex justify-between">
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
                     className="bg-white rounded-[var(--radius-md)] p-4 border border-neutral-200 shadow-sm flex flex-col gap-3"
                     onSubmit={(e) => {
                       e.preventDefault();
                       addFollowup.mutate({ id: lead.id, data: { scheduledAt: new Date(followupDate).toISOString(), note: followupNote }});
                       setFollowupDate(''); setFollowupNote('');
                     }}
                  >
                    <h4 className="text-sm font-bold text-neutral-800">Schedule Follow-Up</h4>
                    <input 
                      type="datetime-local" 
                      required
                      value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                      className="shell-input-rect bg-neutral-50 text-sm"
                    />
                    <textarea 
                      placeholder="Follow-up note (e.g., Call him back regarding pricing)"
                      className="shell-input-rect bg-neutral-50 text-sm py-2 resize-none"
                      rows="2"
                      required
                      value={followupNote}
                      onChange={e => setFollowupNote(e.target.value)}
                    />
                    <button type="submit" disabled={addFollowup.isPending} className="shell-button-primary w-full">
                       {addFollowup.isPending ? 'Scheduling...' : 'Schedule Follow-Up'}
                    </button>
                  </form>

                  {(!lead.followUps || lead.followUps.length === 0) ? (
                    <div className="text-center py-10 bg-white border border-neutral-200 rounded-[var(--radius-md)]">
                      <div className="text-neutral-400 text-sm">No follow-ups scheduled</div>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                       {lead.followUps.map(f => (
                         <div key={f.id} className={`bg-white border p-4 rounded-[var(--radius-md)] flex flex-col gap-2 relative overflow-hidden shadow-sm ${f.status === 'Done' ? 'border-neutral-100 opacity-60' : 'border-neutral-200'}`}>
                           {f.status === 'Scheduled' && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />}
                           <div className="flex items-center justify-between">
                             <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">{f.status}</div>
                             <div className="text-sm font-semibold text-neutral-700">{formatDateTime(f.scheduledAt)}</div>
                           </div>
                           <p className="text-sm text-neutral-600">{f.note}</p>
                           {f.status === 'Scheduled' && (
                             <div className="flex justify-end mt-2">
                               <button 
                                 className="text-xs font-semibold bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-neutral-200 transition-colors"
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
                 <div className="text-center py-10 bg-white border border-neutral-200 rounded-[var(--radius-md)]">
                   <div className="text-neutral-400 text-sm">No activity reports generated yet.</div>
                 </div>
              )}

              {activeTab === 'Timeline' && (
                 <div className="space-y-4">
                   <div className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-4 flex gap-4 shadow-sm">
                     <div className="w-6 flex flex-col items-center shrink-0">
                       <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                         <CheckCircleIcon className="w-4 h-4" />
                       </div>
                       <div className="w-px h-full bg-neutral-200 mt-2"></div>
                     </div>
                     <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                           <div>
                             <h4 className="text-sm font-bold text-neutral-800">Lead Created</h4>
                             <p className="text-xs text-neutral-400 mt-1">Lead {lead.customer?.name} created via {lead.source || 'Bot'}</p>
                           </div>
                           <span className="text-xs text-neutral-400">{formatDateTime(lead.createdAt)}</span>
                        </div>
                     </div>
                   </div>

                   {lead.messages?.map((msg, i) => (
                     <div key={msg.id} className="bg-white border border-neutral-200 rounded-[var(--radius-md)] p-4 flex gap-4 shadow-sm">
                       <div className="w-6 flex flex-col items-center shrink-0">
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${msg.direction === 'IN' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
                           {msg.direction === 'IN' ? 'IN' : 'OUT'}
                         </div>
                         {i !== lead.messages.length - 1 && <div className="w-px h-full bg-neutral-200 mt-2"></div>}
                       </div>
                       <div className="flex-1 pb-2">
                          <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <h4 className="text-sm font-bold text-neutral-800">{msg.direction === 'IN' ? 'Message Received' : 'Message Sent'}</h4>
                               <p className="text-sm text-neutral-500 mt-1 break-words line-clamp-3">{msg.content}</p>
                             </div>
                             <span className="text-xs text-neutral-400 pl-4 shrink-0">{formatDateTime(msg.timestamp)}</span>
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
