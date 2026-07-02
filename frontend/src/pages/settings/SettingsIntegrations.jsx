import { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../../api/client';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  LinkIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';

// --- Facebook / WhatsApp SDK Helpers ---

function loadFacebookSdk(appId) {
  return new Promise((resolve, reject) => {
    if (!appId) {
      reject(new Error('Facebook app ID is missing'));
      return;
    }
    if (window.FB) {
      window.FB.init({ appId, cookie: true, xfbml: true, version: 'v25.0' });
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = function initFacebookSdk() {
      window.FB.init({ appId, cookie: true, xfbml: true, version: 'v25.0' });
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

    const cleanup = () => window.removeEventListener('message', sessionInfoListener);
    const finish = (value) => { if (settled) return; settled = true; cleanup(); resolve(value); };
    const fail = (error) => { if (settled) return; settled = true; cleanup(); reject(error); };

    const sessionInfoListener = (event) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_err) { return; }
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
    if (embeddedSignup.featureType) extras.featureType = embeddedSignup.featureType;

    const loginOptions = {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras,
    };
    if (embeddedSignup.configId) loginOptions.config_id = embeddedSignup.configId;

    FB.login((response) => {
      const code = response?.authResponse?.code;
      if (!code) {
        fail(new Error('Facebook signup was cancelled or no authorization code was returned'));
        return;
      }
      finish({ code, sessionInfo });
    }, loginOptions);
  }));
}

// --- Instagram Connection Helpers ---

const INSTAGRAM_OAUTH_SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages'];
const DEFAULT_INSTAGRAM_APP_ID = '1458846952437606';
const CONFIGURED_INSTAGRAM_APP_ID = String(import.meta.env.VITE_INSTAGRAM_APP_ID || DEFAULT_INSTAGRAM_APP_ID).trim();

function createInstagramOAuthState() {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `travelbot_instagram_connect:${randomPart}`;
}

function startInstagramSignup(appId) {
  if (!appId) throw new Error('Instagram App ID is missing.');
  const redirectUri = `${window.location.origin}/auth/meta/callback`;
  const state = createInstagramOAuthState();
  sessionStorage.setItem('travelbot_instagram_oauth_state', state);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state,
    enable_fb_login: '0',
    force_authentication: '1',
  });
  window.location.assign(`https://www.instagram.com/oauth/authorize?${params.toString()}`);
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

