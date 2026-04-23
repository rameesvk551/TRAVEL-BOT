// FILE: /frontend/src/pages/CampaignDetail.jsx

import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Ban, Copy, Trash2, Users, CheckCircle2,
  Eye, MessageCircle, XCircle, BarChart2, ChevronDown, Clock3,
  Activity, Smartphone, Package, Home,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useCampaign, useCampaignStats,
  useCampaignReport, useSendCampaign, useCancelCampaign, useDuplicateCampaign, useDeleteCampaign,
} from '../hooks/useCampaigns';
import { formatDateTime } from '../utils/formatters';

const COLORS = {
  ink: '#111827',
  sent: '#2563eb',
  delivered: '#059669',
  read: '#111827',
  replied: '#7c3aed',
  failed: '#e11d48',
  track: '#eef2f7',
};

const STATUS_CONFIG = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  SCHEDULED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  SENDING: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500 animate-pulse' },
  SENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-400' },
  FAILED: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-400' },
};

const RECIPIENT_STATUS_COLORS = {
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-200',
  SENT: 'bg-blue-50 text-blue-700 ring-blue-100',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  READ: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  REPLIED: 'bg-violet-50 text-violet-700 ring-violet-100',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-100',
};

function percent(count, total) {
  return total > 0 ? (count / total) * 100 : 0;
}

function formatPct(count, total) {
  return `${percent(count, total).toFixed(1)}%`;
}

function formatMoneyPaise(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100);
}

