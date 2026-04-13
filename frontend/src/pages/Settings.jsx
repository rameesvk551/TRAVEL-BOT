import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import {
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  KeyIcon,
  LinkIcon,
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

function loadFacebookSdk(appId) {
  return new Promise((resolve, reject) => {
    if (!appId) {
      reject(new Error('Facebook app ID is missing'));
      return;
    }

    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v25.0',
      });
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function initFacebookSdk() {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v25.0',
      });
      resolve(window.FB);
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(script);
  });
}

function runEmbeddedSignup(embeddedSignup) {
  return loadFacebookSdk(embeddedSignup.appId).then((FB) => new Promise((resolve, reject) => {
    const loginOptions = {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        sessionInfoVersion: '3',
        version: 'v3',
        setup: {},
      },
    };

    if (embeddedSignup.configId) {
      loginOptions.config_id = embeddedSignup.configId;
    }

    FB.login((response) => {
      const code = response?.authResponse?.code || response?.authResponse?.accessToken;
      if (!code) {
        reject(new Error('Facebook signup was cancelled or no authorization code was returned'));
        return;
      }

      resolve(code);
    }, loginOptions);
  }));
}

function statusTone(status) {
  if (status === 'CONNECTED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (status === 'FAILED') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
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
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectFlowStep, setConnectFlowStep] = useState('idle');
  const [connectFlowError, setConnectFlowError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Settings updated successfully.');
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
      setSuccess('Marketing OS signup is ready. Complete the Meta popup to finish connecting your WhatsApp number.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to start WhatsApp connection');
      setSuccess('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ code, sessionToken }) => client.post('/agencies/me/whatsapp-connection/complete', { code, sessionToken }),
    onSuccess: ({ data: response }) => {
      const connection = response.data;
      updateAgency({
        whatsappConnection: connection,
        whatsappProvider: connection.provider,
        whatsappNumber: connection.displayPhoneNumber || agency?.whatsappNumber,
      });
      qc.setQueryData(['whatsapp-connection'], connection);
      setSuccess('WhatsApp connected successfully through Marketing OS.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to complete WhatsApp connection');
      setSuccess('');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    if (form.name !== agency?.name) data.name = form.name;
    if (form.phone !== agency?.phone) data.phone = form.phone;
    if (form.razorpayKeyId) data.razorpayKeyId = form.razorpayKeyId;
    if (form.razorpayKeySecret) data.razorpayKeySecret = form.razorpayKeySecret;
    if (form.webhookSecret) data.webhookSecret = form.webhookSecret;

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const connection = whatsappConnectionQuery.data;
  const whatsappNumber = connection?.displayPhoneNumber || agency?.whatsappNumber || '';
  const connectBusy = connectMutation.isPending || completeMutation.isPending;

  const closeConnectModal = () => {
    if (connectBusy) return;
    setConnectModalOpen(false);
    setConnectFlowStep('idle');
    setConnectFlowError('');
  };

  const handleConnectWhatsApp = async () => {
    setConnectModalOpen(true);
    setConnectFlowStep('handshake');
    setConnectFlowError('');
    setError('');
    setSuccess('');

    try {
      const response = await connectMutation.mutateAsync();
      const nextConnection = response.data.data;

      if (nextConnection?.embeddedSignup?.sessionToken) {
        setConnectFlowStep('meta');
        const code = await runEmbeddedSignup(nextConnection.embeddedSignup);
        setConnectFlowStep('sync');
        await completeMutation.mutateAsync({
          code,
          sessionToken: nextConnection.embeddedSignup.sessionToken,
        });
        setConnectFlowStep('connected');
        return;
      }

      throw new Error('Embedded WhatsApp signup is not available yet for this agency');
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to start WhatsApp connection';
      setConnectFlowStep('error');
      setConnectFlowError(message);
      setError(message);
      setSuccess('');
    }
  };

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Keep your agency profile, WhatsApp channel, and payment credentials aligned in one quiet control room.
          </p>
        </div>
      </section>

      {success ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <BuildingOfficeIcon className="h-5 w-5 text-[#0d6a5f]" />
              <h2 className="text-xl font-extrabold text-slate-950">Agency Information</h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Agency name">
                <input value={form.name} onChange={(event) => update('name', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="Agency phone">
                <input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="WhatsApp number" hint="This updates automatically after your provider connection is approved.">
                <input value={whatsappNumber} disabled className="shell-input-rect cursor-not-allowed opacity-60" />
              </Field>

              <Field label="Plan">
                <div className="rounded-[20px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{agency?.plan || 'FREE'}</div>
              </Field>
            </div>
          </article>

          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <KeyIcon className="h-5 w-5 text-[#0d6a5f]" />
              <h2 className="text-xl font-extrabold text-slate-950">Razorpay Integration</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">Enter your payment credentials to collect deposits directly inside WhatsApp.</p>

            <div className="mt-6 space-y-4">
              <Field label="Razorpay Key ID">
                <input value={form.razorpayKeyId} onChange={(event) => update('razorpayKeyId', event.target.value)} className="shell-input-rect" placeholder="rzp_test_..." />
              </Field>

              <Field label="Razorpay Key Secret" hint="Encrypted at rest. Leave blank to keep the existing secret.">
                <input value={form.razorpayKeySecret} onChange={(event) => update('razorpayKeySecret', event.target.value)} type="password" className="shell-input-rect" placeholder="••••••••" />
              </Field>

              <Field label="Webhook Secret">
                <input value={form.webhookSecret} onChange={(event) => update('webhookSecret', event.target.value)} type="password" className="shell-input-rect" placeholder="••••••••" />
              </Field>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <PhoneIcon className="h-5 w-5 text-[#0d6a5f]" />
              <h2 className="text-xl font-extrabold text-slate-950">WhatsApp Connection</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">TravelBot uses Marketing OS as your Meta partner layer for channel onboarding and sync.</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className={`badge ${statusTone(connection?.status)}`}>{connection?.status || 'NOT_CONNECTED'}</span>
              <span className="badge bg-slate-100 text-slate-600">Provider: {connection?.provider || agency?.whatsappProvider || 'MARKETING_OS'}</span>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Connected Number</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{whatsappNumber || 'Not assigned yet'}</p>
              </div>
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Meta Phone Number ID</p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{connection?.phoneNumberId || 'Waiting for provider sync'}</p>
              </div>
            </div>

            {connection?.errorMessage ? (
              <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connection.errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handleConnectWhatsApp} disabled={connectBusy} className="shell-button-primary">
                <LinkIcon className="h-4 w-4" />
                {connectBusy ? 'Connecting...' : 'Connect WhatsApp'}
              </button>
              <button
                type="button"
                onClick={() => whatsappConnectionQuery.refetch()}
                disabled={whatsappConnectionQuery.isFetching}
                className="shell-button-secondary"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {whatsappConnectionQuery.isFetching ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
              1. Start the connection handshake.
              <br />
              2. Complete the Meta embedded signup popup.
              <br />
              3. TravelBot syncs the approved phone number, Meta IDs, and final status back into this workspace.
            </div>
          </article>

          <button type="submit" disabled={updateMutation.isPending} className="shell-button-primary w-full">
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {connectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white p-6 shadow-[0_34px_90px_-50px_rgba(15,23,42,0.55)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Connect WhatsApp</p>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Embedded signup flow</h3>
                <p className="mt-2 text-sm text-slate-500">
                  We create the Marketing OS session, open the Meta popup, and sync the approved channel back into TravelBot.
                </p>
              </div>
              <button type="button" onClick={closeConnectModal} disabled={connectBusy} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'handshake',
                  title: 'Handshake with Marketing OS',
                  done: ['meta', 'sync', 'connected'].includes(connectFlowStep),
                  active: connectFlowStep === 'handshake',
                },
                {
                  key: 'meta',
                  title: 'Meta embedded signup popup',
                  done: ['sync', 'connected'].includes(connectFlowStep),
                  active: connectFlowStep === 'meta',
                },
                {
                  key: 'sync',
                  title: 'Sync channel back to TravelBot',
                  done: connectFlowStep === 'connected',
                  active: connectFlowStep === 'sync',
                },
              ].map((item, index) => (
                <div key={item.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      item.done
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.active
                          ? 'bg-emerald-50 text-[#0d6a5f]'
                          : 'bg-white text-slate-500'
                    }`}>
                      {item.done ? <CheckCircleIcon className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.done ? 'Completed' : item.active ? 'In progress...' : 'Waiting'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {connectFlowStep === 'meta' ? (
              <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Complete the Meta popup to approve your WhatsApp Business number.
              </div>
            ) : null}

            {connectFlowStep === 'connected' ? (
              <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                WhatsApp is connected and synced back into TravelBot.
              </div>
            ) : null}

            {connectFlowStep === 'error' || connectFlowError ? (
              <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connectFlowError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeConnectModal} disabled={connectBusy} className="shell-button-secondary flex-1">
                {connectFlowStep === 'connected' ? 'Close' : 'Cancel'}
              </button>
              {connectFlowStep === 'error' ? (
                <button type="button" onClick={handleConnectWhatsApp} className="shell-button-primary flex-1">
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
