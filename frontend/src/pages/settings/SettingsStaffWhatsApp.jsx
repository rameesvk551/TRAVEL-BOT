import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinkIcon, RefreshCw, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { agentsApi } from '../../api/agentsApi';
import { staffWhatsAppApi } from '../../api/staffWhatsAppApi';
import { useAgencyTemplates, useSyncTemplates } from '../../hooks/useTemplates';
import TemplateDetailDrawer from '../../components/TemplateDetailDrawer';
import toast from 'react-hot-toast';
import client from '../../api/client';

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

    FB.login((response) => {
      const code = response?.authResponse?.code;
      if (!code) {
        fail(new Error('Facebook signup was cancelled or no authorization code was returned'));
        return;
      }
      finish({ code, sessionInfo });
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        featureType: embeddedSignup.featureType,
        sessionInfoVersion: embeddedSignup.sessionInfoVersion || '3',
        version: 'v3',
        setup: {},
      },
      ...(embeddedSignup.configId ? { config_id: embeddedSignup.configId } : {}),
    });
  }));
}

function statusTone(status) {
  if (status === 'CONNECTED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (status === 'FAILED') return 'bg-rose-100 text-rose-700';
  return 'bg-neutral-100 text-neutral-600';
}

function CardField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-neutral-500">{hint}</p> : null}
    </label>
  );
}

