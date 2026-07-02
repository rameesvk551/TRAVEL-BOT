import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckBadgeIcon,
  CheckIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCreateCustomer } from '../api/customersApi';
import client from '../api/client';
import { getInstagramConnection, getMessages as getInstagramMessages } from '../api/instagramApi';
import { useMessageThreads, useMessages, useSendMessage, useTakeover, useAssignableAgents, useAssignThread } from '../hooks/useMessages';
import { formatPhone, formatTime, timeAgo, truncate } from '../utils/formatters';

const emptyContactForm = { name: '', phone: '', notes: '' };

const CHANNEL_TABS = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'messenger', label: 'Messenger', disabled: true },
];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function initials(name, phone) {
  const label = name || phone || 'C';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';
}

function getRealProfileImage(record) {
  return record?.profilePictureUrl
    || record?.profile_picture_url
    || record?.profilePicUrl
    || record?.profile_pic_url
    || record?.senderProfilePictureUrl
    || record?.sender_profile_picture_url
    || record?.avatarUrl
    || record?.photoUrl
    || record?.from?.profilePictureUrl
    || record?.sender?.profilePictureUrl
    || record?.participant?.profilePictureUrl
    || record?.profile?.picture?.data?.url
    || '';
}

function getInstagramPhoneKey(senderId) {
  const value = String(senderId || '').trim();
  return value ? `ig_${value}` : '';
}

function statusIcon(status) {
  if (status === 'READ') return <CheckBadgeIcon className="h-3.5 w-3.5 text-[#34b7f1]" />;
  if (status === 'DELIVERED') return <CheckIcon className="h-3.5 w-3.5 text-[#34b7f1]" />;
  if (status === 'FAILED') return <ExclamationCircleIcon className="h-3.5 w-3.5 text-rose-500" />;
  return <ClockIcon className="h-3.5 w-3.5 text-slate-400" />;
}

function Avatar({ customer, avatarUrl, size = 'h-12 w-12' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = avatarUrl || getRealProfileImage(customer);
  return (
    <div className={`${size} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-slate-200 text-sm font-extrabold text-slate-600 shadow-sm`}>
      {initials(customer?.name, customer?.phone)}
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-lg p-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="hidden h-full items-center justify-center p-8 text-center lg:flex">
      <div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f7ee] text-[#008069]">
          <UserCircleIcon className="h-9 w-9" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-slate-900">WhatsApp for Web</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">Select a chat to start messaging.</p>
      </div>
    </div>
  );
}

function TemplateBadge() {
  return (
    <div className="mb-3 border-b border-[#b8dfac] pb-2 text-xs font-extrabold text-[#247a3d]">
      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2ea84a] text-white">
        <CheckBadgeIcon className="h-3 w-3" />
      </span>
      Template Message
    </div>
  );
}

function ChatDatePill({ children }) {
  return (
    <div className="my-2 flex justify-center">
      <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{children}</span>
    </div>
  );
}

function MenuButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function NewContactModal({ open, form, setForm, creating, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#008069]">WhatsApp contact</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950">New Contact</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-500">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#087a3a]"
              placeholder="Customer name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-500">Phone</span>
            <input
              required
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#087a3a]"
              placeholder="+91 98765 43210"
            />
          </label>
          <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-500">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#008069]"
              placeholder="Optional context"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="rounded-xl bg-[#008069] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedChannelId, setSelectedChannelId] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [inboxMenuOpen, setInboxMenuOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [newContactThread, setNewContactThread] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const composerRef = useRef(null);

  const threadParams = useMemo(() => ({
    limit: 100,
    q: search.trim() || undefined,
    channel: selectedChannel !== 'all' ? selectedChannel : undefined,
    channelId: selectedChannel !== 'instagram' && selectedChannelId !== 'all' ? selectedChannelId : undefined,
  }), [search, selectedChannel, selectedChannelId]);
  const threadsQuery = useMessageThreads(threadParams);
  const createCustomer = useCreateCustomer();
  const whatsappChannelsQuery = useQuery({
    queryKey: ['whatsapp-channels'],
    queryFn: () => client.get('/agencies/me/whatsapp-channels').then((res) => res.data.data),
  });
  const whatsappChannels = Array.isArray(whatsappChannelsQuery.data) ? whatsappChannelsQuery.data : [];
  const instagramConnectionQuery = useQuery({
    queryKey: ['instagram-connection-for-whatsapp-avatars'],
    queryFn: getInstagramConnection,
    staleTime: 5 * 60 * 1000,
  });
  const instagramAccounts = instagramConnectionQuery.data?.data?.accounts || instagramConnectionQuery.data?.accounts || [];
  const instagramMessageQueries = useQueries({
    queries: instagramAccounts.map((account) => ({
      queryKey: ['instagram-messages-for-whatsapp-avatars', account.id],
      queryFn: () => getInstagramMessages(account.id),
      staleTime: 2 * 60 * 1000,
      enabled: Boolean(account.id),
    })),
  });

  const rawThreads = threadsQuery.data?.data || [];
  const threads = useMemo(() => {
    return rawThreads.filter((thread) => {
      if (filterMode === 'customers') return Boolean(thread.session?.isHandedOff);
      if (filterMode === 'leads') return !thread.session?.isHandedOff;
      return true;
    });
  }, [rawThreads, filterMode]);

  const selectedThread = threads.find((thread) => thread.customer.id === selectedId)
    || (newContactThread?.customer?.id === selectedId ? newContactThread : null)
    || threads[0]
    || null;
  const selectedCustomerId = selectedThread?.customer.id;
  const messagesQuery = useMessages(selectedCustomerId, { limit: 80 });
  const sendMessage = useSendMessage();
  const takeover = useTakeover();
  const assignableAgentsQuery = useAssignableAgents();
  const assignableAgents = Array.isArray(assignableAgentsQuery.data?.data) ? assignableAgentsQuery.data.data : [];
  const assignThread = useAssignThread();
  const messages = messagesQuery.data?.data || [];
  const isBotActive = Boolean(selectedThread?.session && !selectedThread.session.isHandedOff);
  const isReplyEnabled = Boolean(selectedCustomerId && !isBotActive);
  const chatMatches = chatSearch.trim()
    ? messages.filter((message) => String(message.content || '').toLowerCase().includes(chatSearch.trim().toLowerCase())).length
    : 0;
  const profileImageByPhone = useMemo(() => {
    const imageMap = new Map();
    instagramMessageQueries.forEach((query) => {
      const rows = query.data?.data || [];
      rows.forEach((thread) => {
        const image = getRealProfileImage(thread) || (thread.replies || []).map(getRealProfileImage).find(Boolean);
        const key = getInstagramPhoneKey(thread.senderId || thread.id);
        if (key && image) imageMap.set(key, image);
      });
    });
    return imageMap;
  }, [instagramMessageQueries]);

  useEffect(() => {
    if (!selectedId && threads.length > 0) {
      setSelectedId(threads[0].customer.id);
    }
  }, [selectedId, threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedCustomerId]);

  useEffect(() => {
    if (chatSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [chatSearchOpen]);

  const closeMenus = () => {
    setFilterOpen(false);
    setInboxMenuOpen(false);
    setChatMenuOpen(false);
    setAssignMenuOpen(false);
  };

  const handleAssign = async (agentId) => {
    if (!selectedCustomerId) return;
    setAssignMenuOpen(false);
    try {
      const result = await assignThread.mutateAsync({ customerId: selectedCustomerId, agentId: agentId || null });
      const leadAssignmentsUpdated = result?.data?.leadAssignmentsUpdated || 0;
      toast.success(
        leadAssignmentsUpdated > 0
          ? (agentId ? 'Conversation and lead assigned' : 'Conversation and lead unassigned')
          : (agentId ? 'Conversation assigned' : 'Conversation unassigned')
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update assignee');
    }
  };

  const appendToComposer = (text) => {
    setMessageInput((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${text}`);
    setTimeout(() => composerRef.current?.focus(), 0);
  };

  const copyText = async (text, successMessage) => {
    if (!text) {
      toast.error('Nothing to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (err) {
      toast.error('Clipboard is not available in this browser');
    }
  };

  const handleSend = async () => {
    const content = messageInput.trim();
    if (!content || !selectedCustomerId) return;
    if (!isReplyEnabled) {
      toast.error('Take over this chat before replying');
      return;
    }
    try {
      await sendMessage.mutateAsync({ customerId: selectedCustomerId, content, type: 'TEXT' });
      setMessageInput('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Message failed');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleCreateContact = async (event) => {
    event.preventDefault();
    try {
      const response = await createCustomer.mutateAsync({
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        notes: contactForm.notes.trim() || undefined,
      });
      const customer = response?.data;
      if (customer?.id) {
        setNewContactThread({
          customer,
          session: null,
          lastMessage: null,
          lastActivityAt: customer.updatedAt || customer.createdAt || new Date().toISOString(),
        });
        setSelectedId(customer.id);
      }
      setContactForm(emptyContactForm);
      setContactOpen(false);
      setFilterMode('all');
      setSearch('');
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      toast.success('Contact created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create contact');
    }
  };

  const handleTakeover = async () => {
    if (!selectedCustomerId) return;
    try {
      await takeover.mutateAsync(selectedCustomerId);
      toast.success('Chat takeover enabled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot take over this chat');
    }
  };

  const handleVoiceTyping = () => {
    if (messageInput.trim()) {
      void handleSend();
      return;
    }
    if (!isReplyEnabled) {
      toast.error('Take over this chat before replying');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice typing is not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Voice typing stopped');
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) appendToComposer(transcript);
    };
    recognition.start();
  };

  const copyConversation = () => {
    const text = messages.map((message) => {
      const direction = message.direction === 'OUT' ? 'Staff' : selectedThread?.customer?.name || 'Customer';
      return `${direction} (${formatTime(message.timestamp)}): ${message.content || '[Media message]'}`;
    }).join('\n');
    void copyText(text, 'Conversation copied');
  };

  return (
    <div className="h-[calc(100dvh-4rem)] lg:h-dvh overflow-hidden bg-[#f6f7f8]">
      <NewContactModal
        open={contactOpen}
        form={contactForm}
        setForm={setContactForm}
        creating={createCustomer.isPending}
        onClose={() => setContactOpen(false)}
        onSubmit={handleCreateContact}
      />

      <div className="grid grid-cols-1 h-full min-h-0 overflow-hidden bg-white lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className={cx("min-h-0 flex-col border-r border-slate-200 bg-white relative", isMobileChatOpen ? "hidden lg:flex" : "flex")}>
          <div className="bg-[#008069] px-4 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-sm font-extrabold">WhatsApp Business</h1>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setContactOpen(true)} className="rounded-full p-1.5 hover:bg-white/10" title="New customer">
                  <UserPlusIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('customers');
                    toast.success('Showing customer chats');
                  }}
                  className="rounded-full p-1.5 hover:bg-white/10"
                  title="Customer chats"
                >
                  <UserGroupIcon className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => setContactOpen(true)} className="rounded-full p-1.5 hover:bg-white/10" title="Add">
                  <PlusIcon className="h-5 w-5" />
                </button>
                <div className="relative">
                  <button type="button" onClick={() => setInboxMenuOpen((open) => !open)} className="rounded-full p-1.5 hover:bg-white/10" title="More">
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  {inboxMenuOpen ? (
                    <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                      <MenuButton onClick={() => { closeMenus(); threadsQuery.refetch(); }}>Refresh inbox</MenuButton>
                      <MenuButton onClick={() => { closeMenus(); navigate('/customers'); }}>Open customers</MenuButton>
                      <MenuButton onClick={() => { closeMenus(); navigate('/templates'); }}>Open templates</MenuButton>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-stretch border-b border-slate-200 bg-white">
            {CHANNEL_TABS.map((tab) => {
              const isActive = selectedChannel === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => {
                    if (tab.disabled) {
                      toast('Messenger is coming soon');
                      return;
                    }
                    setSelectedChannel(tab.key);
                  }}
                  className={cx(
                    'flex min-w-0 flex-1 items-center justify-center gap-1 px-1.5 py-2.5 text-[11px] font-extrabold transition-colors',
                    tab.disabled
                      ? 'cursor-not-allowed text-slate-300'
                      : isActive
                        ? 'border-b-2 border-[#008069] text-[#008069]'
                        : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700',
                  )}
                  title={tab.disabled ? 'Coming soon' : tab.label}
                >
                  <span className="truncate">{tab.label}</span>
                  {tab.disabled ? <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] font-bold text-slate-400">SOON</span> : null}
                </button>
              );
            })}
          </div>

          <div className="border-b border-slate-200 bg-white flex items-center justify-between px-4 py-2">
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setSearch('');
                threadsQuery.refetch();
              }}
              className="border-b-2 border-[#008069] px-2 py-1 text-xs font-extrabold text-[#008069]"
            >
              CHATS
            </button>
            {selectedChannel !== 'instagram' && whatsappChannels.length > 0 && (
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="max-w-[140px] truncate rounded border border-slate-200 bg-white py-1.5 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#008069]"
              >
                <option value="all">All Numbers</option>
                {whatsappChannels.map((c) => (
                  <option key={c.id} value={c.id}>{c.label || c.displayPhoneNumber || c.whatsappNumber}</option>
                ))}
              </select>
            )}
          </div>

          <div className="relative flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex min-h-[42px] flex-1 items-center gap-2 rounded-full bg-[#f3f6f8] px-3">
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500"
                placeholder="Search or start new chat"
              />
            </div>
            <button type="button" onClick={() => setFilterOpen((open) => !open)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Filters">
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
            {filterOpen ? (
              <div className="absolute right-4 top-14 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {[
                  ['all', 'All chats'],
                  ['customers', 'Customers'],
                  ['leads', 'Leads'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilterMode(value);
                      setFilterOpen(false);
                    }}
                    className={cx(
                      'block w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-50',
                      filterMode === value ? 'text-[#008069]' : 'text-slate-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-24">
            {threadsQuery.isLoading ? (
              <ThreadSkeleton />
            ) : threads.length === 0 ? (
              <div className="p-8 text-center">
                <UserCircleIcon className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No WhatsApp chats yet</p>
                <p className="mt-1 text-xs text-slate-400">New customer conversations will appear here.</p>
              </div>
            ) : (
              <div>
                {threads.map((thread, index) => {
                  const customer = thread.customer;
                  const lastMessage = thread.lastMessage;
                  const active = customer.id === selectedCustomerId;
                  const badge = thread.session?.isHandedOff ? 'Customer' : 'Lead';
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(customer.id);
                        setIsMobileChatOpen(true);
                      }}
                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${active ? 'bg-[#f0f2f5]' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <Avatar customer={customer} avatarUrl={profileImageByPhone.get(customer.phone)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-extrabold text-slate-900">{customer.name || formatPhone(customer.phone) || 'WhatsApp Customer'}</p>
                          <span className="shrink-0 text-[10px] font-semibold text-slate-500">{timeAgo(thread.lastActivityAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {lastMessage?.direction === 'OUT' ? statusIcon(lastMessage.status) : null}
                          <p className="truncate text-xs text-slate-500">
                            {lastMessage?.content ? truncate(lastMessage.content, 48) : 'No messages yet'}
                          </p>
                        </div>
                        {thread.assignedAgent ? (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#008069]">
                            <UserPlusIcon className="h-3 w-3" />
                            <span className="truncate">{thread.assignedAgent.name}</span>
                          </div>
                        ) : null}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white ${badge === 'Customer' ? 'bg-[#0b4f9f]' : 'bg-[#ff8a00]'}`}>
                        {badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="absolute bottom-6 right-6">
            <button type="button" onClick={() => setContactOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#00a884] text-white shadow-lg transition hover:bg-[#008f6f]" title="New Contact">
              <ChatBubbleBottomCenterTextIcon className="h-6 w-6" />
            </button>
          </div>
        </aside>

        <section className={cx("min-h-0 bg-[#efeae2] flex-col", !isMobileChatOpen ? "hidden lg:flex" : "flex")}>
          {!selectedThread ? (
            <EmptyConversation />
          ) : (
            <div className="flex h-full min-h-0 flex-col relative">
              <header className="flex min-h-[64px] items-center justify-between gap-3 border-b border-slate-200 bg-[#f0f2f5] px-3 sm:px-5 py-2 sm:py-3 z-10">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <button type="button" onClick={() => setIsMobileChatOpen(false)} className="lg:hidden -ml-1 rounded-full p-2 text-slate-600 hover:bg-slate-200">
                    <ArrowLeftIcon className="h-5 w-5" />
                  </button>
                  <Avatar customer={selectedThread.customer} avatarUrl={profileImageByPhone.get(selectedThread.customer.phone)} size="h-10 w-10 sm:h-12 sm:w-12" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-base font-extrabold text-slate-950">
                        {selectedThread.customer.name || formatPhone(selectedThread.customer.phone) || 'WhatsApp Customer'}
                      </h2>
                      <span className="rounded-full bg-[#0b4f9f] px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {selectedThread.session?.isHandedOff ? 'Customer' : 'Lead'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Last seen today at {formatTime(selectedThread.lastActivityAt || new Date())}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-slate-900">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { closeMenus(); setAssignMenuOpen((open) => !open); }}
                      className={cx(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition',
                        selectedThread.assignedAgent
                          ? 'border-[#008069] bg-[#e7f4ef] text-[#008069]'
                          : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                      )}
                      title="Assign conversation"
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      <span className="max-w-[120px] truncate">
                        {selectedThread.assignedAgent ? selectedThread.assignedAgent.name : 'Assign'}
                      </span>
                    </button>
                    {assignMenuOpen ? (
                      <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                        <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Assign to</div>
                        <button
                          type="button"
                          onClick={() => handleAssign(null)}
                          disabled={assignThread.isPending}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Unassigned
                          {!selectedThread.assignedAgent ? <span className="text-[#008069]">✓</span> : null}
                        </button>
                        <div className="max-h-60 overflow-y-auto">
                          {assignableAgents.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">No staff available</div>
                          ) : assignableAgents.map((agent) => {
                            const isCurrent = selectedThread.assignedAgent?.id === agent.id;
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => handleAssign(agent.id)}
                                disabled={assignThread.isPending}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <span className={cx('h-2 w-2 shrink-0 rounded-full', agent.isOnline ? 'bg-emerald-500' : 'bg-slate-300')} />
                                  <span className="truncate">{agent.name}</span>
                                </span>
                                {isCurrent ? <span className="text-[#008069]">✓</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setChatSearchOpen((open) => !open)} className="rounded-full p-1.5 hover:bg-slate-100" title="Search messages">
                    <MagnifyingGlassIcon className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <button type="button" onClick={() => setChatMenuOpen((open) => !open)} className="rounded-full p-1.5 hover:bg-slate-100" title="More">
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
                    {chatMenuOpen ? (
                      <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                        <MenuButton onClick={() => { closeMenus(); void copyText(selectedThread.customer.phone, 'Phone copied'); }}>Copy phone</MenuButton>
                        <MenuButton onClick={() => { closeMenus(); copyConversation(); }}>Copy conversation</MenuButton>
                        <MenuButton onClick={() => { closeMenus(); navigate('/customers'); }}>Open customers</MenuButton>
                        <MenuButton onClick={() => { closeMenus(); messagesQuery.refetch(); }}>Refresh messages</MenuButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              </header>

              {chatSearchOpen ? (
                <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2">
                  <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                  <input
                    value={chatSearch}
                    onChange={(event) => setChatSearch(event.target.value)}
                    className="min-w-0 flex-1 text-sm outline-none"
                    placeholder="Search in conversation"
                  />
                  <span className="text-xs font-bold text-slate-500">{chatSearch.trim() ? `${chatMatches} match${chatMatches === 1 ? '' : 'es'}` : ''}</span>
                  <button type="button" onClick={() => { setChatSearchOpen(false); setChatSearch(''); }} className="rounded-full p-1 text-slate-500 hover:bg-slate-100" title="Close search">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {isBotActive ? (
                <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-[#f2d99d] bg-[#fff3cd] px-3 sm:px-5 py-2 text-xs font-bold text-[#805b00]">
                  <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" />
                    <span className="truncate">Bot mode is active. Take over to reply manually.</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTakeover}
                    disabled={takeover.isPending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#008069] px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
                  >
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Take over
                  </button>
                </div>
              ) : null}

              <div
                className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-10"
                style={{
                  backgroundColor: '#efeae2',
                  backgroundImage:
                    'radial-gradient(circle at 20px 20px, rgba(0,0,0,0.03) 1px, transparent 1px), radial-gradient(circle at 48px 44px, rgba(0,0,0,0.03) 1.5px, transparent 1.5px)',
                  backgroundSize: '72px 72px',
                }}
              >
                <ChatDatePill>Yesterday</ChatDatePill>
                {messagesQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c6ead0] border-t-[#008069]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                    No messages yet
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-5xl flex-col gap-4">
                    {messages.map((message, index) => {
                      const outgoing = message.direction === 'OUT';
                      const showTemplate = outgoing && index === 1;
                      const match = chatSearch.trim() && String(message.content || '').toLowerCase().includes(chatSearch.trim().toLowerCase());
                      return (
                        <div key={message.id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={cx(
                              'max-w-[85%] sm:max-w-[78%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]',
                              outgoing ? 'bg-[#e7ffdb] text-slate-950' : 'bg-white text-slate-950',
                              match ? 'ring-2 ring-[#34b7f1]' : ''
                            )}
                          >
                            {showTemplate ? <TemplateBadge /> : null}
                            <p className="whitespace-pre-wrap break-words">{message.content || '[Media message]'}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-500">
                              <span>{formatTime(message.timestamp)}</span>
                              {outgoing ? statusIcon(message.status) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <footer className="relative bg-[#f0f2f5] px-2 sm:px-4 py-2 sm:py-3">
                <div className="flex items-end gap-2 sm:gap-3">
                  <div className="flex min-h-[44px] flex-1 items-center rounded-2xl bg-white px-3 sm:px-4 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                    <textarea
                      ref={composerRef}
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={!isReplyEnabled}
                      rows={1}
                      className="max-h-24 min-h-[24px] flex-1 py-3 resize-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder={isReplyEnabled ? 'Type a message...' : 'Take over this chat to reply'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVoiceTyping}
                    disabled={!isReplyEnabled || sendMessage.isPending}
                    className={cx(
                      'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition hover:bg-[#008f6f] disabled:cursor-not-allowed disabled:opacity-60',
                      isListening ? 'animate-pulse' : ''
                    )}
                    title={messageInput.trim() ? 'Send message' : 'Voice typing'}
                  >
                    {messageInput.trim() ? <PaperAirplaneIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-6 w-6" />}
                  </button>
                </div>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
