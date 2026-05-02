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
  CameraIcon,
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
    let sessionInfo = null;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', sessionInfoListener);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const sessionInfoListener = (event) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (_err) {
          return;
        }
      }

      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
        sessionInfo = data.data || null;
      } else if (data.event === 'ERROR') {
        fail(new Error(data.data?.error_message || 'Facebook embedded signup failed'));
      } else if (data.event === 'CANCEL') {
        fail(new Error('Facebook signup was cancelled before completion'));
      }
    };

    window.addEventListener('message', sessionInfoListener);

    const extras = {
      feature: 'whatsapp_embedded_signup',
      sessionInfoVersion: embeddedSignup.sessionInfoVersion || '3',
      version: 'v3',
      setup: {},
    };

    if (embeddedSignup.featureType) {
      extras.featureType = embeddedSignup.featureType;
    }

    const loginOptions = {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras,
    };

    if (embeddedSignup.configId) {
      loginOptions.config_id = embeddedSignup.configId;
    }

    FB.login((response) => {
      const code = response?.authResponse?.code || response?.authResponse?.accessToken;
      if (!code) {
        fail(new Error('Facebook signup was cancelled or no authorization code was returned'));
        return;
      }

      finish({ code, sessionInfo });
    }, loginOptions);
  }));
}

function runInstagramSignup(appId) {
  return loadFacebookSdk(appId).then((FB) => new Promise((resolve, reject) => {
    FB.login((response) => {
      const authResponse = response?.authResponse;
      if (!authResponse?.accessToken) {
        reject(new Error('Facebook login was cancelled or no access token was returned'));
        return;
      }
      resolve({
        accessToken: authResponse.accessToken,
        igUserId: authResponse.userID,
      });
    }, {
      scope: [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_content_publish',
        'instagram_business_manage_insights',
        'instagram_business_manage_comments',
        'pages_show_list',
        'pages_manage_metadata',
        'pages_manage_ads',
        'ads_read',
      ].join(','),
      return_scopes: true,
    });
  }));
}

