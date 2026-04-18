// FILE: /frontend/src/pages/CampaignDetail.jsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Ban, Copy, Trash2, Users, CheckCircle2,
  Eye, MessageCircle, XCircle, Clock, BarChart2, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useCampaign, useCampaignStats,
  useSendCampaign, useCancelCampaign, useDuplicateCampaign, useDeleteCampaign,
} from '../hooks/useCampaigns';
import { formatDateTime } from '../utils/formatters';

const TEAL = '#0d1b3e';

const STATUS_CONFIG = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  SCHEDULED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  SENDING: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400 animate-pulse' },
  SENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-400' },
  FAILED: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-400' },
};

const RECIPIENT_STATUS_COLORS = {
  PENDING: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  READ: 'bg-teal-50 text-teal-700',
  REPLIED: 'bg-violet-50 text-violet-700',
  FAILED: 'bg-rose-50 text-rose-700',
};

function FunnelBar({ label, count, total, color, icon: Icon }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium text-slate-600">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{count.toLocaleString()}</span>
          <span className="text-[10px] font-semibold text-slate-400">({pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="h-7 w-full rounded-lg bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
          style={{
            width: `${Math.max(pct, 2)}%`,
            background: `linear-gradient(90deg, ${color.replace('text-', '').includes('teal') ? TEAL : '#0ea5e9'}, #14b8a6)`,
          }}
        >
          {pct > 15 && <span className="text-xs font-bold text-white">{count}</span>}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { data: campaignData, isLoading } = useCampaign(id);
  const { data: statsData } = useCampaignStats(id);
  const sendMutation = useSendCampaign();
  const cancelMutation = useCancelCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const deleteMutation = useDeleteCampaign();

  const campaign = campaignData?.data;
  const stats = statsData?.data?.stats;
  const timeline = statsData?.data?.timeline || [];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Campaign not found.</p>
        <button onClick={() => navigate('/campaigns')} className="mt-3 text-sm text-teal-600 font-semibold">
          ← Back to campaigns
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const total = stats?.total || campaign.totalRecipients || 0;

  const funnelData = [
    { label: 'Total Recipients', count: total, icon: Users, color: 'text-slate-600' },
    { label: 'Sent', count: stats?.sent || campaign.sent || 0, icon: Send, color: 'text-blue-600' },
    { label: 'Delivered', count: stats?.delivered || campaign.delivered || 0, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Read', count: stats?.read || campaign.read || 0, icon: Eye, color: 'text-teal-600' },
    { label: 'Replied', count: stats?.replied || campaign.replied || 0, icon: MessageCircle, color: 'text-violet-600' },
    { label: 'Failed', count: stats?.failed || campaign.failed || 0, icon: XCircle, color: 'text-rose-600' },
  ];

  const timelineChart = timeline.map((t) => ({
    hour: new Date(t.hour).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    sent: t.sent,
    delivered: t.delivered,
    read: t.read,
  }));

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
    <div className="p-6 md:p-8 space-y-6 animate-in fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{campaign.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {campaign.type} · Created {formatDateTime(campaign.createdAt)}
              {campaign.sentAt && ` · Sent ${formatDateTime(campaign.sentAt)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
            <button
              onClick={() => setShowSendConfirm(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#0d1b3e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b5a51] transition"
            >
              <Send className="w-4 h-4" /> Send Now
            </button>
          )}

          {campaign.status === 'SENDING' && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
            >
              <Ban className="w-4 h-4" /> Cancel
            </button>
          )}

          {/* More actions */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Actions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                  <button
                    onClick={() => { handleDuplicate(); setShowMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  {campaign.status === 'DRAFT' && (
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {funnelData.map((f) => {
            const Icon = f.icon;
            const pct = total > 0 ? ((f.count / total) * 100).toFixed(1) : '0';
            return (
              <div key={f.label} className="rounded-[14px] border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${f.color}`} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{f.label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{f.count.toLocaleString()}</p>
                {f.label !== 'Total Recipients' && (
                  <p className="text-xs text-slate-400 mt-0.5">{pct}% of total</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delivery Funnel */}
      {total > 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Delivery Funnel</h3>
            <p className="text-xs text-slate-400 mt-0.5">Message delivery pipeline</p>
          </div>
          <div className="p-5 space-y-3.5">
            {funnelData.filter((f) => f.label !== 'Failed').map((f) => (
              <FunnelBar key={f.label} {...f} total={total} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {timelineChart.length > 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Delivery Timeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">Hourly breakdown of campaign delivery</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timelineChart}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEAL} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sent" stroke="#0ea5e9" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
                <Area type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} fill="url(#delGrad)" name="Delivered" />
                <Area type="monotone" dataKey="read" stroke={TEAL} strokeWidth={2} fill="url(#readGrad)" name="Read" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recipients Table */}
      {(campaign.recipients || []).length > 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Recipients</h3>
            <p className="text-xs text-slate-400 mt-0.5">Showing latest 100 recipients</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 border-b border-slate-200">
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Sent At</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaign.recipients.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      {r.customer?.name || 'Unknown'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{r.customer?.phone || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${RECIPIENT_STATUS_COLORS[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{r.sentAt ? formatDateTime(r.sentAt) : '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{r.deliveredAt ? formatDateTime(r.deliveredAt) : '-'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{r.readAt ? formatDateTime(r.readAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Info (for drafts / empty) */}
      {total === 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white p-8 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No delivery data yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            {['DRAFT', 'SCHEDULED'].includes(campaign.status)
              ? 'Send this campaign to see delivery analytics.'
              : 'This campaign has no recipients.'}
          </p>
          {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
            <button
              onClick={() => setShowSendConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d1b3e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b5a51] transition"
            >
              <Send className="w-4 h-4" /> Send Campaign
            </button>
          )}
        </div>
      )}

      {/* Send Confirmation Modal */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSendConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Send Campaign?</h3>
                <p className="text-xs text-slate-500">This will start sending messages immediately.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSendConfirm(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending}
                className="flex-1 rounded-xl bg-[#0d1b3e] py-2.5 text-sm font-semibold text-white hover:bg-[#0b5a51] disabled:opacity-60"
              >
                {sendMutation.isPending ? 'Sending...' : 'Yes, Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Campaign?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
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
