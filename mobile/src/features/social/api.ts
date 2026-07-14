// FILE: mobile/src/features/social/api.ts
// Backed by /api/instagram (backend/src/routes/instagram.ts), which proxies
// Marketing OS. Instagram is the ONLY social channel the backend serves — there
// is no Facebook DM endpoint, so the UI does not offer a Facebook filter.
//
// The DM routes require an accountId, which comes from
// GET /agencies/me/instagram-connection → { connected, accounts: [...] }.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface InstagramAccount {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  status?: string;
}

export interface InstagramConnection {
  connected: boolean;
  accounts: InstagramAccount[];
  errorMessage?: string;
}

/** One message inside a thread. `direction` is derived server-side from isEcho. */
export interface InstagramReply {
  id: string;
  text?: string;
  direction: 'IN' | 'OUT';
  timestamp?: string;
  from?: { id?: string };
}

/**
 * A DM thread, grouped per participant by the backend's normalizeInstagramMessages
 * and then enriched with the matched CRM lead/customer by enrichInstagramThreads.
 */
export interface SocialThread {
  id: string;
  senderId: string;
  accountId?: string;
  source: string;
  /** Latest message text in the thread. */
  text?: string;
  timestamp?: string;
  updatedAt?: string;
  replies: InstagramReply[];
  /** Enriched from the CRM when the sender matches a customer. */
  customerName?: string;
  name?: string;
  phone?: string;
  destination?: string;
  leadStatus?: string;
  lead?: { id: string; status?: string } | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInstagramConnection() {
  return useQuery({
    queryKey: ['social', 'connection'],
    queryFn: async (): Promise<InstagramConnection> => {
      const res = await api.get('/agencies/me/instagram-connection');
      const data = res.data.data ?? {};
      return {
        connected: Boolean(data.connected),
        accounts: (data.accounts ?? []) as InstagramAccount[],
        errorMessage: data.errorMessage,
      };
    },
  });
}

export function useSocialThreads(accountId?: string) {
  return useQuery({
    queryKey: ['social', 'threads', accountId],
    queryFn: async (): Promise<SocialThread[]> => {
      const res = await api.get('/instagram/messages', { params: { accountId } });
      return (res.data.data ?? []) as SocialThread[];
    },
    enabled: Boolean(accountId),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSendInstagramMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { accountId: string; recipientId: string; text: string }) => {
      const res = await api.post(`/instagram/messages/${vars.accountId}/send`, {
        recipientId: vars.recipientId,
        text: vars.text,
      });
      return res.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['social', 'threads', vars.accountId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The display name for a thread, falling back through the enrichment chain. */
export function threadDisplayName(thread: SocialThread): string {
  return thread.customerName || thread.name || `@${thread.senderId}`;
}

/**
 * True when the customer sent the last message — i.e. it is waiting on us.
 * There is no `unread` flag in the payload, so this is derived, not invented.
 */
export function threadNeedsReply(thread: SocialThread): boolean {
  const last = thread.replies?.[thread.replies.length - 1];
  return last?.direction === 'IN';
}
