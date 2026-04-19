import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Activity, BarChart2, Send, Copy, Trash2,
  MoreHorizontal, Ban, Megaphone, Gift, RotateCcw, Sparkles,
} from 'lucide-react';
import {
  useCampaigns, useSendCampaign, useDuplicateCampaign, useDeleteCampaign,
} from '../hooks/useCampaigns';
import { formatDateTime } from '../utils/formatters';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'SENDING', label: 'Sending' },
  { key: 'SENT', label: 'Sent' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const TYPE_ICONS = {
  BROADCAST: Megaphone,
  PROMOTIONAL: Gift,
  RE_ENGAGEMENT: RotateCcw,
  SEASONAL: Sparkles,
};

const STATUS_BADGE = {
  SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  SENDING: 'bg-sky-50 text-sky-700 border-sky-200',
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELLED: 'bg-rose-50 text-rose-600 border-rose-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  const queryParams = statusFilter ? { status: statusFilter } : {};
  const { data, isLoading } = useCampaigns(queryParams);
  const sendMutation = useSendCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const deleteMutation = useDeleteCampaign();

  const campaigns = data?.data || [];
  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCampaigns = campaigns.filter((c) => c.status === 'SENDING' || c.status === 'SCHEDULED').length;
  const totalReached = campaigns.reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
  const totalRead = campaigns.reduce((sum, c) => sum + c.read, 0);
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  const handleRowClick = (id) => navigate(`/campaigns/${id}`);

  return (
    <div className="p-6 md:p-8 space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-heading">Push Campaigns</h1>
          <p className="page-subtext mt-1">Broadcast promotional messages to segmented audiences.</p>
        </div>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="shell-button-primary self-start"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="kpi-card flex gap-4 items-center">
          <div className="kpi-icon bg-sky-50 text-sky-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Active</p>
            <p className="text-2xl font-bold text-slate-900">{activeCampaigns}</p>
          </div>
        </div>

        <div className="kpi-card flex gap-4 items-center">
          <div className="kpi-icon bg-indigo-50 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Total Reached</p>
            <p className="text-2xl font-bold text-slate-900">{totalReached.toLocaleString()}</p>
          </div>
        </div>

        <div className="kpi-card flex gap-4 items-center">
          <div className="kpi-icon bg-amber-50 text-amber-600">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Read Rate</p>
            <p className="text-2xl font-bold text-slate-900">{readRate}%</p>
          </div>
        </div>

        <div className="kpi-card flex gap-4 items-center">
          <div className="kpi-icon bg-violet-50 text-violet-600">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Total Campaigns</p>
            <p className="text-2xl font-bold text-slate-900">{campaigns.length}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50/50">
          {/* Status Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === f.key
                    ? 'bg-[#2d2d2d] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-[#f0f0f0]0 focus:ring-2 focus:ring-[#f0f0f0]0/20 outline-none transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 border-b border-slate-200">
                <th className="p-4">Campaign</th>
                <th className="p-4">Status</th>
                <th className="p-4">Template</th>
                <th className="p-4 text-right">Recipients</th>
                <th className="p-4 text-center">Performance</th>
                <th className="p-4">Date</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="w-8 h-8 border-3 border-[#f0f0f0]0 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading campaigns...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Megaphone className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {searchQuery ? 'No campaigns match your search' : 'No campaigns yet'}
                    </p>
                    <p className="mt-1 mb-4 text-sm">Start reaching your audience with push campaigns.</p>
                    <button
                      onClick={() => navigate('/campaigns/new')}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2d2d2d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a1a1a]"
                    >
                      <Plus className="w-4 h-4" /> Create Your First Campaign
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const TypeIcon = TYPE_ICONS[c.type] || Megaphone;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                      onClick={() => handleRowClick(c.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-[#f0f0f0] group-hover:text-[#404040] transition">
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-[#2d2d2d] transition-colors">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.type.replace('_', '-')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[c.status] || ''}`}>
                          {c.status === 'SENDING' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {c.template?.displayName || <span className="text-slate-400">Custom</span>}
                      </td>
                      <td className="p-4 text-right font-medium text-slate-700">
                        {c.totalRecipients.toLocaleString()}
                      </td>
                      <td className="p-4 w-52">
                        {c.status === 'DRAFT' || c.totalRecipients === 0 ? (
                          <span className="text-slate-400 text-sm">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden flex">
                              <div className="bg-[#f0f0f0]0 h-full rounded-l-full" style={{ width: `${Math.max(2, (c.read / Math.max(1, c.totalRecipients)) * 100)}%` }} />
                              <div className="bg-[#b0b0b0] h-full" style={{ width: `${Math.max(0, ((c.delivered - c.read) / Math.max(1, c.totalRecipients)) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                              {Math.round((c.read / Math.max(1, c.totalRecipients)) * 100)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                        {c.status === 'SENT' ? formatDateTime(c.sentAt) :
                         c.status === 'SCHEDULED' ? formatDateTime(c.scheduledAt) :
                         formatDateTime(c.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuOpen === c.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(null); }} />
                              <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                                {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sendMutation.mutate(c.id);
                                      setMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Send className="w-3.5 h-3.5" /> Send Now
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateMutation.mutate(c.id);
                                    setMenuOpen(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Copy className="w-3.5 h-3.5" /> Duplicate
                                </button>
                                {c.status === 'DRAFT' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Delete this draft campaign?')) {
                                        deleteMutation.mutate(c.id);
                                      }
                                      setMenuOpen(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
