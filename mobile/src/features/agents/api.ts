// FILE: mobile/src/features/agents/api.ts
// Real team/agent wiring. Source of truth: backend/src/routes/agents.ts +
// agentService. Envelope is { success: true, data }. No mocks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Types — exactly what the backend returns (Agent model minus passwordHash)
// ---------------------------------------------------------------------------

export type AgentRole = 'ADMIN' | 'AGENT';

export interface Agent {
  id: string;
  agencyId: string;
  name: string;
  email: string;
  phone: string | null;
  role: AgentRole;
  isOnline: boolean;
  lastSeenAt: string | null;
  permissions: string[] | null;
  sidebarPreferences: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  email: string;
  phone?: string;
  /** Omit to have the backend generate one and email it to the new user. */
  password?: string;
  role?: AgentRole;
  permissions?: string[];
}

export interface CreateAgentResult {
  agent: Agent;
  welcomeEmailSent: boolean;
  temporaryPassword: string;
  emailWarning?: string;
}

export interface UpdateAgentInput {
  name?: string;
  phone?: string;
  role?: AgentRole;
  isOnline?: boolean;
  permissions?: string[];
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: { error?: string; message?: string } } })?.response;
  if (res?.status === 409) return res?.data?.error || 'A user with this email or phone already exists.';
  return res?.data?.error || res?.data?.message || (err as Error)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * GET /agents — the backend has no role filter, so callers filter client-side.
 * Requires the users.manage permission; a 403 surfaces as isError.
 */
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      const res = await api.get('/agents');
      return res.data.data;
    },
  });
}

/**
 * There is no GET /agents/:id — read the single agent out of the list.
 */
export function useAgent(id?: string) {
  const agents = useAgents();
  return {
    ...agents,
    data: id ? agents.data?.find((a) => a.id === id) : undefined,
  };
}

/** GET /agents/permissions — the catalog of assignable permission keys. */
export function usePermissionCatalog({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['agents', 'permissions'],
    queryFn: async (): Promise<string[]> => {
      const res = await api.get('/agents/permissions');
      return res.data.data;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAgentInput): Promise<CreateAgentResult> => {
      const res = await api.post('/agents', input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateAgentInput & { id: string }): Promise<Agent> => {
      const res = await api.patch(`/agents/${id}`, body);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
}

/** PATCH /agents/me/status — toggle my own online/offline flag. */
export function useUpdateMyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isOnline: boolean): Promise<void> => {
      await api.patch('/agents/me/status', { isOnline });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
}
