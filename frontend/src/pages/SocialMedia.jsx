import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  HashtagIcon,
  HeartIcon,
  InboxIcon,
  LinkIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhoneIcon,
  PhotoIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as igApi from '../api/instagramApi';
import { timeAgo } from '../utils/formatters';

const TABS = [
  { id: 'inbox', name: 'Inbox', icon: InboxIcon },
  { id: 'comments', name: 'Comments', icon: ChatBubbleOvalLeftIcon },
  { id: 'automations', name: 'Automations', icon: BoltIcon },
  { id: 'publishing', name: 'Create Post', icon: PencilSquareIcon },
  { id: 'insights', name: 'Insights', icon: ChartBarIcon },
];

const DEFAULT_PRIVATE_REPLY = 'Hi {{username}}, thanks for commenting. I can send the details here.';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function displayName(item) {
  return item?.from?.username
    || item?.from?.name
    || item?.profile?.username
    || item?.commenter?.username
    || item?.username
    || item?.senderUsername
    || item?.senderId
    || 'Instagram user';
}

function messageText(item) {
  return item?.text || item?.message || item?.content || item?.commentText || item?.caption || '';
}

function itemTime(item) {
  return item?.timestamp || item?.createdAt || item?.updatedAt || item?.time || null;
}

function statusTone(status) {
  const value = String(status || '').toUpperCase();
  if (['CONNECTED', 'ACTIVE', 'PRIVATE_REPLY_SENT', 'CONVERTED_TO_DM'].includes(value)) return 'bg-emerald-50 text-emerald-700';
  if (['WAITING_FOR_REPLY', 'PENDING', 'MATCHED'].includes(value)) return 'bg-amber-50 text-amber-700';
  if (['FAILED', 'PERMISSION_ERROR', 'TOO_OLD'].includes(value)) return 'bg-rose-50 text-rose-700';
  if (['DUPLICATE_SKIPPED', 'NO_MATCH'].includes(value)) return 'bg-neutral-100 text-neutral-600';
  return 'bg-indigo-50 text-indigo-700';
}

function formatMetric(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return String(value);
}

function AccountAvatar({ account, size = 'h-9 w-9' }) {
  if (account?.profilePictureUrl) {
    return <img src={account.profilePictureUrl} alt="" className={`${size} rounded-full object-cover`} />;
  }

  return (
    <div className={`${size} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-400`}>
      <UserCircleIcon className="h-2/3 w-2/3" />
    </div>
  );
}

function EmptyState({ icon: Icon = InboxIcon, title, description, action }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-neutral-200 bg-white p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-neutral-100 text-neutral-400">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-bold text-neutral-900">{title}</h3>
        <p className="mt-2 text-sm text-neutral-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function ErrorBanner({ error, fallback = 'Something went wrong.' }) {
  if (!error) return null;
  const message = error?.response?.data?.error || error?.message || fallback;
  return (
    <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
      {message}
    </div>
  );
}

