import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import {
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  LinkIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';

function loadFacebookSdk(appId) {
  return new Promise((resolve, reject) => {
    if (!appId) {
      reject(new Error('Facebook app ID is missing'));
      return;
    }

    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v25.0',
      });
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function initFacebookSdk() {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: 'v25.0',
      });
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

    const cleanup = () => {
      window.removeEventListener('message', sessionInfoListener);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const sessionInfoListener = (event) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (_err) {
          return;
        }
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

    const extras = {
      feature: 'whatsapp_embedded_signup',
      sessionInfoVersion: embeddedSignup.sessionInfoVersion || '3',
      version: 'v3',
      setup: {},
    };

    if (embeddedSignup.featureType) {
      extras.featureType = embeddedSignup.featureType;
    }

    const loginOptions = {
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
      override_default_response_type: true,
      extras,
    };

    if (embeddedSignup.configId) {
      loginOptions.config_id = embeddedSignup.configId;
    }

    FB.login((response) => {
      const code = response?.authResponse?.code;
      if (!code) {
        fail(new Error('Facebook signup was cancelled or no authorization code was returned'));
        return;
      }

      finish({ code, sessionInfo });
    }, loginOptions);
  }));
}

const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
];
const DEFAULT_INSTAGRAM_APP_ID = '1458846952437606';
const CONFIGURED_INSTAGRAM_APP_ID = String(import.meta.env.VITE_INSTAGRAM_APP_ID || DEFAULT_INSTAGRAM_APP_ID).trim();

function createInstagramOAuthState() {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `travelbot_instagram_connect:${randomPart}`;
}

function startInstagramSignup(appId) {
  if (!appId) {
    throw new Error('Instagram App ID is missing. Set VITE_INSTAGRAM_APP_ID after enabling Instagram Login in Meta.');
  }

  const redirectUri = `${window.location.origin}/auth/meta/callback`;
  const state = createInstagramOAuthState();
  sessionStorage.setItem('travelbot_instagram_oauth_state', state);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state,
    enable_fb_login: '0',
    force_authentication: '1',
  });

  window.location.assign(`https://www.instagram.com/oauth/authorize?${params.toString()}`);
}

function statusTone(status) {
  if (status === 'CONNECTED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (status === 'FAILED') return 'bg-rose-100 text-rose-700';
  return 'bg-neutral-100 text-neutral-600';
}

const DEFAULT_WELCOME_MESSAGE = [
  'Hi {customerName}',
  'Welcome to {agencyName}',
  'Tell us what you want to explore today.',
  '',
  'How can I help you today?',
].join('\n');

const DEFAULT_WHATSAPP_MENU_LABELS = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Plan a Trip',
  staycations: 'Staycations',
  flight: 'Flight',
  rail: 'Rail',
  domestic: 'Domestic',
  international: 'International',
  customTrip: 'Custom Trip',
};

const MENU_LABEL_FIELDS = [
  ['visaTicketing', 'Welcome: Visa & Ticketing'],
  ['planTrip', 'Welcome: Plan a Trip'],
  ['staycations', 'Welcome: Staycations'],
  ['flight', 'Visa submenu: Flight'],
  ['rail', 'Visa submenu: Rail'],
  ['international', 'Trip submenu: International'],
  ['domestic', 'Trip submenu: Domestic'],
  ['customTrip', 'Trip submenu: Custom Trip'],
];

const MENU_ITEM_TYPES = [
  ['PACKAGE_CATEGORY', 'Package category'],
  ['PROPERTY', 'Property / resort'],
  ['SERVICE', 'Booking service'],
  ['CUSTOM_TRIP', 'Custom trip form'],
];

const SAMPLE_MENU_CONFIG = [
  { id: 'college_packages', title: 'College Packages', description: 'Tours for students', type: 'PACKAGE_CATEGORY', value: 'COLLEGE' },
  { id: 'family_packages', title: 'Family Packages', description: 'Family-friendly trips', type: 'PACKAGE_CATEGORY', value: 'FAMILY' },
  { id: 'couple_packages', title: 'Couple Packages', description: 'Honeymoon and couples', type: 'PACKAGE_CATEGORY', value: 'COUPLE' },
  { id: 'budget_packages', title: 'Budget Packages', description: 'Affordable packages', type: 'PACKAGE_CATEGORY', value: 'BUDGET' },
  { id: 'resorts', title: 'Resorts', description: 'Stays and properties', type: 'PROPERTY', value: 'Resort' },
  { id: 'train_booking', title: 'Train Booking', description: 'Rail ticket enquiries', type: 'SERVICE', value: 'TRAIN' },
  { id: 'bus_booking', title: 'Bus Booking', description: 'Bus ticket enquiries', type: 'SERVICE', value: 'BUS' },
];

const FLOW_ACTION_TYPES = [
  ['OPEN_PACKAGE_CATEGORY_MENU', 'Open package categories'],
  ['OPEN_PROPERTY_FLOW', 'Open properties flow'],
  ['OPEN_SERVICE_MENU', 'Open services menu'],
  ['OPEN_CUSTOM_TRIP_FLOW', 'Open custom trip form'],
  ['SHOW_TOUR_TYPE_LIST', 'Show tour type list'],
  ['OPEN_PACKAGE_FLOW', 'Open package flow'],
  ['CAPTURE_SERVICE_DETAILS', 'Capture service details'],
];

