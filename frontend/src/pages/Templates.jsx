import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Image as ImageIcon, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { usePrebuiltTemplates, useAgencyTemplates } from '../hooks/useTemplates';

export default function Templates() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const { data: prebuiltData, isLoading: prebuiltLoading } = usePrebuiltTemplates({ search: searchQuery });
  const { data: agencyData, isLoading: agencyLoading } = useAgencyTemplates({ search: searchQuery });

  const prebuiltTemplates = prebuiltData?.data || [];
  const agencyTemplates = agencyData?.data || [];

  if (prebuiltLoading || agencyLoading) return <div className="p-8 text-center text-slate-500">Loading templates...</div>;

  return (
    <div className="p-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Template Messages</h1>
          <p className="text-slate-500 mt-1">Manage standard replies and marketing broadcasts.</p>
        </div>
        <button className="shell-button-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates (name, content, etc.)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="h-8 w-px bg-slate-200"></div>
        <button className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">
          ⟳ Sync Status
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        {['All', 'Draft', 'Pending', 'Approved', 'Rejected'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex gap-8 items-start">
        {/* Categories Sidebar */}
        <div className="w-64 shrink-0 space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Categories</p>
          {[
            { id: 'ALL', name: 'All Templates', icon: MessageSquare },
            { id: 'MARKETING', name: 'Marketing', icon: MessageSquare },
            { id: 'UTILITY', name: 'Utility', icon: FileText },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                  categoryFilter === cat.id
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Template Grid */}
        <div className="flex-1 space-y-8">
          
          {/* Preset Gallery */}
          {(activeTab === 'All' || activeTab === 'Approved') && prebuiltTemplates.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preset Gallery</p>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">Travel templates</h2>
                  <p className="text-sm text-slate-500">Pick a prebuilt starting point and turn it into a send-ready WhatsApp template.</p>
                </div>
                <span className="text-sm text-slate-500">{prebuiltTemplates.length} templates</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {prebuiltTemplates
                  .filter(t => categoryFilter === 'ALL' || t.category === categoryFilter)
                  .map(t => (
                    <TemplateCard key={t.id} template={t} isPrebuilt={true} />
                ))}
              </div>
            </div>
          )}

          {/* Agency Library */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saved Library</p>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">Your saved templates</h2>
                  <p className="text-sm text-slate-500">Review the templates already in your workspace.</p>
                </div>
                <span className="text-sm text-slate-500">{agencyTemplates.length} templates</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {agencyTemplates
                  .filter(t => activeTab === 'All' || t.status.toLowerCase() === activeTab.toLowerCase())
                  .filter(t => categoryFilter === 'ALL' || t.category === categoryFilter)
                  .map(t => (
                    <TemplateCard key={t.id} template={t} isPrebuilt={false} />
                ))}
                
                {agencyTemplates.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                    No templates found matching your criteria.
                  </div>
                )}
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, isPrebuilt }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-start gap-4 h-full relative cursor-pointer">
      <div className="flex items-start justify-between w-full">
         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm border border-slate-100 ${isPrebuilt ? 'bg-indigo-50' : 'bg-teal-50'}`}>
            {template.icon || '💬'}
         </div>
         {isPrebuilt ? (
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">PREBUILT</span>
         ) : (
            <StatusBadge status={template.status} />
         )}
      </div>

      <div className="flex-1 w-full space-y-2">
        <h3 className="font-bold text-slate-900">{template.displayName}</h3>
        <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider">
          <span className={`flex items-center gap-1 ${template.headerType === 'IMAGE' ? 'text-amber-600' : 'text-blue-600'}`}>
            {template.headerType !== 'NONE' ? <ImageIcon className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
            {template.headerType === 'NONE' ? 'TEXT' : template.headerType}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">{template.category}</span>
        </div>
        
        <p className="text-sm text-slate-600 line-clamp-3 mt-3">{template.body.replace(/{{[1-9]}}/g, '___')}</p>
      </div>

      <div className="flex gap-2 w-full pt-4 border-t border-slate-100 mt-auto">
        <button className="flex-1 py-2 text-sm font-semibold rounded border border-slate-200 text-teal-700 hover:bg-slate-50 transition-colors">
          Preview
        </button>
        <button className="flex-1 py-2 text-sm font-semibold rounded bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200">
          {isPrebuilt ? 'Use Template' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'APPROVED':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 text-teal-700 text-xs font-bold"><CheckCircle className="w-3 h-3" /> APPROVED</span>;
    case 'PENDING':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold"><Clock className="w-3 h-3" /> PENDING</span>;
    case 'REJECTED':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold"><AlertCircle className="w-3 h-3" /> REJECTED</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">DRAFT</span>;
  }
}