export default function SettingsStaffWhatsApp() {
  const agency = useAuthStore((state) => state.agency);
  const agent = useAuthStore((state) => state.agent);
  const updateAgency = useAuthStore((state) => state.updateAgency);
  const qc = useQueryClient();
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [drawerMode, setDrawerMode] = useState('view');
  const [connectBusy, setConnectBusy] = useState(false);
  const [assignmentChatEnabled, setAssignmentChatEnabled] = useState(
    agency?.whatsappFlowConfig?.assignmentAutoFirstOutreachButtonEnabled === true
  );

  useEffect(() => {
    setAssignmentChatEnabled(agency?.whatsappFlowConfig?.assignmentAutoFirstOutreachButtonEnabled === true);
  }, [agency?.whatsappFlowConfig]);

  const channelsQuery = useQuery({
    queryKey: ['staff-whatsapp-channels'],
    queryFn: () => staffWhatsAppApi.listChannels(),
    enabled: Boolean(agency?.staffWhatsAppEnabled),
  });

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
    enabled: Boolean(agency?.staffWhatsAppEnabled),
  });

  const channels = channelsQuery.data?.data || [];
  const agents = agentsQuery.data?.data || [];

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
    if (selectedChannelId && !channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(channels[0]?.id || '');
    }
  }, [channels, selectedChannelId]);

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) || null;

  const templatesQuery = useAgencyTemplates({
    channelId: selectedChannelId || undefined,
  });
  const channelTemplates = templatesQuery.data?.data || [];
  const approvedTemplates = channelTemplates.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED');
  const syncTemplates = useSyncTemplates();

  const saveChannelMutation = useMutation({
    mutationFn: ({ channelId, data }) => staffWhatsAppApi.updateChannel(channelId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-whatsapp-channels'] });
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId) => staffWhatsAppApi.deleteChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-whatsapp-channels'] });
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const saveAssignmentBehaviorMutation = useMutation({
    mutationFn: (enabled) => client.patch('/agencies/me', {
      whatsappFlowConfig: {
        ...(agency?.whatsappFlowConfig || {}),
        assignmentAutoFirstOutreachButtonEnabled: enabled,
      },
    }),
    onSuccess: ({ data: response }) => {
      updateAgency(response.data);
      toast.success('Assignment chat behavior updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to update assignment chat behavior');
    },
  });

  const handleConnect = async () => {
    try {
      setConnectBusy(true);
      const sessionResponse = await staffWhatsAppApi.createConnectSession({ onboardingMode: 'coexistence' });
      const embeddedSignup = sessionResponse?.data?.embeddedSignup;
      if (!embeddedSignup) throw new Error('Embedded signup details are missing');
      const { code, sessionInfo } = await runEmbeddedSignup(embeddedSignup);
      await staffWhatsAppApi.completeConnectSession({
        code,
        sessionToken: embeddedSignup.sessionToken,
        sessionInfo,
        phoneNumberId: sessionInfo?.phone_number_id,
        wabaId: sessionInfo?.waba_id,
        businessId: sessionInfo?.business_id,
      });
      await qc.invalidateQueries({ queryKey: ['staff-whatsapp-channels'] });
      toast.success('Staff WhatsApp number connected');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to connect staff WhatsApp number');
    } finally {
      setConnectBusy(false);
    }
  };

  if (!agency?.staffWhatsAppEnabled) {
    return (
      <div className="shell-panel p-6">
        <p className="eyebrow">Staff WhatsApp Numbers</p>
        <h2 className="mt-2 text-2xl font-extrabold text-neutral-950">Feature not enabled</h2>
        <p className="mt-3 max-w-2xl text-sm text-neutral-500">
          Your platform admin must enable this feature for the agency before staff-owned WhatsApp numbers can be connected and mapped.
        </p>
      </div>
    );
  }

  if (agent?.role !== 'ADMIN') {
    return (
      <div className="shell-panel p-6">
        <p className="eyebrow">Staff WhatsApp Numbers</p>
        <h2 className="mt-2 text-2xl font-extrabold text-neutral-950">Admin access required</h2>
        <p className="mt-3 max-w-2xl text-sm text-neutral-500">
          Only agency admins can connect staff-owned WhatsApp numbers and manage their outreach templates.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <article className="shell-panel p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Staff Outreach</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-950">Staff WhatsApp Numbers</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500">
                Connect staff-owned WhatsApp Business numbers for one-time first outreach, then let the staff continue manually in their own app.
              </p>
            </div>
            <button type="button" onClick={handleConnect} disabled={connectBusy} className="shell-button-primary">
              <LinkIcon className="h-4 w-4" />
              {connectBusy ? 'Connecting...' : 'Connect Staff Number'}
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            {channels.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                No staff WhatsApp numbers connected yet.
              </div>
            ) : channels.map((channel) => (
              <div key={channel.id} className={`rounded-[24px] border p-4 transition ${selectedChannelId === channel.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-neutral-950">{channel.label || channel.displayPhoneNumber || 'Staff Number'}</p>
                      <span className={`badge ${statusTone(channel.status)}`}>{channel.status}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-800">{channel.displayPhoneNumber || channel.whatsappNumber || 'Number pending sync'}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Assigned staff: {channel.assignedAgent?.name || 'Not mapped'} · Approved templates: {channel.approvedTemplateCount || 0}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
                    <CardField label="Assign Staff">
                      <select
                        value={channel.assignedAgent?.id || ''}
                        onChange={(event) => saveChannelMutation.mutate({ channelId: channel.id, data: { agentId: event.target.value || null } })}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </CardField>

                    <div className="flex items-end gap-2">
                      <button type="button" onClick={() => setSelectedChannelId(channel.id)} className="shell-button-secondary flex-1 px-3 py-2 text-sm">
                        <MessageSquare className="h-4 w-4" />
                        Manage Templates
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${channel.displayPhoneNumber || channel.label || 'this staff number'}?`)) {
                            deleteChannelMutation.mutate(channel.id);
                          }
                        }}
                        className="shell-button-secondary px-3 py-2 text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="shell-panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">Assignment Chat CTA</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-950">Auto-send on assignment button</h2>
              <p className="mt-2 max-w-3xl text-sm text-neutral-500">
                When enabled, the lead-assignment WhatsApp template can include a <strong>Chat Customer</strong> URL button.
                Tapping that button triggers the first approved outreach from CRM automatically, then opens the customer chat for manual follow-up.
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveAssignmentBehaviorMutation.mutate(assignmentChatEnabled)}
              disabled={saveAssignmentBehaviorMutation.isPending}
              className="shell-button-primary"
            >
              {saveAssignmentBehaviorMutation.isPending ? 'Saving...' : 'Save Setting'}
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={assignmentChatEnabled}
                onChange={(event) => setAssignmentChatEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">Enable one-tap assignment chat</span>
                <span className="mt-1 block text-xs text-neutral-500">
                  Use this for agencies like GetOut House that want the assignment notification itself to trigger the first outreach automatically.
                  To use it, the approved assignment template should include a URL button that ends with a token placeholder such as <code>t=&#123;&#123;8&#125;&#125;</code>.
                </span>
              </span>
            </label>
          </div>
        </article>

        {selectedChannel ? (
          <article className="shell-panel p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Templates</p>
                <h2 className="mt-2 text-2xl font-extrabold text-neutral-950">
                  Templates for {selectedChannel.displayPhoneNumber || selectedChannel.label || 'staff number'}
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Create and approve first-outreach templates for this number only, then choose the default one used on lead outreach.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => syncTemplates.mutate(
                    { channelId: selectedChannel.id },
                    { onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-whatsapp-channels'] }) }
                  )}
                  disabled={syncTemplates.isPending}
                  className="shell-button-secondary"
                >
                  <RefreshCw className={`h-4 w-4 ${syncTemplates.isPending ? 'animate-spin' : ''}`} />
                  {syncTemplates.isPending ? 'Syncing...' : 'Sync Templates'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setDrawerMode('edit');
                    setDrawerOpen(true);
                  }}
                  className="shell-button-primary"
                >
                  <Plus className="h-4 w-4" />
                  New Template
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[320px,1fr]">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
                <CardField label="Default First Outreach Template" hint="Only approved templates for this number can be selected here.">
                  <select
                    value={selectedChannel.defaultFirstOutreachTemplate?.id || ''}
                    onChange={(event) => saveChannelMutation.mutate({
                      channelId: selectedChannel.id,
                      data: { defaultFirstOutreachTemplateId: event.target.value || null },
                    })}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Not selected</option>
                    {approvedTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.displayName}</option>
                    ))}
                  </select>
                </CardField>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {channelTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setDrawerMode('view');
                      setDrawerOpen(true);
                    }}
                    className="rounded-[24px] border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-lg">
                        {template.icon || '💬'}
                      </div>
                      <span className={`badge ${statusTone(template.status)}`}>{template.status}</span>
                    </div>
                    <h3 className="mt-4 font-bold text-neutral-900">{template.displayName}</h3>
                    <p className="mt-2 line-clamp-4 text-sm text-neutral-500">{template.body}</p>
                  </button>
                ))}
                {channelTemplates.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500 md:col-span-2 xl:col-span-3">
                    No templates created for this staff number yet.
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <TemplateDetailDrawer
        template={selectedTemplate}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isPrebuilt={false}
        initialMode={drawerMode}
        fixedChannelId={selectedChannelId || null}
      />
    </>
  );
}
