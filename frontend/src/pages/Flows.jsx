import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FlowDetailDrawer from '../components/FlowDetailDrawer';
import { useDeleteFlow, useFlows, usePublishFlow, useSyncFlows } from '../hooks/useFlows';

export default function Flows() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useFlows({});
  const syncMutation = useSyncFlows();
  const publishMutation = usePublishFlow();
  const deleteMutation = useDeleteFlow();

  const flows = useMemo(() => data?.data || [], [data]);
  const filteredFlows = flows.filter((flow) => {
    const matchesTab = activeTab === 'All' || String(flow.status || '').toLowerCase() === activeTab.toLowerCase();
    const matchesSearch = !searchQuery || String(flow.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const openNewFlow = () => {
    setSelectedFlow(null);
    setDrawerOpen(true);
  };

  const openEditFlow = (flow) => {
    setSelectedFlow(flow);
    setDrawerOpen(true);
  };

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (result) => toast.success(`Synced ${result?.data?.count || result?.count || 0} flows`),
      onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to sync flows'),
    });
  };

  const handlePublish = (flow) => {
    publishMutation.mutate(flow.id, {
      onSuccess: () => toast.success(`Published ${flow.name}`),
      onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to publish flow'),
    });
  };

  const handleDelete = (flow) => {
    deleteMutation.mutate(flow.id, {
      onSuccess: () => toast.success(`Deleted ${flow.name}`),
      onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to delete flow'),
    });
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-400">Loading flows...</div>;

  return (
    <>
      <div className="w-full space-y-6 page-enter">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-heading">WhatsApp Flows</h1>
            <p className="page-subtext mt-1">Build company-specific flows, sync existing drafts from Meta, and publish from one library.</p>
          </div>
          <button type="button" onClick={openNewFlow} className="shell-button-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            New Flow
          </button>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Flow Builder</p>
              <h2 className="mt-1 text-xl font-bold text-neutral-900">Manage flow drafts and published flows</h2>
              <p className="mt-1 text-sm text-neutral-500">Existing company flows synced from Meta appear here, including drafts that can be edited and published.</p>
            </div>
            <button type="button" onClick={handleSync} disabled={syncMutation.isPending} className="shell-button-secondary">
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync From Meta
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search flows"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-none bg-transparent py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <div className="flex overflow-x-auto border-b border-neutral-200 hide-scrollbar">
          {['All', 'Draft', 'Published', 'Failed', 'Archived'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-bold transition ${activeTab === tab ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {filteredFlows.map((flow) => (
            <div key={flow.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-neutral-900">{flow.name}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">{flow.flowType}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${flow.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : flow.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {flow.status}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-xs text-neutral-500">
                <p>Meta ID: {flow.metaFlowId || 'Draft only'}</p>
                <p>Endpoint: {flow.endpointUri || '-'}</p>
                <p>Validation errors: {Array.isArray(flow.validationErrors) ? flow.validationErrors.length : 0}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEditFlow(flow)} className="shell-button-secondary min-h-10 px-3">Edit</button>
                <button type="button" onClick={() => handlePublish(flow)} className="shell-button-secondary min-h-10 px-3">
                  <Send className="h-4 w-4" />
                  Publish
                </button>
                <button type="button" onClick={() => handleDelete(flow)} className="shell-button-secondary min-h-10 px-3 text-rose-600">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filteredFlows.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-neutral-500">
              No flows found. Sync from Meta or create a new company flow.
            </div>
          )}
        </div>
      </div>

      <FlowDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        flow={selectedFlow}
      />
    </>
  );
}
