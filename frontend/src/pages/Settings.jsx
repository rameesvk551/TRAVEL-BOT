// FILE: /frontend/src/pages/Settings.jsx
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { KeyIcon, PhoneIcon, BuildingOfficeIcon, LinkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

function getStatusTone(status) {
  if (status === 'CONNECTED') return 'bg-green-500/10 text-green-300 border-green-500/20';
  if (status === 'PENDING') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (status === 'FAILED') return 'bg-red-500/10 text-red-300 border-red-500/20';
  return 'bg-surface-800 text-surface-200 border-surface-700';
}

export default function Settings() {
  const { agency, updateAgency } = useAuthStore();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: agency?.name || '',
    phone: agency?.phone || '',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    webhookSecret: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Settings updated successfully');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update settings');
      setSuccess('');
    },
  });

  const whatsappConnectionQuery = useQuery({
    queryKey: ['whatsapp-connection'],
    queryFn: () => client.get('/agencies/me/whatsapp-connection').then((response) => response.data.data),
    initialData: agency?.whatsappConnection || null,
  });

  const connectMutation = useMutation({
    mutationFn: () => client.post('/agencies/me/whatsapp-connection/connect'),
    onSuccess: ({ data: response }) => {
      const connection = response.data;
      updateAgency({ whatsappConnection: connection, whatsappProvider: connection.provider });
      qc.setQueryData(['whatsapp-connection'], connection);
      setSuccess('Marketing OS connect flow opened. Finish the WhatsApp onboarding there, then refresh the status here.');
      setError('');
      if (connection.connectUrl) {
        window.open(connection.connectUrl, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to start WhatsApp connection');
      setSuccess('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {};
    if (form.name !== agency?.name) data.name = form.name;
    if (form.phone !== agency?.phone) data.phone = form.phone;
    if (form.razorpayKeyId) data.razorpayKeyId = form.razorpayKeyId;
    if (form.razorpayKeySecret) data.razorpayKeySecret = form.razorpayKeySecret;
    if (form.webhookSecret) data.webhookSecret = form.webhookSecret;

    if (Object.keys(data).length === 0) {
      setError('No changes to save');
      return;
    }
    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const connection = whatsappConnectionQuery.data;
  const whatsappNumber = connection?.displayPhoneNumber || agency?.whatsappNumber || '';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agency Info */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <BuildingOfficeIcon className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Agency Information</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Agency Name</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Agency Phone</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">WhatsApp Number</label>
              <input value={whatsappNumber} disabled className="input-field opacity-50 cursor-not-allowed" />
              <p className="text-xs text-surface-500 mt-1">This number is updated after your provider connection is approved.</p>
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Plan</label>
              <span className="badge badge-booked text-sm">{agency?.plan || 'FREE'}</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <PhoneIcon className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-semibold text-white">WhatsApp Connection</h3>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            TravelBot connects your WhatsApp Business channel through Marketing OS, your Meta provider partner.
          </p>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusTone(connection?.status)}`}>
                {connection?.status || 'NOT_CONNECTED'}
              </span>
              <span className="inline-flex items-center rounded-full border border-surface-700 bg-surface-900 px-3 py-1 text-xs font-medium text-surface-200">
                Provider: {connection?.provider || agency?.whatsappProvider || 'MARKETING_OS'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-surface-800 bg-surface-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-500">Connected Number</p>
                <p className="mt-2 text-sm text-white">{whatsappNumber || 'Not assigned yet'}</p>
              </div>
              <div className="rounded-2xl border border-surface-800 bg-surface-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-surface-500">Meta Phone Number ID</p>
                <p className="mt-2 text-sm text-white break-all">{connection?.phoneNumberId || 'Waiting for provider sync'}</p>
              </div>
            </div>

            {connection?.errorMessage && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {connection.errorMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="btn-primary inline-flex items-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                {connectMutation.isPending ? 'Opening...' : 'Connect to WhatsApp'}
              </button>

              <button
                type="button"
                onClick={() => whatsappConnectionQuery.refetch()}
                disabled={whatsappConnectionQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-xl border border-surface-700 px-4 py-2 text-sm font-medium text-surface-100 transition hover:border-surface-500 hover:bg-surface-900"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                {whatsappConnectionQuery.isFetching ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-surface-950/50 p-4 text-xs text-surface-400">
              1. Click Connect to WhatsApp.
              <br />
              2. Complete the Marketing OS embedded signup or channel approval flow.
              <br />
              3. Marketing OS calls TravelBot back with the approved WhatsApp number, Meta IDs, and connection status.
            </div>
          </div>
        </div>

        {/* Razorpay */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <KeyIcon className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Razorpay Integration</h3>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            Enter your Razorpay API keys to enable payment collection via WhatsApp.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Razorpay Key ID</label>
              <input value={form.razorpayKeyId} onChange={(e) => update('razorpayKeyId', e.target.value)} className="input-field" placeholder="rzp_test_..." />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Razorpay Key Secret</label>
              <input value={form.razorpayKeySecret} onChange={(e) => update('razorpayKeySecret', e.target.value)} type="password" className="input-field" placeholder="••••••••" />
              <p className="text-xs text-surface-500 mt-1">Encrypted at rest. Leave blank to keep existing.</p>
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Webhook Secret</label>
              <input value={form.webhookSecret} onChange={(e) => update('webhookSecret', e.target.value)} type="password" className="input-field" placeholder="••••••••" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={updateMutation.isPending} className="btn-primary w-full">
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
