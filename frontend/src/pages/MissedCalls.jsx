import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import { useMissedCalls } from '../hooks/useMissedCalls';
import {
  PhoneArrowDownLeftIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_AUTO_REPLY =
  'Sorry we missed your call! 👋 How can we help you today? Reply here and our team will get back to you shortly.';

const AUTO_REPLY_BADGE = {
  SENT: { label: 'Replied', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED: { label: 'Reply failed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  DISABLED: { label: 'Off', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  SKIPPED: { label: 'Skipped', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SettingsPanel() {
  const { agency, updateAgency } = useAuthStore();
  const [form, setForm] = useState({
    enabled: Boolean(agency?.whatsappMissedCallAutoReplyEnabled),
    message: agency?.whatsappMissedCallAutoReplyMessage || '',
    unknownAction: agency?.whatsappMissedCallUnknownAction || 'LOG_ONLY',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      updateAgency(response.data);
      setSuccess('Missed-call settings saved.');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to save settings');
      setSuccess('');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      whatsappMissedCallAutoReplyEnabled: form.enabled,
      whatsappMissedCallAutoReplyMessage: form.message.trim() || null,
      whatsappMissedCallUnknownAction: form.unknownAction,
    });
  };

  return (
    <div className="shell-panel p-6">
      <div className="flex items-center gap-3">
        <Cog6ToothIcon className="h-5 w-5 text-[#2d2d2d]" />
        <h2 className="text-lg font-extrabold text-slate-950">Auto-reply settings</h2>
      </div>

      {success ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand-primary,#00A884)]"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800">Auto-reply on missed WhatsApp calls</span>
          <span className="block text-xs text-slate-500">A customer&apos;s call opens the 24-hour window, so this message is sent free of charge.</span>
        </span>
      </label>

      <div className="mt-5">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Message</span>
        <textarea
          rows={3}
          value={form.message}
          onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
          placeholder={DEFAULT_AUTO_REPLY}
          maxLength={900}
          className="shell-input-rect w-full resize-y"
        />
        <p className="mt-1 text-xs text-slate-500">Leave blank to use the default message.</p>
      </div>

      <div className="mt-5">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Unknown callers</span>
        <div className="space-y-2">
          {[
            { value: 'LOG_ONLY', label: 'Log only', hint: 'Record the call; link to a customer if the number matches.' },
            { value: 'CREATE_LEAD', label: 'Create a lead', hint: 'Turn unknown callers into new leads for follow-up.' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-start gap-3">
              <input
                type="radio"
                name="unknownAction"
                checked={form.unknownAction === opt.value}
                onChange={() => setForm((c) => ({ ...c, unknownAction: opt.value }))}
                className="mt-1 h-4 w-4 border-slate-300 text-[var(--brand-primary,#00A884)]"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{opt.label}</span>
                <span className="block text-xs text-slate-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={updateMutation.isPending} className="shell-button">
          {updateMutation.isPending ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

export default function MissedCalls() {
  const [search, setSearch] = useState('');
  const params = useMemo(() => (search.trim() ? { search: search.trim() } : {}), [search]);
  const { data, isLoading, isError } = useMissedCalls(params);
  const rows = data?.rows || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PhoneArrowDownLeftIcon className="h-6 w-6 text-[var(--brand-primary,#00A884)]" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Missed Calls</h1>
          <p className="text-sm text-slate-500">Inbound WhatsApp calls your team didn&apos;t answer.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="shell-panel p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone number"
              className="shell-input-rect w-full max-w-xs"
            />
            {data?.total != null ? (
              <span className="shrink-0 text-xs font-medium text-slate-500">{data.total} total</span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading missed calls…</div>
          ) : isError ? (
            <div className="p-10 text-center text-sm text-rose-600">Couldn&apos;t load missed calls.</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <PhoneArrowDownLeftIcon className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">No missed calls yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Caller</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Auto-reply</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const badge = AUTO_REPLY_BADGE[row.autoReplyStatus] || null;
                    return (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.callerPhone}</td>
                        <td className="px-4 py-3 text-slate-500">{formatWhen(row.occurredAt)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.customer?.name || (row.customer ? 'Unnamed customer' : <span className="text-slate-400">Unknown</span>)}
                        </td>
                        <td className="px-4 py-3">
                          {badge ? (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`https://wa.me/${String(row.callerPhone).replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in WhatsApp"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[var(--brand-primary,#00A884)]"
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <SettingsPanel />
      </div>
    </div>
  );
}