function statusTone(status) {
  if (status === 'CONNECTED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (status === 'FAILED') return 'bg-rose-100 text-rose-700';
  return 'bg-neutral-100 text-neutral-600';
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
    googleReviewLink: agency?.googleReviewLink || '',
    autoReviewCollectionEnabled: agency?.autoReviewCollectionEnabled !== false,
    autoReviewDelayDays: agency?.autoReviewDelayDays ?? 2,
    followUpReminderEnabled: agency?.followUpReminderEnabled !== false,
    followUpReminderMinutes: agency?.followUpReminderMinutes ?? 30,
    whatsappCatalogId: agency?.whatsappCatalogId || '',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    webhookSecret: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectFlowStep, setConnectFlowStep] = useState('idle');
  const [connectFlowError, setConnectFlowError] = useState('');
  const [connectMode, setConnectMode] = useState('coexistence');

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
    mutationFn: (payload = {}) => client.post('/agencies/me/whatsapp-connection/connect', payload),
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
    mutationFn: ({ code, sessionToken, sessionInfo }) => client.post('/agencies/me/whatsapp-connection/complete', {
      code,
      sessionToken,
      sessionInfo,
      phoneNumberId: sessionInfo?.phone_number_id,
      wabaId: sessionInfo?.waba_id,
      businessId: sessionInfo?.business_id,
    }),
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

  const instagramConnectionQuery = useQuery({
    queryKey: ['instagram-connection'],
    queryFn: () => client.get('/agencies/me/instagram-connection').then((response) => response.data.data),
  });

  const connectIgMutation = useMutation({
    mutationFn: (payload) => client.post('/agencies/me/instagram-connection/connect', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instagram-connection'] });
      setSuccess('Instagram connected successfully.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to connect Instagram');
      setSuccess('');
    },
  });

  const disconnectIgMutation = useMutation({
    mutationFn: (accountId) => client.delete(`/agencies/me/instagram-connection/${encodeURIComponent(accountId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instagram-connection'] });
      setSuccess('Instagram disconnected.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to disconnect Instagram');
      setSuccess('');
    },
  });

  const handleConnectInstagram = async () => {
    try {
      // Using WhatsApp connect to trigger Marketing OS tenant handshake and get appId
      const { data } = await client.post('/agencies/me/whatsapp-connection/connect', { onboardingMode: 'standard' });
      const appId = data?.data?.embeddedSignup?.appId;
      if (!appId) throw new Error('Facebook App ID not found in Marketing OS config');

      const { accessToken, igUserId } = await runInstagramSignup(appId);
      connectIgMutation.mutate({ accessToken, igUserId });
    } catch (err) {
      setError(err.message || 'Failed to start Instagram connection');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    if (form.name !== agency?.name) data.name = form.name;
    if (form.phone !== agency?.phone) data.phone = form.phone;
    if (form.googleReviewLink !== agency?.googleReviewLink) data.googleReviewLink = form.googleReviewLink;
    if (form.autoReviewCollectionEnabled !== (agency?.autoReviewCollectionEnabled !== false)) data.autoReviewCollectionEnabled = form.autoReviewCollectionEnabled;
    if (parseInt(form.autoReviewDelayDays, 10) !== (agency?.autoReviewDelayDays ?? 2)) data.autoReviewDelayDays = parseInt(form.autoReviewDelayDays, 10);
    if (form.followUpReminderEnabled !== (agency?.followUpReminderEnabled !== false)) data.followUpReminderEnabled = form.followUpReminderEnabled;
    if (parseInt(form.followUpReminderMinutes, 10) !== (agency?.followUpReminderMinutes ?? 30)) data.followUpReminderMinutes = parseInt(form.followUpReminderMinutes, 10);
    if (form.whatsappCatalogId !== agency?.whatsappCatalogId) data.whatsappCatalogId = form.whatsappCatalogId;
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

  const handleConnectWhatsApp = async (mode = connectMode) => {
    const selectedMode = mode === 'standard' ? 'standard' : 'coexistence';
    setConnectMode(selectedMode);
    setConnectModalOpen(true);
    setConnectFlowStep('handshake');
    setConnectFlowError('');
    setError('');
    setSuccess('');

    try {
      const response = await connectMutation.mutateAsync({ onboardingMode: selectedMode });
      const nextConnection = response.data.data;

      if (nextConnection?.embeddedSignup?.sessionToken) {
        setConnectFlowStep('meta');
        const signupResult = await runEmbeddedSignup(nextConnection.embeddedSignup);
        setConnectFlowStep('sync');
        await completeMutation.mutateAsync({
          code: signupResult.code,
          sessionInfo: signupResult.sessionInfo,
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
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Keep your agency profile, WhatsApp channel, and payment credentials aligned in one quiet control room.
          </p>
        </div>
      </section>

      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <BuildingOfficeIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">Agency Information</h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Agency name">
                <input value={form.name} onChange={(event) => update('name', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="Agency phone">
                <input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="Google Review Link" hint="Sent by the bot when customers give 4 or 5 star ratings.">
                <input value={form.googleReviewLink} onChange={(event) => update('googleReviewLink', event.target.value)} placeholder="https://g.page/r/your-agency/review" className="shell-input-rect" />
              </Field>

              <div className="col-span-1 md:col-span-2 rounded-[20px] bg-slate-50 border border-slate-100 p-5 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Auto Review Collection</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically ask customers for a review after their trip completes.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={form.autoReviewCollectionEnabled}
                      onChange={(e) => update('autoReviewCollectionEnabled', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
                  </label>
                </div>
                
                {form.autoReviewCollectionEnabled && (
                   <div className="mt-4 pt-4 border-t border-slate-200">
                     <label className="block text-sm font-semibold text-slate-700">Days to wait after return date</label>
                     <div className="flex items-center mt-2 gap-2">
                       <input 
                         type="number" 
                         min="0" 
                         max="30" 
                         value={form.autoReviewDelayDays}
                         onChange={(e) => update('autoReviewDelayDays', e.target.value)}
                         className="shell-input-rect w-24"
                       />
                       <span className="text-sm text-slate-500">days</span>
                     </div>
                   </div>
                )}
              </div>

              <div className="col-span-1 md:col-span-2 rounded-[20px] bg-slate-50 border border-slate-100 p-5 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Agent Follow-up Reminders</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically send WhatsApp notifications to assigned agents before a scheduled follow-up.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={form.followUpReminderEnabled}
                      onChange={(e) => update('followUpReminderEnabled', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
                  </label>
                </div>
                
                {form.followUpReminderEnabled && (
                   <div className="mt-4 pt-4 border-t border-slate-200">
                     <label className="block text-sm font-semibold text-slate-700">Offset minutes</label>
                     <div className="flex items-center mt-2 gap-2">
                       <input 
                         type="number" 
                         min="0" 
                         max="1440" 
                         value={form.followUpReminderMinutes}
                         onChange={(e) => update('followUpReminderMinutes', e.target.value)}
                         className="shell-input-rect w-24"
                       />
                       <span className="text-sm text-slate-500">minutes before follow-up</span>
                     </div>
                   </div>
                )}
              </div>

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
              <KeyIcon className="h-5 w-5 text-[#2d2d2d]" />
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
              <PhoneIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">WhatsApp Connection</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">TravelBot uses Marketing OS as your Meta partner layer for channel onboarding and sync.</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className={`badge ${statusTone(connection?.status)}`}>{connection?.status || 'NOT_CONNECTED'}</span>
              <span className="badge bg-slate-100 text-slate-600">Provider: {connection?.provider || agency?.whatsappProvider || 'MARKETING_OS'}</span>
              {connection?.coexistence?.enabled ? (
                <span className="badge bg-emerald-100 text-emerald-700">Coexistence: {connection.coexistence.status}</span>
              ) : null}
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
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Business App Sync</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Contacts: {connection?.coexistence?.contactSyncStatus || 'NOT_STARTED'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  History: {connection?.coexistence?.historySyncStatus || 'NOT_STARTED'}
                </p>
              </div>
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Meta Commerce Catalog ID</p>
                <p className="mt-2 text-xs text-slate-500 mb-2">Required for native WhatsApp e-commerce (product catalogs and cart checkout). Get this from Meta Commerce Manager.</p>
                <input 
                  value={form.whatsappCatalogId} 
                  onChange={(event) => update('whatsappCatalogId', event.target.value)} 
                  placeholder="e.g. 1029384756" 
                  className="shell-input-rect bg-white" 
                />
              </div>
            </div>

            {connection?.errorMessage ? (
              <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connection.errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => handleConnectWhatsApp('coexistence')} disabled={connectBusy} className="shell-button-primary">
                <LinkIcon className="h-4 w-4" />
                {connectBusy && connectMode === 'coexistence' ? 'Connecting...' : 'Connect Business App'}
              </button>
              <button type="button" onClick={() => handleConnectWhatsApp('standard')} disabled={connectBusy} className="shell-button-secondary">
                <LinkIcon className="h-4 w-4" />
                {connectBusy && connectMode === 'standard' ? 'Connecting...' : 'Connect Cloud API'}
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
              Business App: use an existing WhatsApp Business app number with coexistence.
              <br />
              Cloud API: onboard a business phone number directly to the WhatsApp Cloud API.
              <br />
              Personal WhatsApp app numbers must be moved to WhatsApp Business or Cloud API before Meta can connect them.
            </div>
          </article>

          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <CameraIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">Instagram Connection</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">Connect your Instagram Professional accounts to sync DMs and comments directly into TravelBot.</p>

            <div className="mt-6">
              {instagramConnectionQuery.data?.accounts?.length > 0 ? (
                <div className="grid gap-4">
                  {instagramConnectionQuery.data.accounts.map(acc => (
                    <div key={acc.id} className="shell-panel-soft p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {acc.profilePictureUrl && <img src={acc.profilePictureUrl} alt="" className="w-10 h-10 rounded-full" />}
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{acc.name || acc.username}</p>
                          <p className="text-xs text-slate-500">@{acc.username}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        onClick={() => disconnectIgMutation.mutate(acc.id)}
                        disabled={disconnectIgMutation.isPending}
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">No Instagram accounts connected.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button 
                type="button" 
                onClick={handleConnectInstagram} 
                disabled={connectIgMutation.isPending} 
                className="shell-button-primary"
              >
                <LinkIcon className="h-4 w-4" />
                {connectIgMutation.isPending ? 'Connecting...' : 'Connect Instagram'}
              </button>
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
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                  {connectMode === 'coexistence' ? 'Business app coexistence' : 'Cloud API onboarding'}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {connectMode === 'coexistence'
                    ? 'Use this for an existing WhatsApp Business app number. We open the Meta popup and sync contacts and history after approval.'
                    : 'Use this for a business number that should be managed directly by WhatsApp Cloud API through Marketing OS.'}
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
                  title: connectMode === 'coexistence' ? 'Meta Business app connection' : 'Meta Cloud API connection',
                  done: ['sync', 'connected'].includes(connectFlowStep),
                  active: connectFlowStep === 'meta',
                },
                {
                  key: 'sync',
                  title: connectMode === 'coexistence' ? 'Sync contacts and history' : 'Save phone configuration',
                  done: connectFlowStep === 'connected',
                  active: connectFlowStep === 'sync',
                },
              ].map((item, index) => (
                <div key={item.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      item.done
                        ? 'bg-[#ebebeb] text-[#2d2d2d]'
                        : item.active
                          ? 'bg-[#f0f0f0] text-[#2d2d2d]'
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
              <div className="mt-4 rounded-[22px] border border-[#d4d4d4] bg-[#f5f5f5] px-4 py-3 text-sm text-[#2d2d2d]">
                {connectMode === 'coexistence'
                  ? 'Complete the Meta popup, then enter the verification code inside the WhatsApp Business app.'
                  : 'Complete the Meta popup and select the business phone number for Cloud API onboarding.'}
              </div>
            ) : null}

            {connectFlowStep === 'connected' ? (
              <div className="mt-4 rounded-[22px] border border-[#d4d4d4] bg-[#f5f5f5] px-4 py-3 text-sm text-[#2d2d2d]">
                {connectMode === 'coexistence'
                  ? 'WhatsApp Business app coexistence is active. Keep the app open while history finishes syncing.'
                  : 'WhatsApp Cloud API connection is active.'}
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
                <button type="button" onClick={() => handleConnectWhatsApp(connectMode)} className="shell-button-primary flex-1">
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
