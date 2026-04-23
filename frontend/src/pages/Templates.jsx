import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Image as ImageIcon, FileText, CheckCircle, Clock, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { usePrebuiltTemplates, useAgencyTemplates, useSyncTemplates } from '../hooks/useTemplates';
import TemplateDetailDrawer from '../components/TemplateDetailDrawer';
import toast from 'react-hot-toast';

export default function Templates() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isPrebuilt, setIsPrebuilt] = useState(false);

  const { data: prebuiltData, isLoading: prebuiltLoading } = usePrebuiltTemplates({ search: searchQuery });
  const { data: agencyData, isLoading: agencyLoading } = useAgencyTemplates({ search: searchQuery });
  const { mutate: syncTemplates, isPending: isSyncing } = useSyncTemplates();

  const prebuiltTemplates = prebuiltData?.data || [];
  const agencyTemplates = agencyData?.data || [];
  const filteredAgencyTemplates = agencyTemplates
    .filter(t => activeTab === 'All' || String(t.status || 'DRAFT').toLowerCase() === activeTab.toLowerCase())
    .filter(t => categoryFilter === 'ALL' || t.category === categoryFilter);

  const handleSync = () => {
    syncTemplates(null, {
      onSuccess: (res) => {
        toast.success(`Successfully synced ${res.data?.count || 0} templates from Meta`);
        setActiveTab('Approved');
      },
      onError: (err) => {
        toast.error(err.response?.data?.error || 'Failed to sync templates');
      }
    });
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setIsPrebuilt(false);
    setIsDrawerOpen(true);
  };

  const handlePreview = (template, prebuilt) => {
    setSelectedTemplate(template);
    setIsPrebuilt(prebuilt);
    setIsDrawerOpen(true);
  };

  const handleUseTemplate = (template) => {
    setSelectedTemplate(template);
    setIsPrebuilt(true);
    setIsDrawerOpen(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setIsPrebuilt(false);
    setIsDrawerOpen(true);
  };

  if (prebuiltLoading || agencyLoading) return <div className="p-8 text-center text-neutral-400">Loading templates...</div>;

  return (
    <>
      <div className="w-full space-y-6 page-enter">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-heading">Template Messages</h1>
            <p className="page-subtext mt-1">Manage standard replies and marketing broadcasts.</p>
          </div>
          <button
            onClick={handleNewTemplate}
            className="shell-button-primary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search templates (name, content, etc.)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 focus:outline-none text-sm"
            />
          </div>
          <div className="hidden h-8 w-px bg-neutral-200 sm:block"></div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-[var(--radius-sm)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Status'}
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-neutral-200 hide-scrollbar">
          {['All', 'Draft', 'Pending', 'Approved', 'Rejected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === tab
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          {/* Categories Sidebar */}
          <div className="w-full shrink-0 space-y-2 lg:w-64 lg:space-y-1">
            <p className="eyebrow px-1 lg:mb-3 lg:px-3">Categories</p>
            <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1 hide-scrollbar">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] transition-colors text-sm font-medium ${categoryFilter === cat.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
            </div>
          </div>

          {/* Template Grid */}
          <div className="flex-1 space-y-8">

            {/* Preset Gallery */}
            {activeTab === 'All' && prebuiltTemplates.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Preset Gallery</p>
                    <h2 className="text-xl font-bold text-neutral-900 mt-1">Travel templates</h2>
                    <p className="text-sm text-neutral-400">Pick a prebuilt starting point and turn it into a send-ready WhatsApp template.</p>
                  </div>
                  <span className="text-sm text-neutral-400">{prebuiltTemplates.length} templates</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {prebuiltTemplates
                    .filter(t => categoryFilter === 'ALL' || t.category === categoryFilter)
                    .map(t => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        isPrebuilt={true}
                        onPreview={() => handlePreview(t, true)}
                        onAction={() => handleUseTemplate(t)}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Agency Library */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Saved Library</p>
                  <h2 className="text-xl font-bold text-neutral-900 mt-1">Your saved templates</h2>
                  <p className="text-sm text-neutral-400">Review the templates already in your workspace.</p>
                </div>
                <span className="text-sm text-neutral-400">{agencyTemplates.length} templates</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAgencyTemplates
                  .map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isPrebuilt={false}
                      onPreview={() => handlePreview(t, false)}
                      onAction={() => handleEdit(t)}
                    />
                  ))}

                {filteredAgencyTemplates.length === 0 && (
                  <div className="col-span-full py-12 text-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-[var(--radius-lg)]">
                    No {activeTab === 'All' ? '' : activeTab.toLowerCase()} templates found matching your criteria.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <TemplateDetailDrawer
        template={selectedTemplate}
        isOpen={isDrawerOpen}
        isPrebuilt={isPrebuilt}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}

function TemplateCard({ template, isPrebuilt, onPreview, onAction }) {
  const isCarousel = String(template.templateType || '').toUpperCase() === 'CAROUSEL';
  const carouselCardCount = Array.isArray(template.carouselCards) ? template.carouselCards.length : 0;

  return (
    <div
      className="section-card p-5 hover:shadow-md transition-shadow flex flex-col items-start gap-4 h-full relative cursor-pointer group"
      onClick={onPreview}
    >
      <div className="flex items-start justify-between w-full">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ring-1 ring-neutral-200 ${isPrebuilt ? 'bg-indigo-50' : 'bg-neutral-50'}`}>
          {template.icon || '💬'}
        </div>
        {isPrebuilt ? (
          <span className="badge bg-indigo-50 text-indigo-600">PREBUILT</span>
        ) : (
          <StatusBadge status={template.status} />
        )}
      </div>

      <div className="flex-1 w-full space-y-2">
        <h3 className="font-bold text-neutral-900">{template.displayName}</h3>
        <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider">
          <span className="flex items-center gap-1 text-neutral-600">
            {isCarousel ? <Layers className="w-3 h-3" /> : template.headerType !== 'NONE' ? <ImageIcon className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
            {isCarousel ? 'CAROUSEL' : template.headerType === 'NONE' ? 'TEXT' : template.headerType}
          </span>
          <span className="text-neutral-300">•</span>
          <span className="text-neutral-400">{template.category}</span>
          {isCarousel && (
            <>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-400">{carouselCardCount} cards</span>
            </>
          )}
        </div>

        <p className="text-sm text-neutral-500 line-clamp-3 mt-3">{template.body?.replace(/{{[1-9]}}/g, '___')}</p>
        {template.status === 'REJECTED' && template.rejectionReason && (
          <p className="rounded-[var(--radius-sm)] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 line-clamp-2">
            {template.rejectionReason}
          </p>
        )}
      </div>

      <div className="flex gap-2 w-full pt-4 border-t border-neutral-100 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="flex-1 py-2 text-sm font-semibold rounded-[var(--radius-sm)] border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Preview
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className="flex-1 py-2 text-sm font-semibold rounded-[var(--radius-sm)] bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
        >
          {isPrebuilt ? 'Use Template' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'APPROVED':
      return <span className="badge bg-emerald-50 text-emerald-700"><CheckCircle className="w-3 h-3" /> APPROVED</span>;
    case 'PENDING':
      return <span className="badge bg-amber-50 text-amber-700"><Clock className="w-3 h-3" /> PENDING</span>;
    case 'REJECTED':
      return <span className="badge bg-rose-50 text-rose-700"><AlertCircle className="w-3 h-3" /> REJECTED</span>;
    default:
      return <span className="badge bg-neutral-100 text-neutral-500">DRAFT</span>;
  }
}
