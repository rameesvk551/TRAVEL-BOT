import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart2, CheckCircle2, Download, Eye, FileText,
  Megaphone, MessageCircle, RotateCcw, Search, Send, XCircle,
} from 'lucide-react';
import { useCampaignReports, useCampaigns } from '../hooks/useCampaigns';
import { campaignsApi } from '../api/campaignsApi';
import { formatDateTime } from '../utils/formatters';
import Pagination from '../components/Pagination';

const REPORT_STATUS_FILTERS = [
  { key: '', label: 'All messages' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'READ', label: 'Read' },
  { key: 'REPLIED', label: 'Replied' },
  { key: 'FAILED', label: 'Failed' },
];

const TYPE_FILTERS = [
  { key: '', label: 'All Types' },
  { key: 'BROADCAST', label: 'Broadcast' },
  { key: 'PROMOTIONAL', label: 'Promotional' },
  { key: 'RE_ENGAGEMENT', label: 'Re-engagement' },
  { key: 'SEASONAL', label: 'Seasonal' },
  { key: 'REVIEW_COLLECTION', label: 'Reviews' },
];

const STATUS_TONES = {
  SENT: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  READ: 'bg-violet-50 text-violet-700',
  REPLIED: 'bg-indigo-50 text-indigo-700',
  FAILED: 'bg-rose-50 text-rose-700',
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

function DetailDate({ value }) {
  return <span className="whitespace-nowrap text-xs text-slate-500">{value ? formatDateTime(value) : '-'}</span>;
}

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

export default function CampaignReports() {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState('');
  const [recipientStatus, setRecipientStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientPage, setRecipientPage] = useState(1);
  const recipientPageSize = 15;
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 450);

  const campaignListParams = useMemo(() => ({
    pageSize: 250,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
    ...(debouncedSearchQuery.trim() ? { q: debouncedSearchQuery.trim() } : {}),
  }), [debouncedSearchQuery, fromDate, toDate, typeFilter]);

  const reportParams = useMemo(() => ({
    ...campaignListParams,
    page: recipientPage,
    pageSize: recipientPageSize,
    ...(campaignId ? { campaignId } : {}),
    ...(recipientStatus ? { recipientStatus } : {}),
  }), [campaignId, campaignListParams, recipientPage, recipientPageSize, recipientStatus]);

  const exportParams = useMemo(() => ({
    ...campaignListParams,
    page: 1,
    pageSize: 50000,
    ...(campaignId ? { campaignId } : {}),
    ...(recipientStatus ? { recipientStatus } : {}),
  }), [campaignId, campaignListParams, recipientStatus]);

  const { data: campaignsData } = useCampaigns(campaignListParams);
  const { data: reportsData, isLoading, isFetching } = useCampaignReports(reportParams);

  const campaigns = campaignsData?.data || [];
  const report = reportsData?.data || {};
  const reportCampaigns = report.campaigns || [];
  const reportRecipients = report.recipients || [];
  const summary = report.summary || {};
  const pagination = report.pagination || {};

  useEffect(() => {
    setRecipientPage(1);
  }, [campaignId, debouncedSearchQuery, fromDate, recipientStatus, toDate, typeFilter]);

  const clearFilters = () => {
    setCampaignId('');
    setRecipientStatus('');
    setTypeFilter('');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setRecipientPage(1);
  };

  const exportRecipients = async () => {
    setIsExporting(true);
    const scopeSlug = campaignId ? 'campaign' : 'consolidated';
    const statusSlug = recipientStatus ? recipientStatus.toLowerCase() : 'all-statuses';
    try {
      const response = await campaignsApi.reports(exportParams);
      const recipients = response?.data?.recipients || [];
      const rows = [
        ['Name', 'Phone Number'],
        ...recipients.map((r) => [
          r.customerName,
          r.phone,
        ]),
      ];
      downloadCsv(`campaign-recipient-${scopeSlug}-${statusSlug}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } finally {
      setIsExporting(false);
    }
  };

  const exportCampaigns = () => {
    const rows = [
      ['Campaign', 'Type', 'Status', 'Matching Recipients', 'Sent Only', 'Delivered Only', 'Read Only', 'Replied', 'Failed', 'Created At', 'Sent At'],
      ...reportCampaigns.map((c) => [
        c.name,
        c.type,
        c.status,
        c.total || 0,
        c.sent || 0,
        c.delivered || 0,
        c.read || 0,
        c.replied || 0,
        c.failed || 0,
        c.createdAt ? formatDateTime(c.createdAt) : '',
        c.sentAt ? formatDateTime(c.sentAt) : '',
      ]),
    ];
    downloadCsv(`campaign-wise-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const statCards = [
    { key: 'SENT', label: 'Sent', value: summary.sent, icon: Send, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { key: 'DELIVERED', label: 'Delivered', value: summary.delivered, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { key: 'READ', label: 'Read', value: summary.read, icon: Eye, tone: 'bg-violet-50 text-violet-700 border-violet-100' },
    { key: 'REPLIED', label: 'Replied', value: summary.replied, icon: MessageCircle, tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { key: 'FAILED', label: 'Failed', value: summary.failed, icon: XCircle, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in md:p-2">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/campaigns')}
            className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="page-heading">Campaign Reports</h1>
            <p className="page-subtext mt-1">Full delivery report with consolidated, campaign-wise, and customer-number exports.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={exportRecipients}
            disabled={isLoading || isExporting || summary.recipientRows === 0}
            className="shell-button-secondary w-full sm:w-auto disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Numbers'}
          </button>
          <button
            onClick={exportCampaigns}
            disabled={isLoading || reportCampaigns.length === 0}
            className="shell-button-primary w-full sm:w-auto disabled:opacity-50"
          >
            <BarChart2 className="h-4 w-4" />
            Campaign CSV
          </button>
        </div>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px_minmax(220px,1fr)_auto]">
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="">All campaigns consolidated</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>

          <select
            value={recipientStatus}
            onChange={(e) => setRecipientStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
          >
            {REPORT_STATUS_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>{filter.label}</option>
            ))}
          </select>

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

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
            />
            <button
              onClick={clearFilters}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Reset
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-600 outline-none focus:border-slate-400"
            />
          </div>
        </div>
        {searchQuery !== debouncedSearchQuery && (
          <p className="mt-2 text-xs font-medium text-slate-400">Searching after you pause typing...</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isActive = recipientStatus === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setRecipientStatus(isActive ? '' : card.key)}
              className={`rounded-[14px] border p-4 text-left transition hover:shadow-sm ${card.tone} ${isActive ? 'ring-2 ring-slate-300' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">{card.label}</p>
                <Icon className="h-4 w-4 opacity-80" />
              </div>
              <p className="mt-2 text-3xl font-bold">{number(card.value)}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.45fr)_minmax(0,0.55fr)]">
        <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Campaign-wise report</h2>
              <p className="text-xs text-slate-500">{number(reportCampaigns.length)} campaigns in this report</p>
            </div>
            {isFetching ? <RotateCcw className="h-4 w-4 animate-spin text-slate-400" /> : <Megaphone className="h-4 w-4 text-slate-400" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-white text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Read</th>
                  <th className="px-4 py-3 text-right">Replied</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">Loading campaign report...</td></tr>
                ) : reportCampaigns.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No campaign report rows found.</td></tr>
                ) : reportCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setCampaignId(campaign.id)}
                        className="max-w-[260px] truncate text-left font-semibold text-slate-900 hover:text-slate-600"
                      >
                        {campaign.name}
                      </button>
                      <p className="text-xs text-slate-400">{campaign.status}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{number(campaign.sent)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{number(campaign.delivered)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{number(campaign.read)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{number(campaign.replied)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{number(campaign.failed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Recipient numbers</h2>
              <p className="text-xs text-slate-500">
                Page {number(pagination.page || recipientPage)} of {number(pagination.totalPages || 1)} for {number(pagination.total ?? summary.recipientRows)} rows
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">
              <span>15 / page</span>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Read</th>
                  <th className="px-4 py-3">Replied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">Loading recipients...</td></tr>
                ) : reportRecipients.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No recipient rows found.</td></tr>
                ) : reportRecipients.map((recipient) => (
                  <tr key={recipient.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{recipient.customerName || '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{recipient.phone || '-'}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-500">{recipient.campaignName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONES[recipient.status] || 'bg-slate-100 text-slate-700'}`}>
                        {recipient.status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><DetailDate value={recipient.sentAt} /></td>
                    <td className="px-4 py-3"><DetailDate value={recipient.deliveredAt} /></td>
                    <td className="px-4 py-3"><DetailDate value={recipient.readAt} /></td>
                    <td className="px-4 py-3"><DetailDate value={recipient.repliedAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              currentPage={pagination.page || recipientPage}
              totalPages={pagination.totalPages || 1}
              totalItems={pagination.total ?? summary.recipientRows ?? 0}
              pageSize={pagination.pageSize || recipientPageSize}
              onPageChange={setRecipientPage}
              itemLabel="recipients"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
