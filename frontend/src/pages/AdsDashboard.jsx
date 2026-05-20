import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ChartBarIcon,
  CursorArrowRaysIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  MegaphoneIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { adsApi } from '../api/adsApi';
import { leadsApi } from '../api/leadsApi';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { formatSource } from '../utils/leadInsights';

function metricNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return metricNumber(value).toLocaleString('en-IN');
}

function formatPercent(value, digits = 2) {
  const parsed = metricNumber(value);
  if (!parsed) return '-';
  return `${parsed.toFixed(digits)}%`;
}

function formatMajorCurrency(value) {
  return formatCurrency(Math.round(metricNumber(value) * 100));
}

function formatMinorCurrency(value) {
  const parsed = metricNumber(value);
  return parsed > 0 ? formatCurrency(parsed) : '-';
}

function compactLabel(value) {
  return String(value || '-').replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function campaignInsights(campaign = {}) {
  return campaign.insights || campaign.lastInsights || {};
}

function statusTone(status = '') {
  const normalized = String(status).toUpperCase();
  if (['ACTIVE', 'ENABLED'].includes(normalized)) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (['PAUSED', 'PENDING_REVIEW'].includes(normalized)) return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  return 'bg-neutral-100 text-neutral-600 ring-neutral-300';
}

function isMetaNotConnected(error) {
  const code = error?.response?.data?.code;
  return code === 'META_NOT_CONNECTED';
}

function isMetaPermissionMissing(error) {
  return error?.response?.data?.code === 'META_ADS_PERMISSION_MISSING';
}

function metaErrorMessage(error) {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || '';
}

export default function AdsDashboard() {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const connectPopupRef = useRef(null);
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: () => adsApi.accounts(),
    retry: false,
  });

  const campaignsQuery = useQuery({
    queryKey: ['meta-campaigns'],
    queryFn: () => adsApi.campaigns(),
    retry: false,
    enabled: !isMetaNotConnected(accountsQuery.error),
  });

  const formsQuery = useQuery({
    queryKey: ['meta-lead-forms'],
    queryFn: () => adsApi.forms(),
    retry: false,
    enabled: !isMetaNotConnected(accountsQuery.error),
  });

  const adLeadsQuery = useQuery({
    queryKey: ['meta-ad-leads'],
    queryFn: () => leadsApi.list({ source: 'facebook_ad,instagram_ad', pageSize: 200 }),
    retry: false,
    enabled: !isMetaNotConnected(accountsQuery.error),
  });

  const refreshMetaAdsData = () => {
    queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['meta-lead-forms'] });
    queryClient.invalidateQueries({ queryKey: ['meta-ad-leads'] });
    accountsQuery.refetch();
    campaignsQuery.refetch();
    formsQuery.refetch();
    adLeadsQuery.refetch();
  };

  const watchConnectPopup = () => {
    const watcher = window.setInterval(() => {
      const popup = connectPopupRef.current;
      if (!popup || !popup.closed) return;

      window.clearInterval(watcher);
      connectPopupRef.current = null;
      refreshMetaAdsData();
    }, 1000);

    window.setTimeout(() => window.clearInterval(watcher), 5 * 60 * 1000);
  };

  useEffect(() => {
    const handleMetaConnectMessage = (event) => {
      if (event.origin !== 'https://app.wayon.in') return;
      if (event.data?.type !== 'TRAVELBOT_META_ADS_CONNECTED') return;

      toast.success('Meta Ads connected. Refreshing Travelbot...');
      refreshMetaAdsData();
      connectPopupRef.current?.close?.();
      connectPopupRef.current = null;
    };

    window.addEventListener('message', handleMetaConnectMessage);
    return () => window.removeEventListener('message', handleMetaConnectMessage);
  }, []);

  const backfillMutation = useMutation({
    mutationFn: (formId) => adsApi.backfillForm(formId, { limit: 200 }),
    onSuccess: (response) => {
      toast.success(response?.message || 'Meta leads synced');
      queryClient.invalidateQueries({ queryKey: ['meta-ad-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Lead backfill failed');
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => adsApi.connect({
      returnUrl: `${window.location.origin}/ads`,
      webhookUrl: `${window.location.origin}/api/ads/webhook/leadgen`,
    }),
    onSuccess: (response) => {
      const connectUrl = response?.data?.connectUrl;
      if (!connectUrl) {
        connectPopupRef.current?.close?.();
        connectPopupRef.current = null;
        toast.error('Marketing OS did not return a Meta Ads connect URL');
        return;
      }

      const popup = connectPopupRef.current;
      if (!popup) {
        window.location.assign(connectUrl);
        return;
      }

      popup.location.href = connectUrl;
      watchConnectPopup();
      toast.success('Finish Meta Ads connection in the Marketing OS window');
    },
    onError: (error) => {
      connectPopupRef.current?.close?.();
      connectPopupRef.current = null;
      toast.error(error?.response?.data?.error || 'Failed to start Meta Ads connection');
    },
  });

  const handleConnectAdAccount = () => {
    connectPopupRef.current = window.open('', 'travelbot-meta-ads-connect', 'width=1040,height=780');
    if (connectPopupRef.current) {
      connectPopupRef.current.document.write('<!doctype html><title>Connecting Meta Ads</title><body style="font-family:system-ui;padding:32px;color:#111827">Preparing secure Marketing OS connection...</body>');
    }
    connectMutation.mutate();
  };

  const accounts = accountsQuery.data?.data || [];
  const campaigns = campaignsQuery.data?.data || [];
  const forms = formsQuery.data?.data || [];
  const adLeads = adLeadsQuery.data?.data?.data || [];
  const notConnected = isMetaNotConnected(accountsQuery.error) || isMetaNotConnected(campaignsQuery.error);
  const permissionMissing = isMetaPermissionMissing(accountsQuery.error) || isMetaPermissionMissing(campaignsQuery.error);
  const adsError = accountsQuery.error || campaignsQuery.error;
  const hasExistingMetaData = accounts.length > 0 || campaigns.length > 0;
  const connectLabel = hasExistingMetaData ? 'Reconnect Meta Ads' : 'Connect Ad Account';

  const summary = useMemo(() => {
    return campaigns.reduce((acc, campaign) => {
      const insights = campaignInsights(campaign);
      const leads = metricNumber(campaign.leadCount ?? insights.leads);
      acc.active += ['ACTIVE', 'ENABLED'].includes(String(campaign.status || '').toUpperCase()) ? 1 : 0;
      acc.spend += metricNumber(insights.spend);
      acc.clicks += metricNumber(insights.clicks);
      acc.impressions += metricNumber(insights.impressions);
      acc.leads += leads;
      return acc;
    }, {
      active: 0,
      spend: 0,
      clicks: 0,
      impressions: 0,
      leads: 0,
    });
  }, [adLeads.length, campaigns]);

  const selectedLeads = selectedCampaign
    ? adLeads.filter((lead) => lead.metaCampaignId === selectedCampaign.metaCampaignId)
    : [];

  if (notConnected) {
    return (
      <div className="w-full px-3 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <MegaphoneIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-neutral-900">Connect Meta to sync ad leads</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Social Ads uses your existing Marketing OS connection to read Facebook and Instagram Lead Ads, import leads into the CRM, and report spend and cost per lead.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Connect the company's Meta ad account through Marketing OS to enable campaign reporting and lead retrieval.
          </div>
          <button
            type="button"
            onClick={handleConnectAdAccount}
            disabled={connectMutation.isPending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LinkIcon className="h-4 w-4" />
            {connectMutation.isPending ? 'Opening Marketing OS...' : connectLabel}
          </button>
        </div>
      </div>
    );
  }

  if (permissionMissing) {
    return (
      <div className="w-full px-3 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-neutral-900">Meta Ads permissions need approval</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Meta is linked, but the current token does not include the ad account and lead retrieval permissions required for campaign reporting.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Reconnect Meta Ads and approve the Ads and Lead permissions shown by Facebook.
          </div>
          <button
            type="button"
            onClick={handleConnectAdAccount}
            disabled={connectMutation.isPending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LinkIcon className="h-4 w-4" />
            {connectMutation.isPending ? 'Opening Marketing OS...' : 'Reconnect Meta Ads'}
          </button>
        </div>
      </div>
    );
  }

  const isLoading = accountsQuery.isLoading || campaignsQuery.isLoading || formsQuery.isLoading;

  return (
    <div className="w-full px-3 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Social Ads</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Facebook and Instagram lead ads, synced into your Travelbot CRM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConnectAdAccount}
            disabled={connectMutation.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LinkIcon className="h-4 w-4" />
            {connectMutation.isPending ? 'Opening...' : connectLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              accountsQuery.refetch();
              campaignsQuery.refetch();
              formsQuery.refetch();
              adLeadsQuery.refetch();
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {adsError ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {metaErrorMessage(adsError) || 'Meta Ads data could not be refreshed. Reconnect Meta Ads if this continues.'}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat icon={MegaphoneIcon} label="Active Campaigns" value={formatNumber(summary.active)} />
        <Stat icon={ChartBarIcon} label="Spend" value={formatMajorCurrency(summary.spend)} />
        <Stat icon={CursorArrowRaysIcon} label="Impressions" value={formatNumber(summary.impressions)} />
        <Stat icon={CursorArrowRaysIcon} label="Clicks" value={formatNumber(summary.clicks)} />
        <Stat icon={UserGroupIcon} label="Ad Leads" value={formatNumber(adLeads.length || summary.leads)} />
        <Stat
          icon={DocumentTextIcon}
          label="Cost / Lead"
          value={(adLeads.length || summary.leads) > 0 ? formatMajorCurrency(summary.spend / (adLeads.length || summary.leads)) : '-'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-bold text-neutral-900">Campaigns</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm font-medium text-neutral-500">Loading Meta campaigns...</div>
          ) : campaigns.length === 0 ? (
            <EmptyState title="No campaigns found" text="Once the connected company runs Facebook or Instagram lead ads, campaigns will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-100 text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-bold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Objective</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Impr.</th>
                    <th className="px-5 py-3 text-right">Spend</th>
                    <th className="px-5 py-3 text-right">Clicks</th>
                    <th className="px-5 py-3 text-right">Leads</th>
                    <th className="px-5 py-3 text-right">CTR</th>
                    <th className="px-5 py-3 text-right">CPL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {campaigns.map((campaign) => {
                    const insights = campaignInsights(campaign);
                    const leads = metricNumber(campaign.leadCount ?? insights.leads);
                    const spend = metricNumber(insights.spend);
                    return (
                      <tr
                        key={campaign.metaCampaignId || campaign.id}
                        className="cursor-pointer transition hover:bg-neutral-50"
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-neutral-900">{campaign.name || 'Untitled campaign'}</div>
                          <div className="mt-1 text-xs text-neutral-400">{campaign.metaCampaignId || campaign.id}</div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {formatNumber(campaign.adSetCount)} ad sets / {formatNumber(campaign.adCount)} ads
                          </div>
                        </td>
                        <td className="px-5 py-4 text-neutral-600">{compactLabel(campaign.objective)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusTone(campaign.status)}`}>
                            {campaign.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-neutral-600">{formatNumber(insights.impressions)}</td>
                        <td className="px-5 py-4 text-right font-semibold text-neutral-700">{formatMajorCurrency(spend)}</td>
                        <td className="px-5 py-4 text-right text-neutral-600">{formatNumber(insights.clicks)}</td>
                        <td className="px-5 py-4 text-right text-neutral-600">{formatNumber(leads)}</td>
                        <td className="px-5 py-4 text-right text-neutral-600">{formatPercent(insights.ctr)}</td>
                        <td className="px-5 py-4 text-right text-neutral-600">
                          {leads > 0 ? formatMajorCurrency(spend / leads) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-neutral-900">Connected Accounts</h2>
            <div className="mt-4 space-y-3">
              {accounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm text-neutral-500">No ad accounts returned by Marketing OS.</p>
                  <button
                    type="button"
                    onClick={handleConnectAdAccount}
                    disabled={connectMutation.isPending}
                    className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 text-xs font-bold text-white disabled:opacity-60"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Connect Ad Account
                  </button>
                </div>
              ) : accounts.map((account) => (
                <div key={account.id || account.accountId} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-sm font-semibold text-neutral-900">{account.name || account.accountName || 'Meta ad account'}</p>
                  <p className="mt-1 text-xs text-neutral-400">{account.id || account.accountId}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-neutral-600">{account.currency || 'Currency -'}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-neutral-600">Status {account.status || '-'}</span>
                    <span className="col-span-2 rounded-lg bg-white px-2 py-1 font-semibold text-neutral-600">{account.timezone || 'Timezone -'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-neutral-900">Lead Forms</h2>
            <div className="mt-4 space-y-3">
              {forms.length === 0 ? (
                <p className="text-sm text-neutral-500">No lead forms found yet.</p>
              ) : forms.map((form) => (
                <div key={form.metaFormId || form.id} className="rounded-xl border border-neutral-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{form.name || 'Lead form'}</p>
                      <p className="mt-1 text-xs text-neutral-400">{form.metaFormId || form.id}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {[form.pageName, form.status, `${formatNumber(form.leadsCount)} leads`, `${formatNumber(form.questionsCount)} questions`].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => backfillMutation.mutate(form.metaFormId || form.id)}
                      disabled={backfillMutation.isPending}
                      className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Sync
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <CampaignDrawer
        campaign={selectedCampaign}
        leads={selectedLeads}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <ExclamationTriangleIcon className="h-10 w-10 text-neutral-300" />
      <h3 className="mt-3 text-sm font-bold text-neutral-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{text}</p>
    </div>
  );
}

function CampaignDrawer({ campaign, leads, onClose }) {
  if (!campaign) return null;
  const insights = campaignInsights(campaign);
  const spend = metricNumber(insights.spend);
  const leadCount = leads.length || metricNumber(campaign.leadCount ?? insights.leads);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-100 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Meta Campaign</p>
            <h2 className="mt-1 text-xl font-bold text-neutral-900">{campaign.name || 'Untitled campaign'}</h2>
            <p className="mt-1 text-xs text-neutral-400">{campaign.metaCampaignId || campaign.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Status" value={campaign.status || '-'} />
            <Detail label="Objective" value={compactLabel(campaign.objective)} />
            <Detail label="Buying Type" value={compactLabel(campaign.buyingType)} />
            <Detail label="Ad Account" value={campaign.metaAdAccountId || '-'} />
            <Detail label="Spend" value={formatMajorCurrency(spend)} />
            <Detail label="Impressions" value={formatNumber(insights.impressions)} />
            <Detail label="Leads" value={formatNumber(leadCount)} />
            <Detail label="Clicks" value={formatNumber(insights.clicks)} />
            <Detail label="CTR" value={formatPercent(insights.ctr)} />
            <Detail label="CPC" value={metricNumber(insights.cpc) > 0 ? formatMajorCurrency(insights.cpc) : '-'} />
            <Detail label="CPM" value={metricNumber(insights.cpm) > 0 ? formatMajorCurrency(insights.cpm) : '-'} />
            <Detail label="Cost / Lead" value={leadCount > 0 ? formatMajorCurrency(spend / leadCount) : '-'} />
            <Detail label="Daily Budget" value={formatMinorCurrency(campaign.dailyBudget)} />
            <Detail label="Lifetime Budget" value={formatMinorCurrency(campaign.lifetimeBudget)} />
            <Detail label="Ad Sets" value={formatNumber(campaign.adSetCount)} />
            <Detail label="Ads" value={formatNumber(campaign.adCount)} />
            <Detail label="Started" value={formatDate(campaign.startTime)} />
            <Detail label="Updated" value={formatDate(campaign.updatedTime)} />
          </div>

          <section className="rounded-2xl border border-neutral-200 p-4">
            <h3 className="text-sm font-bold text-neutral-900">Recent Leads</h3>
            <div className="mt-4 space-y-3">
              {leads.length === 0 ? (
                <p className="text-sm text-neutral-500">No synced leads for this campaign yet.</p>
              ) : leads.slice(0, 10).map((lead) => (
                <div key={lead.id} className="rounded-xl bg-neutral-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{lead.customer?.name || 'Unnamed lead'}</p>
                      <p className="mt-1 text-xs text-neutral-500">{lead.customer?.phone || lead.customer?.email || '-'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-500">
                      {formatSource(lead.source)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">{formatDateTime(lead.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
