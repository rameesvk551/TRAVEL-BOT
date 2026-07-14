// FILE: mobile/src/features/campaigns/api.ts
// Backed by /api/campaigns (backend/src/routes/campaigns.ts).
// Envelope: { success: true, data: ... }. The LIST route spreads its service
// result, so it is { success, total, data, page, pageSize, summary }.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
export type CampaignType =
  | 'BROADCAST'
  | 'PROMOTIONAL'
  | 'RE_ENGAGEMENT'
  | 'SEASONAL'
  | 'REVIEW_COLLECTION';

export interface CampaignTemplateRef {
  displayName?: string;
  icon?: string | null;
  category?: string;
}

/** Mirrors backend/src/models/Campaign.ts. Every campaign is WhatsApp — there is no channel field. */
export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  format: 'STANDARD' | 'SECTION_CTA' | 'ITEM_CAROUSEL';
  status: CampaignStatus;
  mediaType: 'NONE' | 'IMAGE' | 'VIDEO';
  mediaUrl: string | null;
  templateId: string | null;
  messageBody: string | null;
  audienceFilter: Record<string, unknown>;
  audienceCount: number;
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  scheduledAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template?: CampaignTemplateRef | null;
}

export interface CampaignSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  sentCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalReplied: number;
  totalFailed: number;
}

export interface CampaignListResult {
  data: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  summary: CampaignSummary;
}

/** GET /campaigns/:id/stats */
export interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  clicked: number;
  leads: number;
  bookings: number;
  /** Paise. */
  revenue: number;
}

export interface CampaignTimelinePoint {
  hour: string;
  sent: number;
  delivered: number;
  read: number;
}

export interface CampaignStatsResult {
  campaign: Campaign;
  stats: CampaignStats;
  timeline: CampaignTimelinePoint[];
}

export interface CampaignInput {
  name: string;
  type: CampaignType;
  messageBody?: string;
  templateId?: string | null;
  audienceFilter?: Record<string, unknown>;
  scheduledAt?: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** `status` is the backend enum, or undefined for all. */
export function useCampaigns(status?: CampaignStatus) {
  return useQuery({
    queryKey: ['campaigns', 'list', status ?? 'ALL'],
    queryFn: async (): Promise<CampaignListResult> => {
      const res = await api.get('/campaigns', {
        params: { status, pageSize: 50 },
      });
      const body = res.data;
      return {
        data: (body.data ?? []) as Campaign[],
        total: body.total ?? 0,
        page: body.page ?? 1,
        pageSize: body.pageSize ?? 50,
        summary: body.summary ?? {
          totalCampaigns: 0,
          activeCampaigns: 0,
          sentCampaigns: 0,
          totalRecipients: 0,
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          totalReplied: 0,
          totalFailed: 0,
        },
      };
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', 'detail', id],
    queryFn: async (): Promise<Campaign> => {
      const res = await api.get(`/campaigns/${id}`);
      return res.data.data as Campaign;
    },
    enabled: Boolean(id),
  });
}

export function useCampaignStats(id: string, enabled = true) {
  return useQuery({
    queryKey: ['campaigns', 'stats', id],
    queryFn: async (): Promise<CampaignStatsResult> => {
      const res = await api.get(`/campaigns/${id}/stats`);
      return res.data.data as CampaignStatsResult;
    },
    enabled: Boolean(id) && enabled,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignInput): Promise<Campaign> => {
      const res = await api.post('/campaigns', input);
      return res.data.data as Campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CampaignInput> & { id: string }): Promise<Campaign> => {
      const res = await api.patch(`/campaigns/${id}`, input);
      return res.data.data as Campaign;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'detail', vars.id] });
    },
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Campaign> => {
      const res = await api.post(`/campaigns/${id}/send`);
      return res.data.data as Campaign;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'detail', id] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'stats', id] });
    },
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Campaign> => {
      const res = await api.post(`/campaigns/${id}/cancel`);
      return res.data.data as Campaign;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'detail', id] });
    },
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Campaign> => {
      const res = await api.post(`/campaigns/${id}/duplicate`);
      return res.data.data as Campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/** POST /campaigns/preview-audience → { count }. Used by the form's audience step. */
export function usePreviewAudience() {
  return useMutation({
    mutationFn: async (audienceFilter: Record<string, unknown>): Promise<number> => {
      const res = await api.post('/campaigns/preview-audience', audienceFilter);
      return (res.data.data?.count ?? 0) as number;
    },
  });
}