const FLOW_SECTIONS = [
  ['welcomeMenu', 'First message menu', 'The first options a WhatsApp user sees. Use up to 3 for buttons; more becomes a list.', 10],
  ['packageCategories', 'Package category buttons', 'Shown after user taps packages. Keep this to 3 WhatsApp buttons.', 3],
  ['tourTypes', 'Tour type list', 'Shown after Domestic or International, then opens filtered packages.', 10],
  ['serviceMenu', 'Service list', 'Shown after user taps Services, then captures service details.', 10],
];

const SAMPLE_FLOW_CONFIG = {
  welcomeMenu: [
    { id: 'show_packages', title: 'Show Packages', description: 'Domestic and international trips', action: 'OPEN_PACKAGE_CATEGORY_MENU' },
    { id: 'show_properties', title: 'Show Properties', description: 'Resorts and stays', action: 'OPEN_PROPERTY_FLOW' },
    { id: 'services', title: 'Services', description: 'Train, bus, visa and more', action: 'OPEN_SERVICE_MENU' },
  ],
  packageCategories: [
    { id: 'custom_packages', title: 'Custom', description: 'Build a custom trip', action: 'OPEN_CUSTOM_TRIP_FLOW' },
    { id: 'domestic_packages', title: 'Domestic', description: 'India packages', action: 'SHOW_TOUR_TYPE_LIST', category: 'DOMESTIC' },
    { id: 'international_packages', title: 'International', description: 'Abroad packages', action: 'SHOW_TOUR_TYPE_LIST', category: 'INTERNATIONAL' },
  ],
  tourTypes: [
    { id: 'couple_tours', title: 'Couple', description: 'Couple and honeymoon packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'COUPLE' },
    { id: 'family_tours', title: 'Family', description: 'Family packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'FAMILY' },
    { id: 'budget_tours', title: 'Budget', description: 'Affordable packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'BUDGET' },
    { id: 'college_tours', title: 'College', description: 'Student and group packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'COLLEGE' },
  ],
  serviceMenu: [
    { id: 'train_booking', title: 'Train Booking', description: 'Rail ticket enquiry', action: 'CAPTURE_SERVICE_DETAILS', value: 'TRAIN' },
    { id: 'bus_booking', title: 'Bus Booking', description: 'Bus ticket enquiry', action: 'CAPTURE_SERVICE_DETAILS', value: 'BUS' },
    { id: 'visa_ticketing', title: 'Visa & Ticketing', description: 'Visa, flights and ticketing', action: 'CAPTURE_SERVICE_DETAILS', value: 'VISA_TICKETING' },
  ],
};

function getMenuLabels(overrides = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_MENU_LABELS).map(([key, fallback]) => [
      key,
      String(overrides?.[key] || fallback).slice(0, 20),
    ])
  );
}

function getMenuLabelPayload(labels = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_MENU_LABELS)
      .map(([key, fallback]) => [key, String(labels?.[key] || '').trim().slice(0, 20), fallback])
      .filter(([, value, fallback]) => value && value !== fallback)
      .map(([key, value]) => [key, value])
  );
}