function LoadingRows({ count = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-[var(--radius-md)] border border-neutral-100 bg-white p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
          <div className="mt-3 h-3 w-5/6 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

export default function SocialMedia() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const connectionQuery = useQuery({
    queryKey: ['ig-connection'],
    queryFn: () => igApi.getInstagramConnection(),
  });

  const accounts = useMemo(
    () => asArray(connectionQuery.data?.data?.accounts || connectionQuery.data?.accounts),
    [connectionQuery.data]
  );
  const activeAccount = accounts.find((account) => String(account.id) === String(selectedAccountId)) || accounts[0] || null;

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  if (connectionQuery.isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <ArrowPathIcon className="h-7 w-7 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="w-full space-y-5">
        <section className="flex flex-col gap-2">
          <p className="eyebrow">Instagram</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Social Media Management</h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            Connect an Instagram Professional account to manage DMs, comments, automations, posts, and insights.
          </p>
        </section>
        <EmptyState
          icon={ExclamationTriangleIcon}
          title="Connect Instagram first"
          description="Go to Settings and connect at least one Instagram Professional account before using the social workspace."
          action={(
            <a href="/settings" className="shell-button-primary">
              <LinkIcon className="h-4 w-4" />
              Open Settings
            </a>
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[680px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <header className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Instagram Command Center</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">Social Media Management</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Manage DMs, comments, comment-to-DM flows, publishing, and insights from one workspace.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-3 py-2">
              <AccountAvatar account={activeAccount} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900">@{activeAccount.username || activeAccount.name || 'instagram'}</p>
                <p className="text-xs text-emerald-600">Connected</p>
              </div>
            </div>

            {accounts.length > 1 ? (
              <select
                value={activeAccount.id}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                className="shell-input-rect min-w-[220px] bg-white"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    @{account.username || account.name || account.id}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => connectionQuery.refetch()}
              disabled={connectionQuery.isFetching}
              className="shell-button-secondary"
            >
              <ArrowPathIcon className={`h-4 w-4 ${connectionQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-50/80 px-3 sm:px-6">
        <nav className="hide-scrollbar flex gap-2 overflow-x-auto py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-bold transition ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-500 hover:bg-white hover:text-neutral-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-hidden bg-neutral-50/40">
        {activeTab === 'inbox' && <InboxTab account={activeAccount} />}
        {activeTab === 'comments' && <CommentsTab account={activeAccount} />}
        {activeTab === 'automations' && <AutomationsTab account={activeAccount} />}
        {activeTab === 'publishing' && <PublishingTab account={activeAccount} onOpenAutomations={() => setActiveTab('automations')} />}
        {activeTab === 'insights' && <InsightsTab account={activeAccount} />}
      </main>
    </div>
  );
}

function InboxTab({ account }) {
  const [filter, setFilter] = useState('all');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const qc = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['ig-messages', account.id],
    queryFn: () => igApi.getMessages(account.id),
    refetchInterval: 15000,
  });

  const sendDmMutation = useMutation({
    mutationFn: ({ recipientId, text }) => igApi.sendMessage(account.id, recipientId, text),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['ig-messages', account.id] });
    },
  });

  const threads = useMemo(() => {
    const rows = asArray(messagesQuery.data?.data);
    if (filter === 'unread') return rows.filter((item) => item.unread || item.isUnread);
    if (filter === 'qualified') return rows.filter((item) => item.lead || item.leadStatus || item.collectedPhone);
    if (filter === 'needs_phone') return rows.filter((item) => !item.collectedPhone && !item.phone);
    if (filter === 'human') return rows.filter((item) => item.isHandedOff || item.assignedAgent);
    return rows;
  }, [filter, messagesQuery.data]);

  const selectedThread = threads.find((item) => String(item.id) === String(selectedThreadId)) || threads[0] || null;

  useEffect(() => {
    if (!selectedThreadId && threads[0]?.id) setSelectedThreadId(threads[0].id);
  }, [selectedThreadId, threads]);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedThread) return;
    const recipientId = selectedThread.senderId || selectedThread.from?.id || selectedThread.id;
    sendDmMutation.mutate({ recipientId, text: replyText.trim() });
  };

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="flex min-h-0 flex-col border-b border-neutral-200 bg-white lg:border-b-0 lg:border-r">
        <div className="border-b border-neutral-100 p-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['all', 'All'],
              ['unread', 'Unread'],
              ['qualified', 'Qualified'],
              ['needs_phone', 'Needs Phone'],
              ['human', 'Human'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold transition ${
                  filter === key ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {messagesQuery.isLoading ? <LoadingRows count={5} /> : null}
          {messagesQuery.isError ? <ErrorBanner error={messagesQuery.error} fallback="Failed to load Instagram messages." /> : null}
          {!messagesQuery.isLoading && threads.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No conversations yet"
              description="New Instagram DMs and private-reply responses will appear here."
            />
          ) : null}

          <div className="space-y-1">
            {threads.map((thread) => {
              const active = String(selectedThread?.id) === String(thread.id);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition ${
                    active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-transparent bg-white hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-bold ${active ? 'text-white' : 'text-neutral-900'}`}>{displayName(thread)}</p>
                      <p className={`mt-1 line-clamp-2 text-xs ${active ? 'text-neutral-200' : 'text-neutral-500'}`}>{messageText(thread) || 'Media or action received'}</p>
                    </div>
                    {itemTime(thread) ? <span className={`shrink-0 text-[10px] ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{timeAgo(itemTime(thread))}</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`badge ${active ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{thread.source || 'DM'}</span>
                    {thread.collectedPhone || thread.phone ? <span className={`badge ${active ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Phone</span> : null}
                    {thread.isHandedOff ? <span className={`badge ${active ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700'}`}>Human</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="hidden min-h-0 flex-col bg-neutral-50/50 lg:flex">
        {!selectedThread ? (
          <EmptyState icon={ChatBubbleLeftRightIcon} title="Select a conversation" description="Pick a DM to view the thread and reply." />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold text-neutral-900">{displayName(selectedThread)}</h2>
                <p className="text-xs text-neutral-500">Instagram DM via @{account.username || account.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${selectedThread.isHandedOff ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {selectedThread.isHandedOff ? 'Human takeover' : 'Bot active'}
                </span>
              </div>
            </div>

            {selectedThread.sourceComment || selectedThread.commentText ? (
              <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                Source comment: {selectedThread.sourceComment || selectedThread.commentText}
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                <div className="max-w-[76%] rounded-[20px] rounded-tl-[6px] bg-white px-4 py-3 text-sm text-neutral-800 shadow-sm">
                  {messageText(selectedThread) || 'Media or quick reply received.'}
                </div>
                {asArray(selectedThread.replies).map((reply, index) => (
                  <div
                    key={reply.id || index}
                    className={`max-w-[76%] rounded-[20px] px-4 py-3 text-sm shadow-sm ${
                      reply.from?.id === account.id || reply.direction === 'OUT'
                        ? 'ml-auto rounded-tr-[6px] bg-neutral-900 text-white'
                        : 'rounded-tl-[6px] bg-white text-neutral-800'
                    }`}
                  >
                    {messageText(reply)}
                  </div>
                ))}
                <div className="mx-auto w-fit rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-500">
                  Bot will continue unless an agent takes over.
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSendReply()}
                  placeholder="Write a manual Instagram reply..."
                  className="shell-input"
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sendDmMutation.isPending}
                  className="shell-button-primary min-w-11 px-3"
                  title="Send reply"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </button>
              </div>
              <ErrorBanner error={sendDmMutation.error} fallback="Failed to send Instagram reply." />
            </div>
          </>
        )}
      </section>

      <aside className="hidden min-h-0 overflow-y-auto border-l border-neutral-200 bg-white p-5 lg:block">
        <LeadIntelligencePanel thread={selectedThread} />
      </aside>
    </div>
  );
}

function LeadIntelligencePanel({ thread }) {
  if (!thread) {
    return (
      <div className="text-center text-sm text-neutral-400">
        Select a conversation to see lead details.
      </div>
    );
  }

  const details = [
    ['Name', thread.customerName || thread.name || displayName(thread)],
    ['Phone', thread.collectedPhone || thread.phone || 'Not captured'],
    ['Destination', thread.destination || thread.location || 'Not captured'],
    ['Dates', thread.travelDates || thread.dates || 'Not captured'],
    ['Travellers', thread.travellers || thread.guests || 'Not captured'],
    ['Budget', thread.budget || thread.budgetPerPerson || 'Not captured'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Lead Intelligence</p>
        <h3 className="mt-1 text-lg font-extrabold text-neutral-900">{displayName(thread)}</h3>
        <p className="mt-1 text-sm text-neutral-500">Instagram inquiry profile</p>
      </div>

      <div className="grid gap-3">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-neutral-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button type="button" className="shell-button-primary w-full">
          <UserGroupIcon className="h-4 w-4" />
          Take Over
        </button>
        <button type="button" className="shell-button-secondary w-full">
          <SparklesIcon className="h-4 w-4" />
          Send Best Matches
        </button>
      </div>
    </div>
  );
}

function CommentsTab({ account }) {
  const [selectedCommentId, setSelectedCommentId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [privateReplyText, setPrivateReplyText] = useState(DEFAULT_PRIVATE_REPLY);
  const qc = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ['ig-comments', account.id],
    queryFn: () => igApi.getComments(account.id),
    refetchInterval: 20000,
  });

  const comments = asArray(commentsQuery.data?.data);
  const selectedComment = comments.find((comment) => String(comment.id) === String(selectedCommentId)) || comments[0] || null;

  useEffect(() => {
    if (!selectedCommentId && comments[0]?.id) setSelectedCommentId(comments[0].id);
  }, [comments, selectedCommentId]);

  const replyMutation = useMutation({
    mutationFn: ({ commentId, text }) => igApi.replyToComment(account.id, commentId, text),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['ig-comments', account.id] });
    },
  });

  const privateReplyMutation = useMutation({
    mutationFn: ({ commentId, text }) => igApi.sendPrivateReply(account.id, commentId, {
      text,
      quickReplies: ['Show Packages', 'Talk to Agent'],
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId) => igApi.deleteComment(account.id, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ig-comments', account.id] }),
  });

  return (
    <div className="grid h-full grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-b border-neutral-200 bg-white p-3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="eyebrow">Live Comments</p>
            <h2 className="text-lg font-extrabold text-neutral-900">Comments</h2>
          </div>
          <button type="button" onClick={() => commentsQuery.refetch()} className="shell-button-secondary min-h-10 px-3">
            <ArrowPathIcon className={`h-4 w-4 ${commentsQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {commentsQuery.isLoading ? <LoadingRows count={5} /> : null}
        {commentsQuery.isError ? <ErrorBanner error={commentsQuery.error} fallback="Failed to load comments." /> : null}
        {!commentsQuery.isLoading && comments.length === 0 ? (
          <EmptyState icon={ChatBubbleOvalLeftIcon} title="No comments yet" description="Comments from selected media will appear here." />
        ) : null}

        <div className="space-y-2">
          {comments.map((comment) => {
            const active = String(selectedComment?.id) === String(comment.id);
            const text = messageText(comment);
            return (
              <button
                key={comment.id}
                type="button"
                onClick={() => setSelectedCommentId(comment.id)}
                className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition ${
                  active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div className="flex gap-3">
                  {comment.mediaThumbnailUrl || comment.thumbnailUrl ? (
                    <img src={comment.mediaThumbnailUrl || comment.thumbnailUrl} alt="" className="h-12 w-12 rounded-[var(--radius-sm)] object-cover" />
                  ) : (
                    <div className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] ${active ? 'bg-white/15' : 'bg-neutral-100'}`}>
                      <PhotoIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${active ? 'text-white' : 'text-neutral-900'}`}>{displayName(comment)}</p>
                    <p className={`mt-1 line-clamp-2 text-xs ${active ? 'text-neutral-200' : 'text-neutral-500'}`}>{text || 'Comment with no text'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className={`badge ${active ? 'bg-white/15 text-white' : statusTone(comment.privateReplyStatus || comment.status)}`}>
                    {comment.privateReplyStatus || comment.status || 'New'}
                  </span>
                  {itemTime(comment) ? <span className={`text-[10px] ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{timeAgo(itemTime(comment))}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto p-5">
        {!selectedComment ? (
          <EmptyState icon={ChatBubbleOvalLeftIcon} title="Select a comment" description="Reply publicly or send one private reply to the commenter." />
        ) : (
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="shell-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">Selected Comment</p>
                  <h2 className="mt-1 truncate text-xl font-extrabold text-neutral-900">{displayName(selectedComment)}</h2>
                  <p className="mt-2 text-sm text-neutral-600">{messageText(selectedComment)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(selectedComment.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-[var(--radius-sm)] p-2 text-rose-500 transition hover:bg-rose-50"
                  title="Delete or hide comment"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="shell-panel p-5">
                <h3 className="text-base font-extrabold text-neutral-900">Public Reply</h3>
                <p className="mt-1 text-sm text-neutral-500">Use this for normal comment replies.</p>
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={5}
                  className="mt-4 shell-input-rect resize-none bg-white"
                  placeholder="Thanks, sent you details in DM."
                />
                <button
                  type="button"
                  onClick={() => replyMutation.mutate({ commentId: selectedComment.id, text: replyText.trim() })}
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className="mt-4 shell-button-primary w-full"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Reply to Comment
                </button>
                <ErrorBanner error={replyMutation.error} fallback="Failed to reply to comment." />
              </div>

              <div className="shell-panel p-5">
                <h3 className="text-base font-extrabold text-neutral-900">Private Reply</h3>
                <p className="mt-1 text-sm text-neutral-500">Send one DM-style private reply, then continue only if the user responds.</p>
                <textarea
                  value={privateReplyText}
                  onChange={(event) => setPrivateReplyText(event.target.value)}
                  rows={5}
                  className="mt-4 shell-input-rect resize-none bg-white"
                />
                <button
                  type="button"
                  onClick={() => privateReplyMutation.mutate({ commentId: selectedComment.id, text: privateReplyText.trim() })}
                  disabled={!privateReplyText.trim() || privateReplyMutation.isPending}
                  className="mt-4 shell-button-secondary w-full"
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Send Private Reply
                </button>
                <ErrorBanner error={privateReplyMutation.error} fallback="Failed to send private reply." />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AutomationsTab({ account }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: 'Package keyword DM',
    mediaId: '',
    triggerKeywords: 'PRICE, PACKAGE, BROCHURE',
    matchType: 'CONTAINS',
    actionType: 'PACKAGE_FLOW',
    privateReplyMessage: DEFAULT_PRIVATE_REPLY,
    quickReplies: 'Show Packages, Talk to Agent',
    followPromptMode: 'OFF',
    publicReplyEnabled: false,
    duplicatePolicy: 'USER_PER_POST',
  });

  const automationsQuery = useQuery({
    queryKey: ['ig-automations', account.id],
    queryFn: () => igApi.getAutomations({ accountId: account.id }),
  });

  const mediaQuery = useQuery({
    queryKey: ['ig-media', account.id, 'automation-picker'],
    queryFn: () => igApi.getMedia({ accountId: account.id, limit: 12 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => igApi.createAutomation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ig-automations', account.id] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => igApi.updateAutomation(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ig-automations', account.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => igApi.deleteAutomation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ig-automations', account.id] }),
  });

  const automations = asArray(automationsQuery.data?.data);
  const media = asArray(mediaQuery.data?.data);

  const previewReplies = form.quickReplies.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const previewKeywords = form.triggerKeywords.split(',').map((item) => item.trim()).filter(Boolean);

  const submitAutomation = () => {
    createMutation.mutate({
      accountId: account.id,
      name: form.name,
      mediaId: form.mediaId || null,
      triggerKeywords: previewKeywords,
      matchType: form.matchType,
      actionType: form.actionType,
      privateReplyMessage: form.privateReplyMessage,
      quickReplies: previewReplies,
      followPromptMode: form.followPromptMode,
      publicReplyEnabled: form.publicReplyEnabled,
      duplicatePolicy: form.duplicatePolicy,
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <div>
            <p className="eyebrow">Comment to DM</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">Automation Builder</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Turn post comments like PRICE or KERALA into one private reply, then continue the bot flow after the user responds.
            </p>
          </div>

          <div className="shell-panel p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Automation name</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="shell-input-rect bg-white" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Post or reel</span>
                <select value={form.mediaId} onChange={(event) => setForm({ ...form, mediaId: event.target.value })} className="shell-input-rect bg-white">
                  <option value="">All posts on this account</option>
                  {media.map((item) => (
                    <option key={item.id} value={item.id}>{item.caption || item.name || item.id}</option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Trigger keywords</span>
                <input
                  value={form.triggerKeywords}
                  onChange={(event) => setForm({ ...form, triggerKeywords: event.target.value })}
                  className="shell-input-rect bg-white"
                  placeholder="PRICE, KERALA, BROCHURE"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Match type</span>
                <select value={form.matchType} onChange={(event) => setForm({ ...form, matchType: event.target.value })} className="shell-input-rect bg-white">
                  <option value="CONTAINS">Contains keyword</option>
                  <option value="EXACT">Exact keyword</option>
                  <option value="ANY">Any comment</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Action</span>
                <select value={form.actionType} onChange={(event) => setForm({ ...form, actionType: event.target.value })} className="shell-input-rect bg-white">
                  <option value="PACKAGE_FLOW">Start package flow</option>
                  <option value="PROPERTY_FLOW">Start property flow</option>
                  <option value="BROCHURE_LINK">Send brochure or link</option>
                  <option value="AGENT_HANDOFF">Assign agent handoff</option>
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Private reply message</span>
                <textarea
                  rows={4}
                  value={form.privateReplyMessage}
                  onChange={(event) => setForm({ ...form, privateReplyMessage: event.target.value })}
                  className="shell-input-rect resize-none bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Quick replies</span>
                <input value={form.quickReplies} onChange={(event) => setForm({ ...form, quickReplies: event.target.value })} className="shell-input-rect bg-white" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Follow prompt</span>
                <select value={form.followPromptMode} onChange={(event) => setForm({ ...form, followPromptMode: event.target.value })} className="shell-input-rect bg-white">
                  <option value="OFF">Off</option>
                  <option value="BEFORE_DETAILS">Before details</option>
                  <option value="AFTER_DETAILS">After details</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Duplicate rule</span>
                <select value={form.duplicatePolicy} onChange={(event) => setForm({ ...form, duplicatePolicy: event.target.value })} className="shell-input-rect bg-white">
                  <option value="USER_PER_POST">Once per user per post</option>
                  <option value="COMMENT">Once per comment</option>
                  <option value="USER_24H">Once per user per 24h</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.publicReplyEnabled}
                  onChange={(event) => setForm({ ...form, publicReplyEnabled: event.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm font-bold text-neutral-700">Also post public reply</span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-100 pt-5">
              <button type="button" onClick={submitAutomation} disabled={createMutation.isPending} className="shell-button-primary">
                <BoltIcon className="h-4 w-4" />
                {createMutation.isPending ? 'Saving...' : 'Create Automation'}
              </button>
            </div>
            <ErrorBanner error={createMutation.error} fallback="Failed to create automation." />
          </div>

          <div className="shell-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">Active Automations</h3>
                <p className="text-sm text-neutral-500">Rules are account-scoped and safe against duplicate private replies.</p>
              </div>
              <button type="button" onClick={() => automationsQuery.refetch()} className="shell-button-secondary min-h-10 px-3">
                <ArrowPathIcon className={`h-4 w-4 ${automationsQuery.isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-neutral-100">
              {automationsQuery.isLoading ? <div className="p-5"><LoadingRows count={3} /></div> : null}
              {!automationsQuery.isLoading && automations.length === 0 ? (
                <div className="p-5 text-sm text-neutral-500">No automations yet. Create one above to start comment-to-DM capture.</div>
              ) : null}
              {automations.map((automation) => (
                <div key={automation.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-neutral-900">{automation.name}</h4>
                      <span className={`badge ${automation.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {automation.isActive ? 'Active' : 'Paused'}
                      </span>
                      <span className="badge bg-indigo-50 text-indigo-700">{automation.actionType}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">
                      {(automation.triggerKeywords || []).join(', ') || 'Any comment'} {'->'} private reply
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <span>Sent: {automation.stats?.privateRepliesSent || 0}</span>
                      <span>Leads: {automation.stats?.leadsCreated || 0}</span>
                      <span>Errors: {automation.stats?.errors || 0}</span>
                      {automation.lastTriggeredAt ? <span>Last: {timeAgo(automation.lastTriggeredAt)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ id: automation.id, payload: { isActive: !automation.isActive } })}
                      className="shell-button-secondary min-h-10 px-3"
                    >
                      {automation.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(automation.id)}
                      className="shell-button-secondary min-h-10 px-3 text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="shell-panel p-5">
            <p className="eyebrow">Live Preview</p>
            <div className="mt-4 rounded-[var(--radius-lg)] border border-neutral-200 bg-neutral-50 p-4">
              <div className="rounded-[var(--radius-md)] bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <HashtagIcon className="h-4 w-4 text-neutral-400" />
                  <p className="text-sm font-bold text-neutral-900">Comment</p>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{previewKeywords[0] || 'PRICE'}</p>
              </div>

              <div className="mt-4 rounded-[20px] rounded-tl-[6px] bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
                {form.privateReplyMessage.replace('{{username}}', 'rahul_travels')}
                {form.followPromptMode === 'BEFORE_DETAILS' ? (
                  <p className="mt-3 text-xs font-semibold text-neutral-500">Follow our page for latest offers.</p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {previewReplies.map((reply) => (
                  <span key={reply} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700">{reply}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-extrabold">Meta-safe behavior</p>
            <p className="mt-2">TravelBot sends one private reply to a comment. The bot continues only after the user replies in DM.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PublishingTab({ account, onOpenAutomations }) {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState(null);
  const qc = useQueryClient();

  const mediaQuery = useQuery({
    queryKey: ['ig-media', account.id],
    queryFn: () => igApi.getMedia({ accountId: account.id, limit: 12 }),
  });

  const publishMutation = useMutation({
    mutationFn: (payload) => igApi.publishImage(payload),
    onSuccess: () => {
      setStatus({ type: 'success', text: 'Post published successfully.' });
      setCaption('');
      setImageUrl('');
      qc.invalidateQueries({ queryKey: ['ig-media', account.id] });
    },
    onError: (err) => {
      setStatus({ type: 'error', text: err.response?.data?.error || err.message || 'Failed to publish.' });
    },
  });

  const helpers = [
    'Comment PRICE for details.',
    'Comment KERALA and we will DM the package.',
    'Comment VILLA for availability.',
    'DM us to plan your trip.',
  ];

  const recentMedia = asArray(mediaQuery.data?.data);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-6">
          <div>
            <p className="eyebrow">Create Post</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">Instagram Composer</h2>
            <p className="mt-1 text-sm text-neutral-500">Publish a visual post and attach a comment-to-DM strategy after publishing.</p>
          </div>

          <div className="shell-panel p-5">
            {status ? (
              <div className={`mb-4 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-bold ${
                status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                {status.text}
              </div>
            ) : null}

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Image URL</span>
                <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="shell-input-rect bg-white" placeholder="https://example.com/package.jpg" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Caption</span>
                <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={7} className="shell-input-rect resize-none bg-white" placeholder="Write your Instagram caption..." />
                <p className="mt-2 text-xs text-neutral-500">{caption.length}/2200 characters</p>
              </label>

              <div>
                <p className="mb-2 text-sm font-bold text-neutral-700">CTA helpers</p>
                <div className="flex flex-wrap gap-2">
                  {helpers.map((helper) => (
                    <button
                      key={helper}
                      type="button"
                      onClick={() => setCaption((current) => `${current}${current ? '\n' : ''}${helper}`)}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      {helper}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-100 pt-4">
                <button type="button" onClick={onOpenAutomations} className="shell-button-secondary">
                  <BoltIcon className="h-4 w-4" />
                  Create Automation
                </button>
                <button
                  type="button"
                  onClick={() => publishMutation.mutate({ accountId: account.id, imageUrl: imageUrl.trim(), caption: caption.trim() })}
                  disabled={!imageUrl.trim() || publishMutation.isPending}
                  className="shell-button-primary"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>

          <RecentMediaGrid media={recentMedia} isLoading={mediaQuery.isLoading} onRefresh={() => mediaQuery.refetch()} isRefreshing={mediaQuery.isFetching} />
        </section>

        <aside className="shell-panel h-fit overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-4">
            <p className="eyebrow">Preview</p>
            <h3 className="mt-1 text-base font-extrabold text-neutral-900">@{account.username || account.name}</h3>
          </div>
          <div className="bg-white">
            <div className="flex items-center gap-3 px-4 py-3">
              <AccountAvatar account={account} />
              <div>
                <p className="text-sm font-extrabold text-neutral-900">@{account.username || account.name}</p>
                <p className="text-xs text-neutral-400">TravelBot post preview</p>
              </div>
            </div>
            <div className="aspect-square bg-neutral-100">
              {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><PhotoIcon className="h-10 w-10 text-neutral-300" /></div>}
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="flex gap-4 text-neutral-700">
                <HeartIcon className="h-5 w-5" />
                <ChatBubbleOvalLeftIcon className="h-5 w-5" />
                <PaperAirplaneIcon className="h-5 w-5" />
              </div>
              <p className="whitespace-pre-line text-sm text-neutral-800">
                <span className="font-extrabold">@{account.username || account.name}</span> {caption || 'Your caption will appear here.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RecentMediaGrid({ media, isLoading, onRefresh, isRefreshing }) {
  return (
    <div className="shell-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-neutral-900">Recent Media</h3>
          <p className="text-sm text-neutral-500">Use recent posts when creating comment-to-DM automations.</p>
        </div>
        <button type="button" onClick={onRefresh} className="shell-button-secondary min-h-10 px-3">
          <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? <LoadingRows count={3} /> : null}
      {!isLoading && media.length === 0 ? <p className="py-8 text-center text-sm text-neutral-400">No media available yet.</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {media.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white">
            <div className="aspect-square bg-neutral-100">
              {item.mediaUrl || item.imageUrl || item.thumbnailUrl ? (
                <img src={item.mediaUrl || item.imageUrl || item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center"><PhotoIcon className="h-7 w-7 text-neutral-300" /></div>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-neutral-600">
              <span className="flex items-center gap-1"><HeartIcon className="h-4 w-4" />{formatMetric(item.likeCount ?? item.likes ?? 0)}</span>
              <span className="flex items-center gap-1"><ChatBubbleOvalLeftIcon className="h-4 w-4" />{formatMetric(item.commentCount ?? item.comments ?? 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsTab({ account }) {
  const [period, setPeriod] = useState('week');

  const insightsQuery = useQuery({
    queryKey: ['ig-insights', account.id, period],
    queryFn: () => igApi.getAccountInsights(account.id, period),
  });

  const mediaInsightsQuery = useQuery({
    queryKey: ['ig-media-insights', account.id],
    queryFn: () => igApi.getMediaAnalytics(account.id, 12),
  });

  const insights = insightsQuery.data?.data || {};
  const topPosts = asArray(mediaInsightsQuery.data?.data);

  const metricCards = [
    { label: 'Followers', value: insights.followersCount ?? insights.followers, icon: UserGroupIcon, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Reach', value: insights.reach ?? insights.accountsReached, icon: EyeIcon, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Impressions', value: insights.impressions, icon: ChartBarIcon, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Profile Views', value: insights.profileViews ?? insights.profile_views, icon: UserCircleIcon, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Website Clicks', value: insights.websiteClicks ?? insights.website_clicks, icon: ArrowTopRightOnSquareIcon, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Leads Created', value: insights.leadsCreated ?? insights.instagramLeads, icon: PhoneIcon, tone: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Performance</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">Instagram Insights</h2>
          <p className="mt-1 text-sm text-neutral-500">Track account performance and content that generates leads.</p>
        </div>
        <select value={period} onChange={(event) => setPeriod(event.target.value)} className="shell-input-rect w-full bg-white sm:w-52">
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="28_days">Last 28 Days</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </div>

      <ErrorBanner error={insightsQuery.error} fallback="Failed to load account insights." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((metric) => (
          <div key={metric.label} className="kpi-card">
            <div className="flex items-center gap-4">
              <div className={`kpi-icon ${metric.tone}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">{metric.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-neutral-900">{insightsQuery.isLoading ? '-' : formatMetric(metric.value)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 shell-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-neutral-900">Top Performing Posts</h3>
            <p className="text-sm text-neutral-500">Prioritize automations on posts with strong engagement.</p>
          </div>
          <button type="button" onClick={() => mediaInsightsQuery.refetch()} className="shell-button-secondary min-h-10 px-3">
            <ArrowPathIcon className={`h-4 w-4 ${mediaInsightsQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {mediaInsightsQuery.isLoading ? <LoadingRows count={4} /> : null}
        {!mediaInsightsQuery.isLoading && topPosts.length === 0 ? <p className="py-8 text-center text-sm text-neutral-400">No media analytics available yet.</p> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {topPosts.map((post) => (
            <div key={post.id} className="overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-white">
              <div className="aspect-square bg-neutral-100">
                {post.mediaUrl || post.imageUrl || post.thumbnailUrl ? (
                  <img src={post.mediaUrl || post.imageUrl || post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center"><PhotoIcon className="h-8 w-8 text-neutral-300" /></div>
                )}
              </div>
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-xs text-neutral-500">{post.caption || post.name || 'Instagram media'}</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-neutral-700">
                  <span className="flex items-center gap-1"><HeartIcon className="h-4 w-4" />{formatMetric(post.likeCount ?? post.likes ?? 0)}</span>
                  <span className="flex items-center gap-1"><ChatBubbleOvalLeftIcon className="h-4 w-4" />{formatMetric(post.commentCount ?? post.comments ?? 0)}</span>
                  <span>Reach {formatMetric(post.reach)}</span>
                  <span>Leads {formatMetric(post.leadsCreated ?? 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
