import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Send, Copy, Trash2,
  MoreHorizontal, Megaphone, Gift, RotateCcw, Sparkles, Download,
  CheckCircle2, Eye, XCircle, Upload, FileText,
} from 'lucide-react';
import {
  useCampaigns, useCampaignAnalytics, useSendCampaign, useDuplicateCampaign, useDeleteCampaign,
} from '../hooks/useCampaigns';
import { formatDateTime } from '../utils/formatters';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'SENDING', label: 'Sending' },
  { key: 'SENT', label: 'Sent' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const TYPE_FILTERS = [
  { key: '', label: 'All Types' },
  { key: 'BROADCAST', label: 'Broadcast' },
  { key: 'PROMOTIONAL', label: 'Promotional' },
  { key: 'RE_ENGAGEMENT', label: 'Re-engagement' },
  { key: 'SEASONAL', label: 'Seasonal' },
  { key: 'REVIEW_COLLECTION', label: 'Reviews' },
];

const TYPE_ICONS = {
  BROADCAST: Megaphone,
  PROMOTIONAL: Gift,
  RE_ENGAGEMENT: RotateCcw,
  SEASONAL: Sparkles,
  REVIEW_COLLECTION: Sparkles,
};

const STATUS_BADGE = {
  SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  SENDING: 'bg-sky-50 text-sky-700 border-sky-200',
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELLED: 'bg-rose-50 text-rose-600 border-rose-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
};

function number(value) {
  return Number(value || 0).toLocaleString();
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  const queryParams = useMemo(() => ({
    pageSize: 100,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
  }), [statusFilter, typeFilter, fromDate, toDate, searchQuery]);

  const { data, isLoading } = useCampaigns(queryParams);
  const { data: analyticsData } = useCampaignAnalytics(queryParams);
  const sendMutation = useSendCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const deleteMutation = useDeleteCampaign();

  const campaigns = data?.data || [];
  const summary = data?.summary || analyticsData?.data || {};

  const handleRowClick = (id) => navigate(`/campaigns/${id}`);

  const clearFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  const handleExport = () => {
    const rows = [
      ['Campaign', 'Type', 'Status', 'Total Recipients', 'Sent', 'Delivered', 'Read', 'Replied', 'Failed', 'Created At', 'Sent At'],
      ...campaigns.map((c) => [
        c.name,
        c.type,
        c.status,
        c.totalRecipients || 0,
        c.sent || 0,
        c.delivered || 0,
        c.read || 0,
        c.replied || 0,
        c.failed || 0,
        c.createdAt ? formatDateTime(c.createdAt) : '',
        c.sentAt ? formatDateTime(c.sentAt) : '',
      ]),
    ];
    downloadCsv(`campaign-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const reportCards = [
    { label: 'Total Campaigns', value: summary.totalCampaigns ?? data?.total ?? campaigns.length, icon: Megaphone, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Total Recipients', value: summary.totalRecipients, icon: Users, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Sent', value: summary.totalSent, icon: Send, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Delivered', value: summary.totalDelivered, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Read', value: summary.totalRead, icon: Eye, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Failed', value: summary.totalFailed, icon: XCircle, tone: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in md:p-2">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="page-heading">Campaign Reports</h1>
          <p className="page-subtext mt-1">Track total campaigns, sent, delivered, read, replied, and failed WhatsApp delivery.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => navigate('/campaigns/reports')}
            className="shell-button-secondary w-full sm:w-auto"
          >
            <FileText className="w-4 h-4" />
            Reports
          </button>
          <button
            onClick={() => navigate('/campaigns/new?audience=import')}
            className="shell-button-secondary w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            Import CSV Campaign
          </button>
          <button
            onClick={() => navigate('/campaigns/new')}
            className="shell-button-primary w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="kpi-card flex items-center gap-4">
              <div className={`kpi-icon ${card.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900">{number(card.value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex gap-1 overflow-x-auto hide-scrollbar min-w-0 -mx-1 px-1 pb-1 xl:pb-0 xl:mx-0 xl:px-0">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`whitespace-nowrap flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f.key
                      ? 'bg-[#2d2d2d] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:ml-auto xl:w-auto xl:grid-cols-[170px_150px_150px_auto_auto]">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
              >
                {TYPE_FILTERS.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
              />
              <button
                onClick={handleExport}
                disabled={campaigns.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="relative mt-3 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-white p-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Delivery Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.deliveryRate || 0}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Read Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.readRate || 0}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Failure Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.failureRate || 0}%</p>
          </div>
        </div>

        <div className="mobile-card-list min-h-[300px] p-3">
          {isLoading ? (
            <div className="mobile-record-card text-center text-sm text-slate-500">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="mobile-record-card text-center text-slate-500">
              <Megaphone className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <p className="text-base font-bold text-slate-900">No campaigns found</p>
              <button onClick={() => navigate('/campaigns/new')} className="mt-4 shell-button-primary">Create Campaign</button>
            </div>
          ) : (
            campaigns.map((c) => {
              const TypeIcon = TYPE_ICONS[c.type] || Megaphone;
              const readRate = Math.round(((c.read || 0) / Math.max(1, c.totalRecipients || 0)) * 100);
              return (
                <MobileRecordCard
                  key={c.id}
                  title={c.name}
                  subtitle={String(c.type || '').replace('_', '-')}
                  onClick={() => handleRowClick(c.id)}
                  avatar={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><TypeIcon className="h-5 w-5" /></div>}
                  badge={<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[c.status] || ''}`}>{c.status}</span>}
                  actions={
                    <>
                      {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                        <button type="button" onClick={() => sendMutation.mutate(c.id)} className="shell-button-secondary flex-1 py-2 text-xs">Send</button>
                      )}
                      <button type="button" onClick={() => duplicateMutation.mutate(c.id)} className="shell-button-secondary flex-1 py-2 text-xs">Duplicate</button>
                      {c.status === 'DRAFT' && (
                        <button type="button" onClick={() => { if (confirm('Delete this draft campaign?')) deleteMutation.mutate(c.id); }} className="shell-button-secondary flex-1 py-2 text-xs text-rose-600">Delete</button>
                      )}
                    </>
                  }
                >
                  <MobileField label="Recipients" value={number(c.totalRecipients)} />
                  <MobileField label="Sent" value={number(c.sent)} />
                  <MobileField label="Delivered" value={number(c.delivered)} />
                  <MobileField label="Read Rate" value={c.status === 'DRAFT' || !c.totalRecipients ? '-' : `${readRate}%`} />
                </MobileRecordCard>
              );
            })
          )}
        </div>

        <div className="hidden min-h-[300px] overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 border-b border-slate-200">
                <th className="p-4">Campaign</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Recipients</th>
                <th className="p-4 text-right">Sent</th>
                <th className="p-4 text-right">Delivered</th>
                <th className="p-4 text-right">Read</th>
                <th className="p-4 text-right">Failed</th>
                <th className="p-4">Date</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center">
                    <div className="w-8 h-8 border-3 border-slate-200 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading campaigns...</p>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Megaphone className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">No campaigns found</p>
                    <p className="mt-1 mb-4 text-sm">Create a campaign or clear filters to see more results.</p>
                    <button
                      onClick={() => navigate('/campaigns/new')}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2d2d2d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a1a1a]"
                    >
                      <Plus className="w-4 h-4" /> Create Campaign
                    </button>
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const TypeIcon = TYPE_ICONS[c.type] || Megaphone;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                      onClick={() => handleRowClick(c.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-slate-200 group-hover:text-slate-900">
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-[#2d2d2d] transition-colors">{c.name}</div>
                            <div className="text-xs text-slate-400">{String(c.type || '').replace('_', '-')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE[c.status] || ''}`}>
                          {c.status === 'SENDING' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium text-slate-700">{number(c.totalRecipients)}</td>
                      <td className="p-4 text-right font-medium text-slate-700">{number(c.sent)}</td>
                      <td className="p-4 text-right font-medium text-slate-700">{number(c.delivered)}</td>
                      <td className="p-4 text-right font-medium text-slate-700">{number(c.read)}</td>
                      <td className="p-4 text-right font-medium text-slate-700">{number(c.failed)}</td>
                      <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                        {c.status === 'SENT' ? formatDateTime(c.sentAt) :
                         c.status === 'SCHEDULED' ? formatDateTime(c.scheduledAt) :
                         formatDateTime(c.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Campaign actions"
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