function toMenuId(value, fallback) {
  return String(value || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function normalizeMenuConfig(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();

  return items
    .map((item, index) => {
      const type = String(item?.type || 'PACKAGE_CATEGORY').toUpperCase();
      const title = String(item?.title || '').trim().slice(0, 24);
      if (!title || !MENU_ITEM_TYPES.some(([value]) => value === type)) return null;

      const value = String(item?.value || '').trim().slice(0, 80);
      const id = toMenuId(item?.id, `${type}_${value || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: String(item?.description || '').trim().slice(0, 72),
        type,
        value,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeFlowValue(value, limit = 80) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, limit);
}

function normalizeFlowItems(items = [], limit = 10) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();

  return items
    .map((item, index) => {
      const action = String(item?.action || '').trim().toUpperCase();
      const title = String(item?.title || '').trim().slice(0, 24);
      if (!title || !FLOW_ACTION_TYPES.some(([value]) => value === action)) return null;

      const category = normalizeFlowValue(item?.category, 32);
      const tourType = normalizeFlowValue(item?.tourType || item?.value, 80);
      const id = toMenuId(item?.id, `${action}_${category || tourType || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: String(item?.description || '').trim().slice(0, 72),
        action,
        ...(category ? { category } : {}),
        ...(tourType ? { tourType, value: tourType } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeFlowConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  return Object.fromEntries(
    FLOW_SECTIONS
      .map(([key,, , limit]) => [key, normalizeFlowItems(config[key], limit)])
      .filter(([, items]) => items.length > 0)
  );
}

function renderWelcomePreview(message, agencyName) {
  return String(message || DEFAULT_WELCOME_MESSAGE)
    .replace(/\{customerName\}/g, 'Ravi')
    .replace(/\{agencyName\}/g, agencyName || 'Your Agency');
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function Settings() {
  const { agency, updateAgency } = useAuthStore();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: agency?.name || '',
    phone: agency?.phone || '',
    googleReviewLink: agency?.googleReviewLink || '',
    autoReviewCollectionEnabled: agency?.autoReviewCollectionEnabled !== false,
    autoReviewDelayDays: agency?.autoReviewDelayDays ?? 2,
    followUpReminderEnabled: agency?.followUpReminderEnabled !== false,
    followUpReminderMinutes: agency?.followUpReminderMinutes ?? 30,
    whatsappCatalogId: agency?.whatsappCatalogId || '',
    welcomeMessage: agency?.welcomeMessage || '',
    whatsappMenuLabels: getMenuLabels(agency?.whatsappMenuLabels || {}),
    whatsappMenuConfig: normalizeMenuConfig(agency?.whatsappMenuConfig || []),
    whatsappFlowConfig: normalizeFlowConfig(agency?.whatsappFlowConfig || {}),
    razorpayKeyId: '',
    razorpayKeySecret: '',
    webhookSecret: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectFlowStep, setConnectFlowStep] = useState('idle');
  const [connectFlowError, setConnectFlowError] = useState('');
  const [connectMode, setConnectMode] = useState('coexistence');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Settings updated successfully.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update settings');
      setSuccess('');
    },
  });

  const whatsappConnectionQuery = useQuery({
    queryKey: ['whatsapp-connection'],
    queryFn: () => client.get('/agencies/me/whatsapp-connection').then((response) => response.data.data),
    initialData: agency?.whatsappConnection || null,
  });

  const connectMutation = useMutation({
    mutationFn: (payload = {}) => client.post('/agencies/me/whatsapp-connection/connect', payload),
    onSuccess: ({ data: response }) => {
      const connection = response.data;
      updateAgency({ whatsappConnection: connection, whatsappProvider: connection.provider });
      qc.setQueryData(['whatsapp-connection'], connection);
      setSuccess('Marketing OS signup is ready. Complete the Meta popup to finish connecting your WhatsApp number.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to start WhatsApp connection');
      setSuccess('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ code, sessionToken, sessionInfo }) => client.post('/agencies/me/whatsapp-connection/complete', {
      code,
      sessionToken,
      sessionInfo,
      phoneNumberId: sessionInfo?.phone_number_id,
      wabaId: sessionInfo?.waba_id,
      businessId: sessionInfo?.business_id,
    }),
    onSuccess: ({ data: response }) => {
      const connection = response.data;
      updateAgency({
        whatsappConnection: connection,
        whatsappProvider: connection.provider,
        whatsappNumber: connection.displayPhoneNumber || agency?.whatsappNumber,
      });
      qc.setQueryData(['whatsapp-connection'], connection);
      setSuccess('WhatsApp connected successfully through Marketing OS.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to complete WhatsApp connection');
      setSuccess('');
    },
  });

  const instagramConnectionQuery = useQuery({
    queryKey: ['instagram-connection'],
    queryFn: () => client.get('/agencies/me/instagram-connection').then((response) => response.data.data),
  });

  const connectIgMutation = useMutation({
    mutationFn: (payload) => client.post('/agencies/me/instagram-connection/connect', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instagram-connection'] });
      setSuccess('Instagram connected successfully.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to connect Instagram');
      setSuccess('');
    },
  });

  const disconnectIgMutation = useMutation({
    mutationFn: (accountId) => client.delete(`/agencies/me/instagram-connection/${encodeURIComponent(accountId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instagram-connection'] });
      setSuccess('Instagram disconnected.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to disconnect Instagram');
      setSuccess('');
    },
  });

  const handleConnectInstagram = async () => {
    try {
      const appId = CONFIGURED_INSTAGRAM_APP_ID;

      if (!appId) {
        throw new Error('Instagram App ID not found. Add VITE_INSTAGRAM_APP_ID for the Instagram Login app.');
      }

      setError('');
      setSuccess('');
      startInstagramSignup(appId);
    } catch (err) {
      setError(err.message || 'Failed to start Instagram connection');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    if (form.name !== agency?.name) data.name = form.name;
    if (form.phone !== agency?.phone) data.phone = form.phone;
    if (form.googleReviewLink !== agency?.googleReviewLink) data.googleReviewLink = form.googleReviewLink;
    if (form.autoReviewCollectionEnabled !== (agency?.autoReviewCollectionEnabled !== false)) data.autoReviewCollectionEnabled = form.autoReviewCollectionEnabled;
    if (parseInt(form.autoReviewDelayDays, 10) !== (agency?.autoReviewDelayDays ?? 2)) data.autoReviewDelayDays = parseInt(form.autoReviewDelayDays, 10);
    if (form.followUpReminderEnabled !== (agency?.followUpReminderEnabled !== false)) data.followUpReminderEnabled = form.followUpReminderEnabled;
    if (parseInt(form.followUpReminderMinutes, 10) !== (agency?.followUpReminderMinutes ?? 30)) data.followUpReminderMinutes = parseInt(form.followUpReminderMinutes, 10);
    if (form.whatsappCatalogId !== agency?.whatsappCatalogId) data.whatsappCatalogId = form.whatsappCatalogId;
    const welcomeMessage = form.welcomeMessage.trim();
    if (welcomeMessage !== (agency?.welcomeMessage || '')) data.welcomeMessage = welcomeMessage || null;
    const menuLabelPayload = getMenuLabelPayload(form.whatsappMenuLabels);
    const currentMenuLabelPayload = getMenuLabelPayload(getMenuLabels(agency?.whatsappMenuLabels || {}));
    if (JSON.stringify(menuLabelPayload) !== JSON.stringify(currentMenuLabelPayload)) data.whatsappMenuLabels = menuLabelPayload;
    const menuConfigPayload = normalizeMenuConfig(form.whatsappMenuConfig);
    const currentMenuConfigPayload = normalizeMenuConfig(agency?.whatsappMenuConfig || []);
    if (JSON.stringify(menuConfigPayload) !== JSON.stringify(currentMenuConfigPayload)) data.whatsappMenuConfig = menuConfigPayload;
    const flowConfigPayload = normalizeFlowConfig(form.whatsappFlowConfig);
    const currentFlowConfigPayload = normalizeFlowConfig(agency?.whatsappFlowConfig || {});
    if (JSON.stringify(flowConfigPayload) !== JSON.stringify(currentFlowConfigPayload)) data.whatsappFlowConfig = flowConfigPayload;
    if (form.razorpayKeyId) data.razorpayKeyId = form.razorpayKeyId;
    if (form.razorpayKeySecret) data.razorpayKeySecret = form.razorpayKeySecret;
    if (form.webhookSecret) data.webhookSecret = form.webhookSecret;

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateMenuLabel = (field, value) => setForm((current) => ({
    ...current,
    whatsappMenuLabels: {
      ...current.whatsappMenuLabels,
      [field]: value.slice(0, 20),
    },
  }));
  const updateMenuItem = (index, field, value) => setForm((current) => {
    const items = [...current.whatsappMenuConfig];
    const currentItem = items[index] || { type: 'PACKAGE_CATEGORY' };
    const nextItem = {
      ...currentItem,
      [field]: field === 'title' ? value.slice(0, 24) : field === 'description' ? value.slice(0, 72) : value.slice(0, 80),
    };

    if (field === 'title' && !currentItem.id) {
      nextItem.id = toMenuId(value, `menu_${index + 1}`);
    }

    if (field === 'type' && value === 'CUSTOM_TRIP') {
      nextItem.value = '';
    }

    items[index] = nextItem;
    return { ...current, whatsappMenuConfig: items };
  });
  const addMenuItem = () => setForm((current) => ({
    ...current,
    whatsappMenuConfig: [
      ...current.whatsappMenuConfig,
      { id: '', title: '', description: '', type: 'PACKAGE_CATEGORY', value: '' },
    ].slice(0, 10),
  }));
  const removeMenuItem = (index) => setForm((current) => ({
    ...current,
    whatsappMenuConfig: current.whatsappMenuConfig.filter((_, itemIndex) => itemIndex !== index),
  }));
  const loadSampleMenuConfig = () => update('whatsappMenuConfig', SAMPLE_MENU_CONFIG);
  const clearMenuConfig = () => update('whatsappMenuConfig', []);
  const updateFlowItem = (sectionKey, index, field, value) => setForm((current) => {
    const config = current.whatsappFlowConfig || {};
    const items = [...(config[sectionKey] || [])];
    const currentItem = items[index] || { action: 'OPEN_PACKAGE_FLOW' };
    const nextItem = {
      ...currentItem,
      [field]: field === 'title' ? value.slice(0, 24) : field === 'description' ? value.slice(0, 72) : value.slice(0, 80),
    };

    if (field === 'title' && !currentItem.id) {
      nextItem.id = toMenuId(value, `${sectionKey}_${index + 1}`);
    }

    if (field === 'action') {
      if (!['SHOW_TOUR_TYPE_LIST', 'OPEN_PACKAGE_FLOW'].includes(value)) {
        delete nextItem.category;
      }
      if (!['OPEN_PACKAGE_FLOW', 'CAPTURE_SERVICE_DETAILS'].includes(value)) {
        delete nextItem.tourType;
        delete nextItem.value;
      }
    }

    if (field === 'tourType' || field === 'value') {
      nextItem.value = value.slice(0, 80);
    }

    items[index] = nextItem;
    return {
      ...current,
      whatsappFlowConfig: {
        ...config,
        [sectionKey]: items,
      },
    };
  });
  const addFlowItem = (sectionKey, limit) => setForm((current) => {
    const config = current.whatsappFlowConfig || {};
    const sectionDefaults = {
      welcomeMenu: { id: '', title: '', description: '', action: 'OPEN_PACKAGE_CATEGORY_MENU' },
      packageCategories: { id: '', title: '', description: '', action: 'SHOW_TOUR_TYPE_LIST', category: 'DOMESTIC' },
      tourTypes: { id: '', title: '', description: '', action: 'OPEN_PACKAGE_FLOW', tourType: '' },
      serviceMenu: { id: '', title: '', description: '', action: 'CAPTURE_SERVICE_DETAILS', value: '' },
    };
    return {
      ...current,
      whatsappFlowConfig: {
        ...config,
        [sectionKey]: [
          ...(config[sectionKey] || []),
          sectionDefaults[sectionKey] || { id: '', title: '', description: '', action: 'OPEN_PACKAGE_FLOW' },
        ].slice(0, limit),
      },
    };
  });
  const removeFlowItem = (sectionKey, index) => setForm((current) => {
    const config = current.whatsappFlowConfig || {};
    return {
      ...current,
      whatsappFlowConfig: {
        ...config,
        [sectionKey]: (config[sectionKey] || []).filter((_, itemIndex) => itemIndex !== index),
      },
    };
  });
  const loadSampleFlowConfig = () => update('whatsappFlowConfig', SAMPLE_FLOW_CONFIG);
  const clearFlowConfig = () => update('whatsappFlowConfig', {});
  const resetWelcomeMessage = () => update('welcomeMessage', '');
  const resetMenuLabels = () => update('whatsappMenuLabels', getMenuLabels({}));
  const connection = whatsappConnectionQuery.data;
  const whatsappNumber = connection?.displayPhoneNumber || agency?.whatsappNumber || '';
  const connectBusy = connectMutation.isPending || completeMutation.isPending;
  const welcomePreview = renderWelcomePreview(form.welcomeMessage, form.name || agency?.name);

  const closeConnectModal = () => {
    if (connectBusy) return;
    setConnectModalOpen(false);
    setConnectFlowStep('idle');
    setConnectFlowError('');
  };

  const handleConnectWhatsApp = async (mode = connectMode) => {
    const selectedMode = mode === 'standard' ? 'standard' : 'coexistence';
    setConnectMode(selectedMode);
    setConnectModalOpen(true);
    setConnectFlowStep('handshake');
    setConnectFlowError('');
    setError('');
    setSuccess('');

    try {
      const response = await connectMutation.mutateAsync({ onboardingMode: selectedMode });
      const nextConnection = response.data.data;

      if (nextConnection?.embeddedSignup?.sessionToken) {
        setConnectFlowStep('meta');
        const signupResult = await runEmbeddedSignup(nextConnection.embeddedSignup);
        setConnectFlowStep('sync');
        await completeMutation.mutateAsync({
          code: signupResult.code,
          sessionInfo: signupResult.sessionInfo,
          sessionToken: nextConnection.embeddedSignup.sessionToken,
        });
        setConnectFlowStep('connected');
        return;
      }

      throw new Error('Embedded WhatsApp signup is not available yet for this agency');
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to start WhatsApp connection';
      setConnectFlowStep('error');
      setConnectFlowError(message);
      setError(message);
      setSuccess('');
    }
  };

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Keep your agency profile, WhatsApp channel, and payment credentials aligned in one quiet control room.
          </p>
        </div>
      </section>

      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <BuildingOfficeIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">Agency Information</h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Agency name">
                <input value={form.name} onChange={(event) => update('name', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="Agency phone">
                <input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="shell-input-rect" />
              </Field>

              <Field label="Google Review Link" hint="Sent by the bot when customers give 4 or 5 star ratings.">
                <input value={form.googleReviewLink} onChange={(event) => update('googleReviewLink', event.target.value)} placeholder="https://g.page/r/your-agency/review" className="shell-input-rect" />
              </Field>

              <div className="col-span-1 md:col-span-2 rounded-[20px] bg-slate-50 border border-slate-100 p-5 mt-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">WhatsApp Welcome Menu</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">Customize the greeting and button names. The actions stay fixed so each button still opens the correct bot flow.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={resetWelcomeMessage} className="shell-button-secondary px-3 py-2 text-xs">Reset message</button>
                    <button type="button" onClick={resetMenuLabels} className="shell-button-secondary px-3 py-2 text-xs">Reset labels</button>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <Field label="Welcome message" hint="Use {customerName} and {agencyName}. Leave blank to use the default message.">
                      <textarea
                        value={form.welcomeMessage}
                        onChange={(event) => update('welcomeMessage', event.target.value)}
                        rows={6}
                        maxLength={900}
                        placeholder={DEFAULT_WELCOME_MESSAGE}
                        className="shell-input-rect min-h-[150px] resize-y"
                      />
                    </Field>

                    <div className="grid gap-3 md:grid-cols-2">
                      {MENU_LABEL_FIELDS.map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            value={form.whatsappMenuLabels[key] || ''}
                            onChange={(event) => updateMenuLabel(key, event.target.value)}
                            maxLength={20}
                            className="shell-input-rect"
                          />
                        </Field>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                    <p className="eyebrow">Preview</p>
                    <div className="mt-3 whitespace-pre-line rounded-[18px] bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800">
                      {welcomePreview}
                    </div>
                    <div className="mt-4 grid gap-2">
                      {[
                        form.whatsappMenuLabels.visaTicketing,
                        form.whatsappMenuLabels.planTrip,
                        form.whatsappMenuLabels.staycations,
                      ].map((label) => (
                        <div key={label} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Custom menu actions</h4>
                      <p className="mt-1 max-w-2xl text-xs text-slate-500">
                        Add rows here only for agencies that need their own welcome flow. Empty means the default 3-button flow stays active.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={loadSampleMenuConfig} className="shell-button-secondary px-3 py-2 text-xs">Use travel sample</button>
                      <button type="button" onClick={addMenuItem} disabled={form.whatsappMenuConfig.length >= 10} className="shell-button-secondary px-3 py-2 text-xs">
                        <PlusIcon className="h-4 w-4" />
                        Add action
                      </button>
                      <button type="button" onClick={clearMenuConfig} className="shell-button-secondary px-3 py-2 text-xs">Clear</button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {form.whatsappMenuConfig.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                        No custom actions mapped. This agency will use the default Visa, Plan a Trip, and Staycations menu.
                      </div>
                    ) : form.whatsappMenuConfig.map((item, index) => (
                      <div key={`${item.id || 'menu'}-${index}`} className="rounded-[18px] border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                          <Field label="WhatsApp title">
                            <input
                              value={item.title || ''}
                              onChange={(event) => updateMenuItem(index, 'title', event.target.value)}
                              maxLength={24}
                              placeholder="College Packages"
                              className="shell-input-rect"
                            />
                          </Field>

                          <Field label="Action">
                            <select
                              value={item.type || 'PACKAGE_CATEGORY'}
                              onChange={(event) => updateMenuItem(index, 'type', event.target.value)}
                              className="shell-input-rect"
                            >
                              {MENU_ITEM_TYPES.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </Field>

                          <Field
                            label="Map value"
                            hint={
                              item.type === 'PACKAGE_CATEGORY'
                                ? 'Package category, e.g. COLLEGE'
                                : item.type === 'SERVICE'
                                  ? 'Service key, e.g. TRAIN or BUS'
                                  : item.type === 'PROPERTY'
                                    ? 'Property type filter, e.g. Resort'
                                    : 'Not needed'
                            }
                          >
                            <input
                              value={item.value || ''}
                              onChange={(event) => updateMenuItem(index, 'value', event.target.value)}
                              disabled={item.type === 'CUSTOM_TRIP'}
                              placeholder={
                                item.type === 'PACKAGE_CATEGORY'
                                  ? 'COLLEGE'
                                  : item.type === 'SERVICE'
                                    ? 'TRAIN'
                                    : item.type === 'PROPERTY'
                                      ? 'Resort'
                                      : ''
                              }
                              className="shell-input-rect disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </Field>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeMenuItem(index)}
                              className="shell-button-secondary h-[46px] px-3 text-rose-600"
                              aria-label={`Remove ${item.title || 'menu action'}`}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <Field label="Description">
                            <input
                              value={item.description || ''}
                              onChange={(event) => updateMenuItem(index, 'description', event.target.value)}
                              maxLength={72}
                              placeholder="Shown under the menu title"
                              className="shell-input-rect"
                            />
                          </Field>
                          <Field label="Action ID">
                            <input
                              value={item.id || ''}
                              onChange={(event) => updateMenuItem(index, 'id', event.target.value)}
                              maxLength={80}
                              placeholder="college_packages"
                              className="shell-input-rect"
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>

                  {form.whatsappMenuConfig.length > 0 ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                      <p className="eyebrow">Mapped Preview</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {normalizeMenuConfig(form.whatsappMenuConfig).map((item) => (
                          <div key={item.id} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.type.replace(/_/g, ' ')}{item.value ? ` -> ${item.value}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Custom response flow</h4>
                      <p className="mt-1 max-w-2xl text-xs text-slate-500">
                        Map first message options into package, property, service, and tour-type flows for this agency only.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={loadSampleFlowConfig} className="shell-button-secondary px-3 py-2 text-xs">Use package flow sample</button>
                      <button type="button" onClick={clearFlowConfig} className="shell-button-secondary px-3 py-2 text-xs">Clear flow</button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {FLOW_SECTIONS.map(([sectionKey, sectionTitle, sectionHint, limit]) => {
                      const items = form.whatsappFlowConfig?.[sectionKey] || [];
                      return (
                        <div key={sectionKey} className="rounded-[18px] border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h5 className="text-sm font-semibold text-slate-800">{sectionTitle}</h5>
                              <p className="mt-1 max-w-xl text-xs text-slate-500">{sectionHint}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addFlowItem(sectionKey, limit)}
                              disabled={items.length >= limit}
                              className="shell-button-secondary px-3 py-2 text-xs"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Add
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {items.length === 0 ? (
                              <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                No rows mapped in this section.
                              </div>
                            ) : items.map((item, index) => (
                              <div key={`${sectionKey}-${item.id || index}`} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                                  <Field label="Button / list title">
                                    <input
                                      value={item.title || ''}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'title', event.target.value)}
                                      maxLength={24}
                                      placeholder={sectionKey === 'welcomeMenu' ? 'Show Packages' : sectionKey === 'tourTypes' ? 'Couple' : 'Domestic'}
                                      className="shell-input-rect bg-white"
                                    />
                                  </Field>

                                  <Field label="Action">
                                    <select
                                      value={item.action || 'OPEN_PACKAGE_FLOW'}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'action', event.target.value)}
                                      className="shell-input-rect bg-white"
                                    >
                                      {FLOW_ACTION_TYPES.map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                      ))}
                                    </select>
                                  </Field>

                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => removeFlowItem(sectionKey, index)}
                                      className="shell-button-secondary h-[46px] px-3 text-rose-600"
                                      aria-label={`Remove ${item.title || sectionTitle} row`}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
                                  <Field label="Category">
                                    <input
                                      value={item.category || ''}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'category', event.target.value)}
                                      maxLength={32}
                                      placeholder="DOMESTIC or INTERNATIONAL"
                                      className="shell-input-rect bg-white"
                                    />
                                  </Field>

                                  <Field label="Tour type / service key">
                                    <input
                                      value={item.tourType || item.value || ''}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'tourType', event.target.value)}
                                      maxLength={80}
                                      placeholder={sectionKey === 'serviceMenu' ? 'TRAIN' : 'COUPLE'}
                                      className="shell-input-rect bg-white"
                                    />
                                  </Field>

                                  <Field label="Action ID">
                                    <input
                                      value={item.id || ''}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'id', event.target.value)}
                                      maxLength={80}
                                      placeholder="show_packages"
                                      className="shell-input-rect bg-white"
                                    />
                                  </Field>
                                </div>

                                <div className="mt-3">
                                  <Field label="Description">
                                    <input
                                      value={item.description || ''}
                                      onChange={(event) => updateFlowItem(sectionKey, index, 'description', event.target.value)}
                                      maxLength={72}
                                      placeholder="Shown under list row where WhatsApp supports it"
                                      className="shell-input-rect bg-white"
                                    />
                                  </Field>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(normalizeFlowConfig(form.whatsappFlowConfig)).length > 0 ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                      <p className="eyebrow">Flow Preview</p>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {FLOW_SECTIONS.map(([sectionKey, sectionTitle]) => {
                          const items = normalizeFlowConfig(form.whatsappFlowConfig)[sectionKey] || [];
                          if (!items.length) return null;
                          return (
                            <div key={`preview-${sectionKey}`} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3">
                              <p className="text-sm font-semibold text-slate-800">{sectionTitle}</p>
                              <div className="mt-2 space-y-2">
                                {items.map((item) => (
                                  <div key={item.id} className="rounded-[12px] bg-white px-3 py-2 text-xs text-slate-600">
                                    <span className="font-semibold text-slate-800">{item.title}</span>
                                    <span>{' -> '}{item.action.replace(/_/g, ' ').toLowerCase()}</span>
                                    {item.category ? <span> / {item.category}</span> : null}
                                    {item.tourType ? <span> / {item.tourType}</span> : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 rounded-[20px] bg-slate-50 border border-slate-100 p-5 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Auto Review Collection</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically ask customers for a review after their trip completes.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={form.autoReviewCollectionEnabled}
                      onChange={(e) => update('autoReviewCollectionEnabled', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
                  </label>
                </div>
                
                {form.autoReviewCollectionEnabled && (
                   <div className="mt-4 pt-4 border-t border-slate-200">
                     <label className="block text-sm font-semibold text-slate-700">Days to wait after return date</label>
                     <div className="flex items-center mt-2 gap-2">
                       <input 
                         type="number" 
                         min="0" 
                         max="30" 
                         value={form.autoReviewDelayDays}
                         onChange={(e) => update('autoReviewDelayDays', e.target.value)}
                         className="shell-input-rect w-24"
                       />
                       <span className="text-sm text-slate-500">days</span>
                     </div>
                   </div>
                )}
              </div>

              <div className="col-span-1 md:col-span-2 rounded-[20px] bg-slate-50 border border-slate-100 p-5 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Agent Follow-up Reminders</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically send WhatsApp notifications to assigned agents before a scheduled follow-up.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={form.followUpReminderEnabled}
                      onChange={(e) => update('followUpReminderEnabled', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
                  </label>
                </div>
                
                {form.followUpReminderEnabled && (
                   <div className="mt-4 pt-4 border-t border-slate-200">
                     <label className="block text-sm font-semibold text-slate-700">Offset minutes</label>
                     <div className="flex items-center mt-2 gap-2">
                       <input 
                         type="number" 
                         min="0" 
                         max="1440" 
                         value={form.followUpReminderMinutes}
                         onChange={(e) => update('followUpReminderMinutes', e.target.value)}
                         className="shell-input-rect w-24"
                       />
                       <span className="text-sm text-slate-500">minutes before follow-up</span>
                     </div>
                   </div>
                )}
              </div>

              <Field label="WhatsApp number" hint="This updates automatically after your provider connection is approved.">
                <input value={whatsappNumber} disabled className="shell-input-rect cursor-not-allowed opacity-60" />
              </Field>

              <Field label="Plan">
                <div className="rounded-[20px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{agency?.plan || 'FREE'}</div>
              </Field>
            </div>
          </article>

        </div>

        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <PhoneIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">WhatsApp Connection</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">TravelBot uses Marketing OS as your Meta partner layer for channel onboarding and sync.</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className={`badge ${statusTone(connection?.status)}`}>{connection?.status || 'NOT_CONNECTED'}</span>
              <span className="badge bg-slate-100 text-slate-600">Provider: {connection?.provider || agency?.whatsappProvider || 'MARKETING_OS'}</span>
              {connection?.coexistence?.enabled ? (
                <span className="badge bg-emerald-100 text-emerald-700">Coexistence: {connection.coexistence.status}</span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4">
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Connected Number</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{whatsappNumber || 'Not assigned yet'}</p>
              </div>
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Meta Phone Number ID</p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{connection?.phoneNumberId || 'Waiting for provider sync'}</p>
              </div>
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Business App Sync</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Contacts: {connection?.coexistence?.contactSyncStatus || 'NOT_STARTED'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  History: {connection?.coexistence?.historySyncStatus || 'NOT_STARTED'}
                </p>
              </div>
              <div className="shell-panel-soft p-4">
                <p className="eyebrow">Meta Commerce Catalog ID</p>
                <p className="mt-2 text-xs text-slate-500 mb-2">Required for native WhatsApp e-commerce (product catalogs and cart checkout). Get this from Meta Commerce Manager.</p>
                <input 
                  value={form.whatsappCatalogId} 
                  onChange={(event) => update('whatsappCatalogId', event.target.value)} 
                  placeholder="e.g. 1029384756" 
                  className="shell-input-rect bg-white" 
                />
              </div>
            </div>

            {connection?.errorMessage ? (
              <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connection.errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => handleConnectWhatsApp('coexistence')} disabled={connectBusy} className="shell-button-primary">
                <LinkIcon className="h-4 w-4" />
                {connectBusy && connectMode === 'coexistence' ? 'Connecting...' : 'Connect Business App'}
              </button>
              <button type="button" onClick={() => handleConnectWhatsApp('standard')} disabled={connectBusy} className="shell-button-secondary">
                <LinkIcon className="h-4 w-4" />
                {connectBusy && connectMode === 'standard' ? 'Connecting...' : 'Connect Cloud API'}
              </button>
              <button
                type="button"
                onClick={() => whatsappConnectionQuery.refetch()}
                disabled={whatsappConnectionQuery.isFetching}
                className="shell-button-secondary"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                {whatsappConnectionQuery.isFetching ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
              Business App: use an existing WhatsApp Business app number with coexistence.
              <br />
              Cloud API: onboard a business phone number directly to the WhatsApp Cloud API.
              <br />
              Personal WhatsApp app numbers must be moved to WhatsApp Business or Cloud API before Meta can connect them.
            </div>
          </article>

          <article className="shell-panel p-6">
            <div className="flex items-center gap-3">
              <CameraIcon className="h-5 w-5 text-[#2d2d2d]" />
              <h2 className="text-xl font-extrabold text-slate-950">Instagram Connection</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">Connect your Instagram Professional accounts to sync DMs and comments directly into TravelBot.</p>

            <div className="mt-6">
              {instagramConnectionQuery.data?.accounts?.length > 0 ? (
                <div className="grid gap-4">
                  {instagramConnectionQuery.data.accounts.map(acc => (
                    <div key={acc.id} className="shell-panel-soft p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {acc.profilePictureUrl && <img src={acc.profilePictureUrl} alt="" className="w-10 h-10 rounded-full" />}
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{acc.name || acc.username}</p>
                          <p className="text-xs text-slate-500">@{acc.username}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        onClick={() => disconnectIgMutation.mutate(acc.id)}
                        disabled={disconnectIgMutation.isPending}
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">No Instagram accounts connected.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button 
                type="button" 
                onClick={handleConnectInstagram} 
                disabled={connectIgMutation.isPending} 
                className="shell-button-primary"
              >
                <LinkIcon className="h-4 w-4" />
                {connectIgMutation.isPending ? 'Connecting...' : 'Connect Instagram'}
              </button>
            </div>
          </article>


          <button type="submit" disabled={updateMutation.isPending} className="shell-button-primary w-full">
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {connectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white p-6 shadow-[0_34px_90px_-50px_rgba(15,23,42,0.55)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Connect WhatsApp</p>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                  {connectMode === 'coexistence' ? 'Business app coexistence' : 'Cloud API onboarding'}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {connectMode === 'coexistence'
                    ? 'Use this for an existing WhatsApp Business app number. We open the Meta popup and sync contacts and history after approval.'
                    : 'Use this for a business number that should be managed directly by WhatsApp Cloud API through Marketing OS.'}
                </p>
              </div>
              <button type="button" onClick={closeConnectModal} disabled={connectBusy} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'handshake',
                  title: 'Handshake with Marketing OS',
                  done: ['meta', 'sync', 'connected'].includes(connectFlowStep),
                  active: connectFlowStep === 'handshake',
                },
                {
                  key: 'meta',
                  title: connectMode === 'coexistence' ? 'Meta Business app connection' : 'Meta Cloud API connection',
                  done: ['sync', 'connected'].includes(connectFlowStep),
                  active: connectFlowStep === 'meta',
                },
                {
                  key: 'sync',
                  title: connectMode === 'coexistence' ? 'Sync contacts and history' : 'Save phone configuration',
                  done: connectFlowStep === 'connected',
                  active: connectFlowStep === 'sync',
                },
              ].map((item, index) => (
                <div key={item.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      item.done
                        ? 'bg-[#ebebeb] text-[#2d2d2d]'
                        : item.active
                          ? 'bg-[#f0f0f0] text-[#2d2d2d]'
                          : 'bg-white text-slate-500'
                    }`}>
                      {item.done ? <CheckCircleIcon className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.done ? 'Completed' : item.active ? 'In progress...' : 'Waiting'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {connectFlowStep === 'meta' ? (
              <div className="mt-4 rounded-[22px] border border-[#d4d4d4] bg-[#f5f5f5] px-4 py-3 text-sm text-[#2d2d2d]">
                {connectMode === 'coexistence'
                  ? 'Complete the Meta popup, then enter the verification code inside the WhatsApp Business app.'
                  : 'Complete the Meta popup and select the business phone number for Cloud API onboarding.'}
              </div>
            ) : null}

            {connectFlowStep === 'connected' ? (
              <div className="mt-4 rounded-[22px] border border-[#d4d4d4] bg-[#f5f5f5] px-4 py-3 text-sm text-[#2d2d2d]">
                {connectMode === 'coexistence'
                  ? 'WhatsApp Business app coexistence is active. Keep the app open while history finishes syncing.'
                  : 'WhatsApp Cloud API connection is active.'}
              </div>
            ) : null}

            {connectFlowStep === 'error' || connectFlowError ? (
              <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {connectFlowError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeConnectModal} disabled={connectBusy} className="shell-button-secondary flex-1">
                {connectFlowStep === 'connected' ? 'Close' : 'Cancel'}
              </button>
              {connectFlowStep === 'error' ? (
                <button type="button" onClick={() => handleConnectWhatsApp(connectMode)} className="shell-button-primary flex-1">
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
