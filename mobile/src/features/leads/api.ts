// FILE: mobile/src/features/leads/api.ts
// Real CRM endpoints — no mock fallbacks. A failed request must reach react-query
// so the screen renders ErrorState; swallowing it into fake rows hides 401s/500s.
//
// Backend envelope is always { success: true, data: <payload> }, so every read is
// `res.data.data`.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

/* ------------------------------------------------------------------ types -- */

/** The canonical lead statuses the PATCH/POST zod schema accepts. */
export type LeadStatus =
  | 'JUST_CONTACTED' | 'PACKAGE_SEARCHED' | 'PACKAGE_INTERESTED' | 'NEW' | 'ENQUIRY'
  | 'CONTACTED' | 'QUOTED' | 'NEGOTIATING' | 'BOOKED' | 'CONVERTED' | 'LOST'
  | 'CANCELLED' | 'UNKNOWN';

export interface LeadCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
}

export interface AgentRef {
  id: string;
  name: string;
  email?: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  kind: 'OPEN' | 'WON' | 'LOST';
  position: number;
  leadStatuses?: string[];
  isActive?: boolean;
}

export interface FollowUp {
  id: string;
  leadId: string;
  agentId: string | null;
  scheduledAt: string;
  note: string | null;
  status: 'Scheduled' | 'Done' | 'Cancelled';
  type?: string | null;
  outcome?: string | null;
  agent?: AgentRef | null;
}

export interface Lead {
  id: string;
  customerId: string | null;
  customer?: LeadCustomer | null;
  assignedAgentId: string | null;
  assignedAgent?: AgentRef | null;
  /** null while the lead sits in the entry stage. */
  status: LeadStatus | null;
  pipelineStageId: string | null;
  pipelineStage?: PipelineStage | null;
  destination: string | null;
  place?: string | null;
  source: string | null;
  /** Paise, per traveller. */
  budgetPerPerson: number | null;
  travellers: number | null;
  leadScore: number;
  tags: string[];
  notes: string | null;
  /** The list endpoint only attaches follow-ups that are still Scheduled (ASC). */
  followUps?: FollowUp[];
  package?: { id: string; name: string; basePrice: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  note: string | null;
  actor: string | null;
  status: string | null;
  time: string;
  metadata: string[];
  source: string | null;
}

export interface LeadNote {
  id: string;
  content: string;
  createdAt: string;
  agent?: { id: string; name: string } | null;
}

/** GET /leads/:id — the lead plus its full history. */
export interface LeadDetail extends Lead {
  followUps: FollowUp[];
  notesList: LeadNote[];
  timeline: TimelineEvent[];
}

export interface LeadListResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  metrics: { totalDeals: number; attention: number; won: number; lost: number };
}

/** A follow-up as returned by GET /leads/followups — carries its parent lead. */
export interface FollowUpTask extends FollowUp {
  lead?: (Pick<Lead, 'id' | 'destination'> & {
    customer?: LeadCustomer | null;
    package?: { id: string; name: string } | null;
    assignedAgent?: AgentRef | null;
  }) | null;
}

export interface FollowUpListResponse {
  data: FollowUpTask[];
  total: number;
  page: number;
  pageSize: number;
  metrics: { scheduled: number; overdue: number; today: number; done: number };
}

/* ---------------------------------------------------------------- helpers -- */

/** Leads have no name of their own — it lives on the linked customer. */
export function leadDisplayName(lead: Pick<Lead, 'customer'>): string {
  return lead.customer?.name?.trim() || lead.customer?.phone || 'Unnamed lead';
}

/** e.g. PACKAGE_INTERESTED -> "Package Interested". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The agency's own stage name wins; the raw status enum is the fallback. */
export function leadStageLabel(lead: Pick<Lead, 'pipelineStage' | 'status'>): string {
  return lead.pipelineStage?.name || humanize(lead.status) || 'New';
}

