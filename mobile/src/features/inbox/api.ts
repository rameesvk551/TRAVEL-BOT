// FILE: mobile/src/features/inbox/api.ts
// Real backend wiring for the inbox. No mocks — errors propagate so react-query
// sets `isError` and the screens render <ErrorState />.
//
// Endpoints (backend/src/routes/messages.ts), envelope is always { success, data }:
//   GET   /messages/threads?limit&q&channel&channelId   -> conversation list
//   GET   /messages?customerId&limit&before             -> chat history page
//   GET   /messages/:messageId/media                    -> inbound media proxy (Bearer)
//   POST  /messages/send                                -> send a TEXT message
//   PATCH /messages/sessions/:customerId/takeover       -> agent takes over from the bot
//
// Two things the backend does that the UI must not fight:
//  1. listThreads() already scopes a non-ADMIN agent to conversations they own
//     PLUS the shared unassigned pool. The "Unassigned" filter below is the
//     client-side lens over that pool, matching frontend/src/pages/WhatsAppInbox.jsx.
//  2. listMessages() returns the NEWEST `limit` messages (oldest -> newest within
//     the page). Older history is fetched with `before=<oldest timestamp>`, i.e.
//     pagination runs backwards as you scroll UP.

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../../lib/api';
import { getString, StorageKeys } from '../../lib/storage';

// ---------------------------------------------------------------------------
// Types — these mirror backend/src/models/Message.ts and
// messageService.listThreads() exactly. Do not "tidy" them; the names are the
// wire format.
// ---------------------------------------------------------------------------

export type MessageDirection = 'IN' | 'OUT';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type MessageType = 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';

export interface ChatMessage {
  id: string;
  customerId: string;
  agencyId?: string;
  agentId?: string | null;
  direction: MessageDirection;
  content: string;
  type: MessageType;
  /** WhatsApp media id. The bytes are streamed on demand by the media proxy. */
  mediaId?: string | null;
  mimeType?: string | null;
  mediaFilename?: string | null;
  templateName?: string | null;
  status: MessageStatus;
  timestamp: string;
  agent?: { id: string; name: string } | null;
  /** Client-only. Marks an optimistic bubble that has not been ack'd yet. */
  optimistic?: boolean;
}

export interface ThreadCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  language?: string | null;
  source?: string | null;
}

export interface BotSessionSummary {
  id: string;
  currentStep: string | null;
  isHandedOff: boolean;
  handedOffAt: string | null;
  lastActivityAt: string | null;
}

/** One row of GET /messages/threads. Keyed by `customer.id`, NOT a thread id. */
export interface InboxThread {
  customer: ThreadCustomer;
  session: BotSessionSummary | null;
  assignedAgent: { id: string; name: string } | null;
  lastMessage: ChatMessage | null;
  lastActivityAt: string | null;
}

/** Client-side lens over the list. Same four modes as the web inbox. */
export type InboxFilter = 'all' | 'unassigned' | 'leads' | 'customers';
/** Server-side `channel` param. */
export type InboxChannel = 'all' | 'whatsapp' | 'instagram';

const THREADS_LIMIT = 100;
export const MESSAGES_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Derivations shared by the screens
// ---------------------------------------------------------------------------

/** The bot owns the conversation until an agent takes over. Replies are blocked
 *  while it does — same rule as the web inbox. */
export function isBotActive(thread: InboxThread | null | undefined): boolean {
  return Boolean(thread?.session && !thread.session.isHandedOff);
}

/** Mirrors messageService.channelFilter(): Instagram customers are tagged by
 *  `source` or by an `ig_` phone prefix. */
export function threadChannel(thread: InboxThread): 'whatsapp' | 'instagram' {
  const source = (thread.customer.source || '').toLowerCase();
  if (source === 'instagram' || source === 'instagram_comment') return 'instagram';
  if ((thread.customer.phone || '').toLowerCase().startsWith('ig_')) return 'instagram';
  return 'whatsapp';
}

export type MediaKind = 'image' | 'audio' | 'video' | 'document';

/** Classify by the stored WhatsApp mime type. Requires BOTH a mediaId and a
 *  mimeType, so text messages (and Instagram DMs, which carry no mime) never
 *  render as media. */