function formatAction(action) {
  return String(action || '-')
    .replace(/^campaign_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetricCard({ label, value, total, icon: Icon, color, hint }) {
  const pct = label === 'Total' ? 100 : percent(value, total);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value.toLocaleString()}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}12`, color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint || `${formatPct(value, total)} of total recipients`}</p>
    </div>
  );
}

function FunnelRow({ label, count, total, color, icon: Icon }) {
  const pct = percent(count, total);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="truncate text-sm font-semibold text-slate-700">{label}</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="text-sm font-bold text-slate-950">{count.toLocaleString()}</span>
          <span className="text-xs font-semibold text-slate-400">{formatPct(count, total)}</span>
        </div>
      </div>
      <div className="h-8 overflow-hidden rounded-lg bg-slate-100">
        <div
          className="flex h-full items-center px-3 text-xs font-bold text-white transition-all duration-700"
          style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, backgroundColor: color }}
        >
          {pct > 12 ? count : ''}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function OutcomeCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function TimeValue({ value }) {
  return <span className="text-xs text-slate-500">{value ? formatDateTime(value) : '-'}</span>;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { data: campaignData, isLoading } = useCampaign(id);
  const { data: statsData } = useCampaignStats(id);
  const { data: reportData } = useCampaignReport(id);
  const sendMutation = useSendCampaign();
  const cancelMutation = useCancelCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const deleteMutation = useDeleteCampaign();

  const campaign = campaignData?.data;
  const stats = statsData?.data?.stats;
  const timeline = statsData?.data?.timeline || [];
  const report = reportData?.data;
  const reportSummary = report?.summary || {};
  const itemPerformance = report?.itemPerformance || [];
  const actionPerformance = report?.actionPerformance || [];

  const timelineChart = useMemo(() => timeline.map((t) => ({
    hour: new Date(t.hour).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    sent: Number(t.sent || 0),
    delivered: Number(t.delivered || 0),
    read: Number(t.read || 0),
  })), [timeline]);

  const reportRecipientsById = useMemo(() => new Map(
    (report?.recipients || []).map((recipient) => [recipient.id, recipient])
  ), [report?.recipients]);

  if (isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="text-sm font-medium text-slate-500">Loading campaign analytics...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Campaign not found.</p>
        <button onClick={() => navigate('/campaigns')} className="mt-3 text-sm font-semibold text-slate-900">
          Back to campaigns
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const total = stats?.total || campaign.totalRecipients || 0;
  const sent = stats?.sent ?? campaign.sent ?? 0;
  const delivered = stats?.delivered ?? campaign.delivered ?? 0;
  const read = stats?.read ?? campaign.read ?? 0;
  const replied = stats?.replied ?? campaign.replied ?? 0;
  const failed = stats?.failed ?? campaign.failed ?? 0;
  const clicked = stats?.clicked ?? reportSummary.clicked ?? 0;
  const leadCount = stats?.leads ?? reportSummary.leads ?? 0;
  const bookingCount = stats?.bookings ?? reportSummary.bookings ?? 0;
  const revenue = stats?.revenue ?? reportSummary.revenue ?? 0;

  const metrics = [
    { label: 'Total', value: total, icon: Users, color: COLORS.ink, hint: 'Resolved campaign audience' },
    { label: 'Sent', value: sent, icon: Send, color: COLORS.sent },
    { label: 'Delivered', value: delivered, icon: CheckCircle2, color: COLORS.delivered },
    { label: 'Read', value: read, icon: Eye, color: COLORS.read },
    { label: 'Replied', value: replied, icon: MessageCircle, color: COLORS.replied },
    { label: 'Failed', value: failed, icon: XCircle, color: COLORS.failed },
  ];

  const funnelRows = [
    { label: 'Total Recipients', count: total, icon: Users, color: COLORS.ink },
    { label: 'Sent', count: sent, icon: Send, color: COLORS.sent },
    { label: 'Delivered', count: delivered, icon: CheckCircle2, color: COLORS.delivered },
    { label: 'Read / Opened', count: read, icon: Eye, color: COLORS.read },
    { label: 'Replied', count: replied, icon: MessageCircle, color: COLORS.replied },
  ];

  const handleSend = () => {
    sendMutation.mutate(id, { onSuccess: () => setShowSendConfirm(false) });
  };

  const handleCancel = () => {
    cancelMutation.mutate(id);
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate(id, { onSuccess: () => navigate('/campaigns') });
  };

  const handleDelete = () => {
    deleteMutation.mutate(id, { onSuccess: () => navigate('/campaigns') });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <button
                onClick={() => navigate('/campaigns')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Back to campaigns"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{campaign.name}</h1>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    {campaign.type}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" />
                    Created {formatDateTime(campaign.createdAt)}
                  </span>
                  {campaign.sentAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Send className="h-4 w-4" />
                      Sent {formatDateTime(campaign.sentAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Send className="h-4 w-4" /> Send Now
                </button>
              )}

              {campaign.status === 'SENDING' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" /> Cancel
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Actions <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      <button
                        onClick={() => { handleDuplicate(); setShowMenu(false); }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-4 w-4" /> Duplicate
                      </button>
                      {campaign.status === 'DRAFT' && (
                        <button
                          onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {total > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {metrics.map((item) => <MetricCard key={item.label} {...item} total={total} />)}
          </div>
        )}

        {(clicked > 0 || leadCount > 0 || bookingCount > 0 || revenue > 0) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OutcomeCard
              label="Clicks"
              value={clicked.toLocaleString()}
              hint={`${formatPct(clicked, total)} of recipients tapped a campaign action`}
              icon={Activity}
            />
            <OutcomeCard
              label="Leads"
              value={leadCount.toLocaleString()}
              hint={`${formatPct(leadCount, total)} recipient-to-lead conversion`}
              icon={MessageCircle}
            />
            <OutcomeCard
              label="Bookings"
              value={bookingCount.toLocaleString()}
              hint={`${leadCount ? formatPct(bookingCount, leadCount) : '0.0%'} lead-to-booking conversion`}
              icon={CheckCircle2}
            />
            <OutcomeCard
              label="Revenue"
              value={formatMoneyPaise(revenue)}
              hint="Confirmed campaign-attributed booking value"
              icon={BarChart2}
            />
          </div>
        )}

        {total > 0 ? (
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(420px,0.8fr)_minmax(680px,1.2fr)]">
            <Panel title="Delivery Funnel" subtitle="Recipient movement across WhatsApp delivery states">
              <div className="space-y-5 p-5">
                {funnelRows.map((row) => <FunnelRow key={row.label} {...row} total={total} />)}
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Read Rate</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{formatPct(read, total)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Reply Rate</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{formatPct(replied, total)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Delivery Timeline" subtitle="Hourly movement for sent, delivered, and read statuses">
              <div className="h-[390px] p-5">
                {timelineChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineChart} margin={{ top: 10, right: 18, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="campaignSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.sent} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={COLORS.sent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="campaignDelivered" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.delivered} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={COLORS.delivered} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="campaignRead" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.read} stopOpacity={0.14} />
                          <stop offset="95%" stopColor={COLORS.read} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />
                      <Area type="monotone" dataKey="sent" stroke={COLORS.sent} strokeWidth={2.5} fill="url(#campaignSent)" name="Sent" />
                      <Area type="monotone" dataKey="delivered" stroke={COLORS.delivered} strokeWidth={2.5} fill="url(#campaignDelivered)" name="Delivered" />
                      <Area type="monotone" dataKey="read" stroke={COLORS.read} strokeWidth={2.5} fill="url(#campaignRead)" name="Read" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                    Timeline will appear as delivery callbacks arrive.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        ) : (
          <Panel title="No Delivery Data Yet" subtitle="Send this campaign to start collecting recipient analytics">
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
                <BarChart2 className="h-8 w-8 text-slate-400" />
              </div>
              <button
                onClick={() => setShowSendConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Send className="h-4 w-4" /> Send Campaign
              </button>
            </div>
          </Panel>
        )}

        {(actionPerformance.length > 0 || itemPerformance.length > 0) && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.7fr)_minmax(620px,1.3fr)]">
            <Panel title="CTA Performance" subtitle="Which campaign actions customers tapped">
              <div className="p-5">
                {actionPerformance.length > 0 ? (
                  <div className="space-y-3">
                    {actionPerformance.map((action) => (
                      <div key={action.action} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-700">{formatAction(action.action)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {Number(action.count || 0).toLocaleString()} clicks
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
                    CTA clicks will appear here after customers interact.
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Package & Property Performance" subtitle="Lead and booking outcomes by selected item">
              <div className="overflow-x-auto">
                {itemPerformance.length > 0 ? (
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        <th className="px-5 py-3">Item</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Clicks</th>
                        <th className="px-5 py-3">Leads</th>
                        <th className="px-5 py-3">Bookings</th>
                        <th className="px-5 py-3">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {itemPerformance.map((item) => {
                        const ItemIcon = item.itemType === 'PROPERTY' ? Home : Package;
                        return (
                          <tr key={`${item.itemType}-${item.itemId}`} className="transition hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                  <ItemIcon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-slate-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-500">{item.itemType?.replace('_', ' ')}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{Number(item.clicks || 0).toLocaleString()}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{Number(item.leads || 0).toLocaleString()}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{Number(item.bookings || 0).toLocaleString()}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{formatMoneyPaise(item.revenue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-10 text-center text-sm text-slate-500">
                    Selected package and property outcomes will appear after customer actions create leads.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {(campaign.recipients || []).length > 0 && (
          <Panel
            title="Recipient Activity"
            subtitle="Latest recipients with delivery, click, selection, and reply timestamps"
            action={(
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                <Smartphone className="h-4 w-4" />
                WhatsApp read is the open signal
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-5 py-3">Recipient</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Click</th>
                    <th className="px-5 py-3">Selected</th>
                    <th className="px-5 py-3">Sent</th>
                    <th className="px-5 py-3">Delivered</th>
                    <th className="px-5 py-3">Read / Opened</th>
                    <th className="px-5 py-3">Replied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {campaign.recipients.map((r) => {
                    const reportRecipient = reportRecipientsById.get(r.id) || r;
                    return (
                      <tr key={r.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{r.customer?.name || 'Unknown'}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{r.customer?.phone || '-'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${RECIPIENT_STATUS_COLORS[r.status] || RECIPIENT_STATUS_COLORS.PENDING}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-semibold text-slate-700">{formatAction(reportRecipient.clickedAction)}</div>
                          <TimeValue value={reportRecipient.clickedAt} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="max-w-[180px] truncate text-xs font-semibold text-slate-700">
                            {reportRecipient.selectedItemName || reportRecipient.selectedItemType || '-'}
                          </div>
                          {reportRecipient.leadId && <div className="mt-1 text-[11px] font-bold text-emerald-700">Lead created</div>}
                        </td>
                        <td className="px-5 py-4"><TimeValue value={r.sentAt} /></td>
                        <td className="px-5 py-4"><TimeValue value={r.deliveredAt} /></td>
                        <td className="px-5 py-4"><TimeValue value={r.readAt} /></td>
                        <td className="px-5 py-4"><TimeValue value={r.repliedAt} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={() => setShowSendConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-900">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">Send Campaign?</h3>
                <p className="text-xs text-slate-500">This will start sending messages immediately.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSendConfirm(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending}
                className="flex-1 rounded-lg bg-slate-950 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {sendMutation.isPending ? 'Sending...' : 'Yes, Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">Delete Campaign?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