export default function SettingsIntegrations() {
  const { agency, updateAgency } = useAuthStore();
  const qc = useQueryClient();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectFlowStep, setConnectFlowStep] = useState('idle');
  const [connectFlowError, setConnectFlowError] = useState('');
  const [connectMode, setConnectMode] = useState('coexistence');

  const whatsappConnectionQuery = useQuery({
    queryKey: ['whatsapp-connection'],
    queryFn: () => client.get('/agencies/me/whatsapp-connection').then((res) => res.data.data),
    initialData: agency?.whatsappConnection || null,
  });

  const whatsappChannelsQuery = useQuery({
    queryKey: ['whatsapp-channels'],
    queryFn: () => client.get('/agencies/me/whatsapp-channels').then((res) => res.data.data),
    initialData: agency?.whatsappConnection?.channels || [],
  });

  const connectMutation = useMutation({
    mutationFn: (payload = {}) => client.post('/agencies/me/whatsapp-connection/connect', payload),
    onSuccess: ({ data: response }) => {
      const connection = response.data;
      updateAgency({ whatsappConnection: connection, whatsappProvider: connection.provider });
      qc.setQueryData(['whatsapp-connection'], connection);
      if (connection?.channels) qc.setQueryData(['whatsapp-channels'], connection.channels);
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
      code, sessionToken, sessionInfo,
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
      if (connection?.channels) qc.setQueryData(['whatsapp-channels'], connection.channels);
      qc.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      setSuccess('WhatsApp connected successfully through Marketing OS.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to complete WhatsApp connection');
      setSuccess('');
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId) => client.delete(`/agencies/me/whatsapp-channels/${channelId}`),
    onSuccess: ({ data: response }) => {
      qc.setQueryData(['whatsapp-channels'], response.data || []);
      qc.invalidateQueries({ queryKey: ['whatsapp-connection'] });
      setSuccess('WhatsApp channel removed.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to remove WhatsApp channel');
      setSuccess('');
    },
  });

  const instagramConnectionQuery = useQuery({
    queryKey: ['instagram-connection'],
    queryFn: () => client.get('/agencies/me/instagram-connection').then((res) => res.data.data),
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

  const handleConnectWhatsApp = async (mode = 'coexistence') => {
    try {
      setError('');
      setSuccess('');
      setConnectMode(mode);
      setConnectModalOpen(true);
      setConnectFlowStep('handshake');
      setConnectFlowError('');

      const connectPayload = { onboardingMode: mode, provider: 'MARKETING_OS' };
      const connectResponse = await connectMutation.mutateAsync(connectPayload);
      const connectionData = connectResponse.data?.data || connectResponse.data;

      if (!connectionData?.embeddedSignup?.appId) {
        throw new Error('Missing Embedded Signup configuration from provider');
      }

      setConnectFlowStep('meta');
      const { code, sessionInfo } = await runEmbeddedSignup(connectionData.embeddedSignup);

      setConnectFlowStep('sync');
      await completeMutation.mutateAsync({
        code,
        sessionToken: connectionData.sessionToken || connectionData.embeddedSignup?.sessionToken,
        sessionInfo,
      });

      setConnectFlowStep('connected');
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to start WhatsApp connection';
      setConnectFlowStep('error');
      setConnectFlowError(message);
      setError(message);
      setSuccess('');
    }
  };

  const handleConnectInstagram = async () => {
    try {
      setError('');
      setSuccess('');
      startInstagramSignup(CONFIGURED_INSTAGRAM_APP_ID);
    } catch (err) {
      setError(err.message || 'Failed to start Instagram connection');
    }
  };

  const closeConnectModal = () => {
    setConnectModalOpen(false);
    setTimeout(() => {
      setConnectFlowStep('idle');
      setConnectFlowError('');
    }, 200);
  };

  const connection = whatsappConnectionQuery.data;
  const whatsappNumber = connection?.displayPhoneNumber || agency?.whatsappNumber || '';
  const whatsappChannels = useMemo(() => {
    const rows = Array.isArray(whatsappChannelsQuery.data) ? whatsappChannelsQuery.data : [];
    if (rows.length > 0) return rows;
    if (Array.isArray(connection?.channels) && connection.channels.length > 0) return connection.channels;
    if (!whatsappNumber) return [];
    return [{
      id: 'legacy',
      displayPhoneNumber: whatsappNumber,
      status: 'CONNECTED',
      provider: agency?.whatsappProvider || 'CLOUD_API',
      isDefault: true,
      onboardingMode: 'UNKNOWN',
    }];
  }, [whatsappChannelsQuery.data, connection?.channels, whatsappNumber, agency?.whatsappProvider]);

  const connectBusy = connectMutation.isPending || completeMutation.isPending;

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <div className="space-y-6">
        {/* WhatsApp Integrations */}
        <article className="shell-panel p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <PhoneIcon className="h-5 w-5 text-[#2d2d2d]" />
                <h2 className="text-xl font-extrabold text-slate-950">WhatsApp Channels</h2>
              </div>
              <p className="mt-3 text-sm text-slate-500">Connect and manage multiple WhatsApp Business numbers for this agency.</p>
            </div>
            <span className="badge bg-slate-100 text-slate-600">{whatsappChannels.length} connected</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => handleConnectWhatsApp('coexistence')} disabled={connectBusy} className="shell-button-primary">
              <PlusIcon className="h-4 w-4" />
              {connectBusy && connectMode === 'coexistence' ? 'Connecting...' : 'Add Business App Number'}
            </button>
            <button type="button" onClick={() => handleConnectWhatsApp('standard')} disabled={connectBusy} className="shell-button-secondary">
              <LinkIcon className="h-4 w-4" />
              {connectBusy && connectMode === 'standard' ? 'Connecting...' : 'Add Cloud API Number'}
            </button>
            <button
              type="button"
              onClick={() => {
                whatsappConnectionQuery.refetch();
                whatsappChannelsQuery.refetch();
              }}
              disabled={whatsappConnectionQuery.isFetching || whatsappChannelsQuery.isFetching}
              className="shell-button-secondary"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              {whatsappConnectionQuery.isFetching || whatsappChannelsQuery.isFetching ? 'Refreshing...' : 'Refresh channels'}
            </button>
          </div>

          {whatsappChannelsQuery.isError ? (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Channel list API is unavailable. Showing the legacy connected number.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {whatsappChannels.length > 0 ? whatsappChannels.map((channel) => {
              const isLegacy = channel.id === 'legacy';
              const canRemove = !isLegacy;
              return (
                <div key={channel.id || channel.phoneNumberId || channel.displayPhoneNumber} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-extrabold text-slate-950">{channel.label || channel.displayPhoneNumber || channel.whatsappNumber || 'WhatsApp Number'}</p>
                        <span className={`badge ${statusTone(channel.status)}`}>{channel.status || 'NOT_CONNECTED'}</span>
                        {channel.isDefault ? <span className="badge bg-[#f0f0f0] text-[#2d2d2d]">Default</span> : null}
                        {channel.isActive === false ? <span className="badge bg-rose-100 text-rose-700">Inactive</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{channel.displayPhoneNumber || channel.whatsappNumber || 'Number pending provider sync'}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">Meta Phone Number ID: {channel.phoneNumberId || 'Waiting for provider sync'}</p>
                      <p className="mt-1 text-xs text-slate-500">Provider: {channel.provider || 'MARKETING_OS'} · Mode: {channel.onboardingMode || 'STANDARD'}</p>
                      {channel.coexistence?.enabled ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Contacts: {channel.coexistence.contactSyncStatus || 'NOT_STARTED'} · History: {channel.coexistence.historySyncStatus || 'NOT_STARTED'}
                        </p>
                      ) : null}
                      {channel.errorMessage ? <p className="mt-2 text-xs font-semibold text-rose-600">{channel.errorMessage}</p> : null}
                    </div>
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => {
                          const number = channel.displayPhoneNumber || channel.whatsappNumber || channel.label || 'this number';
                          const message = channel.isDefault
                            ? `Disconnect ${number}? It will be removed from this agency, and another connected number (if any) will become the default.`
                            : `Disconnect ${number}? It will be removed from this agency.`;
                          if (window.confirm(message)) deleteChannelMutation.mutate(channel.id);
                        }}
                        disabled={deleteChannelMutation.isPending}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        title="Disconnect number"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No WhatsApp numbers connected yet.</p>
                <p className="mt-1 text-xs text-slate-500">Use Business App or Cloud API onboarding to add the first number.</p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
            Business App uses an existing WhatsApp Business app number with coexistence. Cloud API onboards a business phone number directly through Marketing OS.
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-200 grid gap-6 md:grid-cols-2">
            <Field label="WhatsApp number" hint="This updates automatically after your provider connection is approved.">
              <input value={whatsappNumber} disabled className="shell-input-rect cursor-not-allowed opacity-60" />
            </Field>

            <Field label="Plan">
              <div className="rounded-[20px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{agency?.plan || 'FREE'}</div>
            </Field>
          </div>
        </article>

        {/* Instagram Integrations */}
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
      </div>

      {/* Connect WhatsApp Modal */}
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