export function mediaKindOf(message: ChatMessage | null | undefined): MediaKind | null {
  if (!message?.mediaId || !message.mimeType) return null;
  const mime = message.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

/** Absolute URL of the authenticated media proxy for a message. */
export function mediaUri(messageId: string): string {
  const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
  return `${base}/messages/${messageId}/media`;
}

/** The media proxy is Bearer-authenticated, so <Image> has to carry the token
 *  itself — it does not go through the axios instance. */
export function mediaHeaders(): Record<string, string> {
  const token = getString(StorageKeys.ACCESS_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Attachments: download to the cache, then hand to the OS viewer ----------
//
// Photos are NOT routed through here — they render inline via <Image>, which can
// carry the bearer header itself. This path is for audio / video / documents,
// which RN has no viewer for.

/** Mime -> file extension. The extension is what makes the OS pick the right
 *  viewer, so an unknown type falls back to `.bin` rather than guessing. */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
};

/** WhatsApp mimes arrive with parameters attached (`audio/ogg; codecs=opus`). */
export function normalizeMime(mimeType?: string | null): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

export function extensionForMime(mimeType?: string | null): string {
  return MIME_EXTENSIONS[normalizeMime(mimeType)] || 'bin';
}

/** The cache is flat and `mediaFilename` is customer-supplied, so the id is the
 *  uniqueness key: two chats can both send "invoice.pdf", and the name can carry
 *  path separators. Keeps the real extension last so the OS still resolves it. */
export function localFileNameFor(message: ChatMessage): string {
  const raw = (message.mediaFilename || '').trim();
  const safe = raw.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._]+/, '').slice(0, 80);
  if (safe) {
    const hasExtension = /\.[A-Za-z0-9]{1,8}$/.test(safe);
    return `${message.id}-${hasExtension ? safe : `${safe}.${extensionForMime(message.mimeType)}`}`;
  }
  return `${message.id}.${extensionForMime(message.mimeType)}`;
}

function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b/.test(message);
}

function describeDownloadFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/\b40[13]\b/.test(raw)) return 'You do not have access to this attachment.';
  if (/\b404\b/.test(raw)) return 'This attachment is no longer available on WhatsApp.';
  return raw || 'Could not download the attachment.';
}

/** Android can leave a truncated file behind when a download fails mid-flight;
 *  drop it so a retry re-downloads instead of sharing a corrupt file. */
function discardPartial(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Best effort — a stale partial is not worth failing the user-facing error on.
  }
}

/**
 * Downloads an attachment to the cache (once) and opens it in the OS viewer.
 *
 * Throws on failure — the caller surfaces it. Nothing here is swallowed except
 * the best-effort cleanup of a partial file.
 */
