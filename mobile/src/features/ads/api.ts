// FILE: mobile/src/features/ads/api.ts
// Backed by /api/ads (backend/src/routes/ads.ts → metaAdsService), which proxies
// Meta Ads via Marketing OS. Google Ads is NOT wired on the backend — Meta is the
// only provider, so the UI does not offer a platform filter.
//
// MONEY UNITS: Meta reports spend/budgets in major currency units (rupees), NOT
// paise. Do not run these through lib/formatters.formatCurrency, which divides
// by 100 — use formatAdMoney below.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

/** Produced by metaAdsService.normalizeInsights. All numbers, never strings. */
export interface AdInsights {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerLead: number;
}

/** Produced by metaAdsService.normalizeCampaign. */
export interface AdCampaign {
  id: string;
  metaCampaignId: string;
  metaAdAccountId: string;
  name: string;
  /** Meta's enum, e.g. ACTIVE / PAUSED / ARCHIVED. */
  status: string;
  objective: string;
  platform: string;
  insights: AdInsights;
  dailyBudget: number;
  lifetimeBudget: number;
  adSetCount: number;
  adCount: number;
  /** Leads attributed in OUR CRM to this campaign — authoritative over insights.leads. */
  leadCount: number;
  startTime: string | null;
  stopTime: string | null;
}

export interface AdAccount {
  id: string;
  name?: string;
  currency?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAdAccounts() {
  return useQuery({
    queryKey: ['ads', 'accounts'],
    queryFn: async (): Promise<AdAccount[]> => {
      const res = await api.get('/ads/accounts');
      return (res.data.data ?? []) as AdAccount[];
    },
  });
}

export function useAdCampaigns() {
  return useQuery({
    queryKey: ['ads', 'campaigns'],
    queryFn: async (): Promise<AdCampaign[]> => {
      const res = await api.get('/ads/campaigns');
      return (res.data.data ?? []) as AdCampaign[];
    },
  });
}

/**
 * GET /ads/campaigns/:id/insights.
 * NOTE: the backend collapses Meta's response to a SINGLE aggregate row
 * (normalizeInsights takes source[0]) — this is not a time series, so it cannot
 * feed a trend chart.
 */
export function useAdCampaignInsights(campaignId?: string) {
  return useQuery({
    queryKey: ['ads', 'insights', campaignId],
    queryFn: async (): Promise<AdInsights> => {
      const res = await api.get(`/ads/campaigns/${encodeURIComponent(campaignId!)}/insights`);
      return res.data.data as AdInsights;
    },
    enabled: Boolean(campaignId),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /ads/connect → returns a Meta OAuth session the user must open in a browser. */
export function useConnectAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ url?: string; returnUrl?: string }> => {
      const res = await api.post('/ads/connect', {});
      return res.data.data ?? {};
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Meta money is already in rupees — format without the paise division. */
export function formatAdMoney(value: number | null | undefined): string {
  if (!value) return '₹0';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