/** Earliest still-scheduled follow-up, or null. */
export function nextFollowUpAt(lead: Pick<Lead, 'followUps'>): string | null {
  const scheduled = (lead.followUps ?? [])
    .filter((f) => f.status === 'Scheduled' && f.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return scheduled[0]?.scheduledAt ?? null;
}

export function isPast(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export function isFollowUpOverdue(followUp: Pick<FollowUp, 'scheduledAt' | 'status'>): boolean {
  return followUp.status === 'Scheduled' && isPast(followUp.scheduledAt);
}

/** Paise. Budget is per traveller, so the deal size is budget x heads. */
export function leadValue(lead: Pick<Lead, 'budgetPerPerson' | 'travellers'>): number {
  return (lead.budgetPerPerson ?? 0) * (lead.travellers ?? 1);
}

/* ---------------------------------------------------------------- queries -- */

export interface LeadListParams {
  search?: string;
  /** 'mine' | 'unassigned' | an agent uuid (admins only). */
  agentId?: string;
  /** 'true' pulls only leads the backend flags as needing attention. */
  attention?: 'true';
  status?: LeadStatus;
  pipelineStageId?: string;
  source?: string;
  sortBy?: 'newest' | 'oldest' | 'hot' | 'highestBudget' | 'nextFollowUp';
  page?: number;
  pageSize?: number;
}

export function useLeads(params: LeadListParams = {}) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async (): Promise<LeadListResponse> => {
      const res = await api.get('/leads', { params });
      return res.data.data;
    },
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: ['lead', id],
    enabled: !!id,
    queryFn: async (): Promise<LeadDetail> => {
      const res = await api.get(`/leads/${id}`);
      return res.data.data;
    },
  });
}

/** The agency's configurable funnel. Stage ids are what PATCH expects. */
export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipelineStages'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PipelineStage[]> => {
      const res = await api.get('/crm/pipeline-stages');
      return res.data.data;
    },
  });
}

export interface FollowUpListParams {
  status?: 'Scheduled' | 'Done' | 'Cancelled';
  /** Server-side windows on scheduledAt. */
  due?: 'today' | 'overdue';
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useFollowUps(params: FollowUpListParams = {}) {
  return useQuery({
    queryKey: ['followups', params],
    queryFn: async (): Promise<FollowUpListResponse> => {
      const res = await api.get('/leads/followups', { params });
      return res.data.data;
    },
  });
}

/* -------------------------------------------------------------- mutations -- */

/**
 * Only keys in the PATCH zod schema survive — validateBody strips everything
 * else and the request silently 200s having changed nothing. `pipelineStageId`
 * IS in the schema (the service reconciles stage <-> status), so stage moves
 * must send it rather than a made-up field.
 */
export interface UpdateLeadInput {
  pipelineStageId?: string | null;
  status?: LeadStatus;
  /** zod min(1) — an empty string is dropped, not rejected. */
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  assignedAgentId?: string | null;
  destination?: string;
  place?: string;
  travellers?: number;
  budgetPerPerson?: number;
  notes?: string;
  tags?: string[];
}

function useLeadInvalidator() {
  const queryClient = useQueryClient();
  return (leadId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['followups'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (leadId) queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
  };
}

export function useUpdateLead() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLeadInput }): Promise<Lead> => {
      const res = await api.patch(`/leads/${id}`, data);
      return res.data.data;
    },
    onSuccess: (_lead, { id }) => invalidate(id),
  });
}

/** Moves a lead to one of the agency's pipeline stages. */
export function useMoveLeadStage() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: async ({ id, pipelineStageId }: { id: string; pipelineStageId: string }): Promise<Lead> => {
      const res = await api.patch(`/leads/${id}`, { pipelineStageId });
      return res.data.data;
    },
    onSuccess: (_lead, { id }) => invalidate(id),
  });
}

export function useCompleteFollowUp() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: async ({
      leadId,
      followUpId,
      outcome,
    }: { leadId: string; followUpId: string; outcome?: string }): Promise<FollowUpTask> => {
      // Closing a follow-up without an outcome/note is a 400 (NOTE_REQUIRED), so
      // one is always sent.
      const res = await api.patch(`/leads/${leadId}/followups/${followUpId}`, {
        status: 'Done',
        outcome: outcome?.trim() || 'Marked done from the mobile app',
      });
      return res.data.data;
    },
    onSuccess: (_task, { leadId }) => invalidate(leadId),
  });
}

/** Pushes a follow-up out by N days (default 1). No note needed — it stays open. */
export function useSnoozeFollowUp() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: async ({
      leadId,
      followUpId,
      scheduledAt,
      days = 1,
    }: { leadId: string; followUpId: string; scheduledAt: string; days?: number }): Promise<FollowUpTask> => {
      // Snoozing an overdue task from its old date would land in the past — push
      // from now instead.
      const base = Math.max(new Date(scheduledAt).getTime(), Date.now());
      const next = new Date(base + days * 86400000).toISOString();
      const res = await api.patch(`/leads/${leadId}/followups/${followUpId}`, { scheduledAt: next });
      return res.data.data;
    },
    onSuccess: (_task, { leadId }) => invalidate(leadId),
  });
}