export async function openAttachment(message: ChatMessage): Promise<void> {
  if (!message.mediaId) {
    throw new Error('This message has no attachment.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.cache, localFileNameFor(message));

  // Cached from a previous tap — skip the network entirely.
  if (!file.exists) {
    try {
      await File.downloadFileAsync(mediaUri(message.id), file, {
        headers: mediaHeaders(),
        idempotent: true,
      });
    } catch (error) {
      discardPartial(file);

      // mediaHeaders() reads the token straight out of MMKV, so it bypasses the
      // axios refresh interceptor and can be stale. Bounce one request through
      // axios (which refreshes on 401) and retry the download exactly once.
      if (!isAuthFailure(error)) {
        throw new Error(describeDownloadFailure(error));
      }
      await api.get('/auth/me');
      try {
        await File.downloadFileAsync(mediaUri(message.id), file, {
          headers: mediaHeaders(),
          idempotent: true,
        });
      } catch (retryError) {
        discardPartial(file);
        throw new Error(describeDownloadFailure(retryError));
      }
    }
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: normalizeMime(message.mimeType) || undefined,
    dialogTitle: message.mediaFilename || 'Attachment',
  });
}

/** Thread-list preview for a media message with no caption. */
export function messagePreview(message: ChatMessage | null | undefined): string {
  if (!message) return 'No messages yet';
  if (message.content) return message.content;
  switch (mediaKindOf(message)) {
    case 'image': return 'Photo';
    case 'audio': return 'Voice message';
    case 'video': return 'Video';
    case 'document': return message.mediaFilename || 'Document';
    default: return 'No messages yet';
  }
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

interface ThreadQueryParams {
  channel: InboxChannel;
  q: string;
}

function threadsKey(params: ThreadQueryParams) {
  return ['inbox', 'threads', params] as const;
}

async function fetchThreads({ channel, q }: ThreadQueryParams): Promise<InboxThread[]> {
  const response = await api.get('/messages/threads', {
    params: {
      limit: THREADS_LIMIT,
      q: q || undefined,
      channel: channel !== 'all' ? channel : undefined,
    },
  });
  return response.data.data as InboxThread[];
}

/** Same filter semantics as frontend/src/pages/WhatsAppInbox.jsx. */
function applyFilter(threads: InboxThread[], filter: InboxFilter): InboxThread[] {
  return threads.filter((thread) => {
    if (filter === 'customers') return Boolean(thread.session?.isHandedOff);
    if (filter === 'leads') return !thread.session?.isHandedOff;
    if (filter === 'unassigned') return !thread.assignedAgent;
    return true;
  });
}

export function useInboxThreads(options: {
  filter?: InboxFilter;
  channel?: InboxChannel;
  q?: string;
} = {}) {
  const { filter = 'all', channel = 'all', q = '' } = options;
  const params: ThreadQueryParams = { channel, q: q.trim() };

  return useQuery({
    queryKey: threadsKey(params),
    queryFn: () => fetchThreads(params),
    // `filter` is a client-side lens, so it stays out of the query key — flipping
    // it must not refetch.
    select: (threads: InboxThread[]) => applyFilter(threads, filter),
    refetchInterval: 8000,
  });
}

/** There is no GET /messages/threads/:id, so a single thread is read out of the
 *  unfiltered list query (shares its cache and its poll). */
export function useInboxThread(customerId?: string) {
  const params: ThreadQueryParams = { channel: 'all', q: '' };

  return useQuery({
    queryKey: threadsKey(params),
    queryFn: () => fetchThreads(params),
    enabled: Boolean(customerId),
    select: (threads: InboxThread[]) =>
      threads.find((thread) => thread.customer.id === customerId) ?? null,
    refetchInterval: 8000,
  });
}

// ---------------------------------------------------------------------------
// Messages — backwards pagination (newest page first, older pages on scroll up)
// ---------------------------------------------------------------------------

type MessagesCache = InfiniteData<ChatMessage[], string | undefined>;

function messagesKey(customerId?: string) {
  return ['inbox', 'messages', customerId] as const;
}

export function useMessages(customerId?: string) {
  return useInfiniteQuery({
    queryKey: messagesKey(customerId),
    enabled: Boolean(customerId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await api.get('/messages', {
        params: { customerId, limit: MESSAGES_PAGE_SIZE, before: pageParam },
      });
      // A page is ordered oldest -> newest.
      return response.data.data as ChatMessage[];
    },
    // Page 0 is the newest slice; every next page is the slice just OLDER than
    // it, anchored on the oldest timestamp we already hold.
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : lastPage[0]?.timestamp,
    refetchInterval: 8000,
  });
}

/** Flattens the pages newest -> oldest, de-duplicated. That is the order an
 *  `inverted` list wants: index 0 renders at the bottom, so the chat opens on
 *  the newest message and scrolling up walks back through history.
 *
 *  Typed structurally so it accepts the query's InfiniteData regardless of how
 *  react-query infers the page-param. */
export function toDescendingMessages(
  data: { pages: ChatMessage[][] } | undefined,
): ChatMessage[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const page of data.pages) {
    for (let i = page.length - 1; i >= 0; i -= 1) {
      const message = page[i];
      if (message && !seen.has(message.id)) {
        seen.add(message.id);
        out.push(message);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface SendMessageVars {
  customerId: string;
  content: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, content }: SendMessageVars) => {
      const response = await api.post('/messages/send', {
        customerId,
        content,
        type: 'TEXT',
      });
      return response.data.data as ChatMessage;
    },

    onMutate: async ({ customerId, content }: SendMessageVars) => {
      const key = messagesKey(customerId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessagesCache>(key);

      const optimistic: ChatMessage = {
        id: `optimistic:${Date.now()}`,
        customerId,
        direction: 'OUT',
        content,
        type: 'TEXT',
        status: 'SENT',
        timestamp: new Date().toISOString(),
        optimistic: true,
      };

      queryClient.setQueryData<MessagesCache>(key, (old) => {
        if (!old || old.pages.length === 0) {
          return { pages: [[optimistic]], pageParams: [undefined] };
        }
        // Page 0 is the newest slice and runs oldest -> newest, so the new
        // message belongs at its tail.
        return {
          ...old,
          pages: old.pages.map((page, index) => (index === 0 ? [...page, optimistic] : page)),
        };
      });

      return { previous, key };
    },

    onError: (_error, _vars, context) => {
      if (context) {
        // Rolls back to the pre-send cache; `undefined` clears it so the
        // refetch below repopulates from the server.
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: (_data, _error, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: messagesKey(customerId) });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'threads'] });
    },
  });
}

/** Takes the conversation off the bot so an agent can reply. The backend also
 *  claims the chat out of the unassigned pool (claimThreadIfUnassigned). */
export function useTakeover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const response = await api.patch(`/messages/sessions/${customerId}/takeover`);
      return response.data.data;
    },
    onSuccess: (_data, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'threads'] });
      queryClient.invalidateQueries({ queryKey: messagesKey(customerId) });
    },
  });
}
