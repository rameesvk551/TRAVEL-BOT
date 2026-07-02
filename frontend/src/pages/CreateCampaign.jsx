// FILE: /frontend/src/pages/CreateCampaign.jsx

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Check, Users, Calendar,
  Send, Search, Megaphone, RotateCcw, Sparkles, Gift,
  Clock, Filter, Eye, AlertTriangle, Upload, UserPlus,
  Package, Globe, Plane, ShieldCheck, FileSpreadsheet,
  Inbox, UserCheck, Star, ArrowLeft, Zap, Target,
  Home, Layers, Image, Video, Plus, X, ChevronDown, Type,
} from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, usePreviewAudience, useCampaign } from '../hooks/useCampaigns';
import { useFlows } from '../hooks/useFlows';
import { useAgencyTemplates, useCreateTemplate, useSubmitTemplate } from '../hooks/useTemplates';
import { templatesApi } from '../api/templatesApi';
import { packagesApi } from '../api/packagesApi';
import { campaignsApi } from '../api/campaignsApi';
import { propertiesApi } from '../api/propertiesApi';
import { TemplatePickerDrawer, ConfigDrawer, TemplatePickerContent, ConfigContent } from '../components/CampaignStep2Drawers';

// Heavy visual builder — only loaded when the user opens "Configure campaign flow".
const SettingsFlowBuilder = lazy(() => import('./settings/SettingsFlowBuilder'));

const CAMPAIGN_TYPES = [
  { value: 'BROADCAST', label: 'Broadcast', icon: Megaphone, desc: 'General announcement to all or filtered audiences', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'PROMOTIONAL', label: 'Promotional', icon: Gift, desc: 'Special offers, discounts, and deals', gradient: 'from-[#f5f5f5]0 to-[#404040]' },
  { value: 'REVIEW_COLLECTION', label: 'Review Collection', icon: Star, desc: 'Request trip reviews from past travelers', gradient: 'from-rose-500 to-pink-600' },
];

const AUDIENCE_MODES = [
  { value: 'all', label: 'All Clients', icon: Users, desc: 'Send to every customer in your database', gradient: 'from-blue-500 to-blue-600' },
  { value: 'package_bookers', label: 'Package Bookers', icon: Package, desc: 'Clients who booked a specific package', gradient: 'from-[#f5f5f5]0 to-[#404040]' },
  { value: 'package_enquirers', label: 'Package Enquiries', icon: Star, desc: 'Leads who enquired about a package but haven\'t booked', gradient: 'from-amber-500 to-amber-600' },
  { value: 'past_travelers', label: 'Past Travelers', icon: Plane, desc: 'Customers with confirmed/completed bookings', gradient: 'from-[#f0f0f0]0 to-[#404040]' },
  { value: 'leads_only', label: 'Active Leads', icon: Inbox, desc: 'Current pipeline leads (filter by status)', gradient: 'from-indigo-500 to-indigo-600' },
  { value: 'by_booking_status', label: 'By Booking Status', icon: ShieldCheck, desc: 'Pending, confirmed, or completed bookings', gradient: 'from-violet-500 to-violet-600' },
  { value: 'import', label: 'Import Contacts', icon: Upload, desc: 'Upload a CSV or paste phone numbers', gradient: 'from-rose-500 to-rose-600' },
  { value: 'advanced', label: 'Advanced Filters', icon: Filter, desc: 'Destination, budget, date range, source & more', gradient: 'from-slate-500 to-slate-600' },
];

const LEAD_STATUSES = [
  'JUST_CONTACTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING',
];

const BOOKING_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STEPS = [
  { label: 'Details', icon: Megaphone, desc: 'Name & type' },
  { label: 'Template', icon: Send, desc: 'Message content' },
  { label: 'Audience', icon: Users, desc: 'Who receives it' },
  { label: 'Schedule', icon: Calendar, desc: 'When to send' },
  { label: 'Review', icon: Eye, desc: 'Confirm & launch' },
];

const CAMPAIGN_FORMATS = [
  { value: 'STANDARD', label: 'Standard', desc: 'Send a normal template or text broadcast', icon: Megaphone },
  { value: 'SECTION_CTA', label: 'Section CTA', desc: 'Let customers choose packages, properties, or custom trip', icon: Layers },
  { value: 'ITEM_CAROUSEL', label: 'Carousel', desc: 'Send selected package/property cards with enquiry actions', icon: Package },
];

const MESSAGE_EXPERIENCES = [
  {
    id: 'CTA_MENU',
    label: 'CTA Menu',
    description: 'Show buttons for properties, packages, or custom trip.',
    format: 'SECTION_CTA',
    mediaMode: 'NONE',
    icon: Layers,
    group: 'message',
  },
  {
    id: 'IMAGE_CAROUSEL',
    label: 'Image Carousel',
    description: 'Show swipeable cards with image, description, and CTA.',
    format: 'ITEM_CAROUSEL',
    mediaMode: 'IMAGE',
    icon: Image,
    group: 'carousel',
  },
  {
    id: 'VIDEO_CAROUSEL',
    label: 'Video Carousel',
    description: 'Show swipeable cards with video, description, and CTA.',
    format: 'ITEM_CAROUSEL',
    mediaMode: 'VIDEO',
    icon: Video,
    group: 'carousel',
  },
];

const TOP_LEVEL_MODES = [
  {
    id: 'carousel',
    label: 'Carousel',
    description: 'Send swipeable property/package cards with See More & Enquiry buttons.',
    icon: Package,
    gradient: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'cta',
    label: 'CTA message',
    description: 'Send text, image, or video message with description and action buttons.',
    icon: Send,
    gradient: 'from-teal-500 to-cyan-600',
  },
];

const CTA_SECTION_TEMPLATES = [
  { key: 'packages', label: 'View Packages', itemType: 'PACKAGE', sortOrder: 1 },
  { key: 'properties', label: 'View Properties', itemType: 'PROPERTY', sortOrder: 2 },
  { key: 'custom_trip', label: 'Custom Trip', itemType: 'CUSTOM_TRIP', sortOrder: 3 },
];

const DEFAULT_CAMPAIGN_SECTIONS = CTA_SECTION_TEMPLATES.map((section) => ({
  ...section,
  filter: {},
  selectionMode: 'MANUAL',
  selectedItemIds: [],
  enabled: false,
}));

const createDefaultCampaignSections = () => DEFAULT_CAMPAIGN_SECTIONS.map((section) => ({
  ...section,
  filter: { ...(section.filter || {}) },
  selectedItemIds: [...(section.selectedItemIds || [])],
}));

const normalizeCampaignSections = (sections = []) => {
  const nextSections = createDefaultCampaignSections();
  const packageIds = new Set();
  let packageEnabled = false;
  let propertyEnabled = false;
  let customTripEnabled = false;
  let propertyIds = [];

  sections.forEach((section) => {
    if (section.itemType === 'PACKAGE' || section.key === 'international' || section.key === 'domestic' || section.key === 'packages') {
      packageEnabled = packageEnabled || !!section.enabled;
      (section.selectedItemIds || []).forEach((id) => packageIds.add(id));
    }
    if (section.itemType === 'PROPERTY' || section.key === 'properties') {
      propertyEnabled = propertyEnabled || !!section.enabled;
      propertyIds = [...new Set([...(propertyIds || []), ...((section.selectedItemIds || []))])];
    }
    if (section.itemType === 'CUSTOM_TRIP' || section.key === 'custom_trip') {
      customTripEnabled = customTripEnabled || !!section.enabled;
    }
  });

  return nextSections.map((section) => {
    if (section.key === 'packages') {
      return {
        ...section,
        enabled: packageEnabled,
        selectionMode: 'MANUAL',
        selectedItemIds: Array.from(packageIds),
      };
    }
    if (section.key === 'properties') {
      return {
        ...section,
        enabled: propertyEnabled,
        selectionMode: 'MANUAL',
        selectedItemIds: propertyIds,
      };
    }
    if (section.key === 'custom_trip') {
      return {
        ...section,
        enabled: customTripEnabled,
        selectionMode: 'MANUAL',
        selectedItemIds: [],
      };
    }
    return section;
  });
};

const PREBUILT_META_CAROUSEL_TEMPLATES = [
  {
    id: 'show_properties',
    name: 'Show Properties',
    badge: 'Image carousel',
    icon: Home,
    mediaMode: 'IMAGE',
    body: 'Hi {{name}}, here are handpicked stays for your next trip. Tap a card to check availability or ask for similar properties.',
    sections: ['properties', 'custom_trip'],
    cards: [
      { title: 'Premium Villa Stay', body: 'Private pool, kitchen, caretaker support, and family-friendly amenities.', mediaType: 'IMAGE', ctaLabel: 'Check Dates', secondaryCtaLabel: 'Show Properties', ctaAction: 'SHOW_PROPERTIES' },
      { title: 'Boutique Resort', body: 'Scenic resort option with breakfast, transfers, and curated local experiences.', mediaType: 'IMAGE', ctaLabel: 'View Stay', secondaryCtaLabel: 'Custom Trip', ctaAction: 'SHOW_PROPERTIES' },
    ],
  },
  {
    id: 'international_packages',
    name: 'International Packages',
    badge: 'Image carousel',
    icon: Globe,
    mediaMode: 'IMAGE',
    body: 'Hi {{name}}, explore our best international holiday picks. Choose a package and we will share flights, hotels, and full pricing.',
    sections: ['international', 'custom_trip'],
    cards: [
      { title: 'Dubai City Break', body: 'Flights, 4-star stay, desert safari, city tour, and visa assistance included.', mediaType: 'IMAGE', ctaLabel: 'Get Quote', secondaryCtaLabel: 'More Intl', ctaAction: 'SHOW_INTERNATIONAL_PACKAGES' },
      { title: 'Bali Escape', body: 'Beach resort, transfers, island tour, and romantic add-ons for couples.', mediaType: 'IMAGE', ctaLabel: 'See Package', secondaryCtaLabel: 'Custom Trip', ctaAction: 'SHOW_INTERNATIONAL_PACKAGES' },
    ],
  },
  {
    id: 'domestic_packages',
    name: 'Domestic Packages',
    badge: 'Image carousel',
    icon: Plane,
    mediaMode: 'IMAGE',
    body: 'Hi {{name}}, these domestic getaways are ready for quick booking. Pick one and we will send itinerary, inclusions, and price.',
    sections: ['domestic', 'properties', 'custom_trip'],
    cards: [
      { title: 'Kerala Backwaters', body: 'Houseboat, Munnar, Alleppey, private cab, and hotel stays in one plan.', mediaType: 'IMAGE', ctaLabel: 'Send Details', secondaryCtaLabel: 'More India', ctaAction: 'SHOW_DOMESTIC_PACKAGES' },
      { title: 'Himachal Adventure', body: 'Manali, Solang, sightseeing, transfers, and stays for families or groups.', mediaType: 'IMAGE', ctaLabel: 'Get Price', secondaryCtaLabel: 'Custom Trip', ctaAction: 'SHOW_DOMESTIC_PACKAGES' },
    ],
  },
  {
    id: 'custom_trip',
    name: 'Custom Trip',
    badge: 'Video carousel',
    icon: UserPlus,
    mediaMode: 'VIDEO',
    body: 'Hi {{name}}, want a trip built around your dates, budget, and style? Share your preferences and our team will create a custom plan.',
    sections: ['custom_trip', 'international', 'domestic'],
    cards: [
      { title: 'Plan From Scratch', body: 'Tell us destination, dates, travellers, hotel preference, and budget range.', mediaType: 'VIDEO', ctaLabel: 'Custom Trip', secondaryCtaLabel: 'Call Expert', ctaAction: 'CUSTOM_TRIP' },
      { title: 'Upgrade Existing Plan', body: 'Already shortlisted places? We can optimize hotels, route, activities, and cost.', mediaType: 'VIDEO', ctaLabel: 'Plan My Trip', secondaryCtaLabel: 'Show Deals', ctaAction: 'CUSTOM_TRIP' },
    ],
  },
  {
    id: 'travel_scenario_mix',
    name: 'Travel Desk Mix',
    badge: 'Mixed carousel',
    icon: Layers,
    mediaMode: 'MIXED',
    body: 'Hi {{name}}, choose what you want to explore today. We can show stays, international deals, domestic packages, or build a custom trip.',
    sections: ['properties', 'international', 'domestic', 'custom_trip'],
    cards: [
      { title: 'Browse Properties', body: 'Resorts, villas, apartments, and hotels matched to your dates.', mediaType: 'IMAGE', ctaLabel: 'Show Properties', secondaryCtaLabel: 'Custom Trip', ctaAction: 'SHOW_PROPERTIES' },
      { title: 'International Deals', body: 'Curated overseas packages with visa, flights, hotel, and activities.', mediaType: 'IMAGE', ctaLabel: 'International', secondaryCtaLabel: 'Get Quote', ctaAction: 'SHOW_INTERNATIONAL_PACKAGES' },
      { title: 'Domestic Packages', body: 'India holiday plans with stays, transfers, sightseeing, and support.', mediaType: 'VIDEO', ctaLabel: 'Domestic', secondaryCtaLabel: 'Plan Trip', ctaAction: 'SHOW_DOMESTIC_PACKAGES' },
    ],
  },
];

const PREBUILT_META_MESSAGE_TEMPLATES = [
  {
    id: 'image_message_trips_properties',
    name: 'Image + Description + CTA',
    badge: 'Image message',
    icon: Image,
    mediaType: 'IMAGE',
    body: 'Hi {{name}}, we have fresh travel options ready for you. Tap below to enquire, see more trips, or browse properties.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Enquiry' },
      { type: 'QUICK_REPLY', text: 'Show Another Trips' },
      { type: 'QUICK_REPLY', text: 'Show Properties' },
    ],
  },
  {
    id: 'video_message_trips_properties',
    name: 'Video + Description + CTA',
    badge: 'Video message',
    icon: Video,
    mediaType: 'VIDEO',
    body: 'Hi {{name}}, watch this featured trip update and choose what you want next. We can share more trips or matching properties instantly.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Enquiry' },
      { type: 'QUICK_REPLY', text: 'Show Another Trips' },
      { type: 'QUICK_REPLY', text: 'Show Properties' },
    ],
  },
];

const normalizeTemplateType = (template) => String(template?.templateType || '').toUpperCase();
const normalizeHeaderType = (template) => String(template?.headerType || '').toUpperCase();

const getTemplateMediaMode = (template) => {
  if (!template) return 'NONE';

  if (normalizeTemplateType(template) === 'CAROUSEL') {
    const firstCard = Array.isArray(template.carouselCards) ? template.carouselCards[0] : null;
    return String(firstCard?.mediaType || 'IMAGE').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'IMAGE';
  }

  const headerType = normalizeHeaderType(template);
  if (headerType === 'IMAGE') return 'IMAGE';
  if (headerType === 'VIDEO') return 'VIDEO';
  return 'NONE';
};

const getMediaModeLabel = (mediaMode) => (
  String(mediaMode || 'NONE').toUpperCase() === 'NONE'
    ? 'TEXT'
    : String(mediaMode || 'NONE').toUpperCase()
);

const getCatalogItemMediaUrl = (item) => String(item?.imageUrl || item?.coverImageUrl || item?.mediaUrl || '').trim();

const getCatalogItemSubtitle = (item) => (
  item?.itemType === 'PACKAGE'
    ? (item?.destinations || []).join(', ') || item?.category || 'Package'
    : item?.location || item?.propertyType || 'Property'
);

const renderTemplatePreviewText = (text, campaignDescription = '') => String(text || '')
  .replace(/{{\s*1\s*}}/g, 'Rahul')
  .replace(/{{\s*2\s*}}/g, campaignDescription || 'Add campaign description')
  .replace(/{{\s*3\s*}}/g, 'Featured trip')
  .replace(/{{\s*4\s*}}/g, 'Wayon Travels')
  .replace(/{{name}}/gi, 'Rahul');

const buildCarouselPreviewCards = (selectedItems = [], templateCards = [], mediaType = 'IMAGE') => {
  if (!selectedItems.length) {
    return (templateCards || []).slice(0, 4);
  }

  const fallbackTemplateCard = Array.isArray(templateCards) && templateCards.length > 0
    ? templateCards[templateCards.length - 1]
    : null;

  return selectedItems.slice(0, 10).map((item, index) => {
    const templateCard = templateCards[index] || fallbackTemplateCard || {};
    const imageUrl = getCatalogItemMediaUrl(item);

    return {
      ...templateCard,
      id: item.id || `${item.itemType}-${index + 1}`,
      itemType: item.itemType,
      title: item.name || templateCard.title || `Card ${index + 1}`,
      body: templateCard.body || getCatalogItemSubtitle(item),
      mediaType: String(templateCard.mediaType || mediaType || 'IMAGE').toUpperCase(),
      mediaUrl: imageUrl,
      imageUrl,
      buttons: Array.isArray(templateCard.buttons) && templateCard.buttons.length > 0 ? templateCard.buttons : [{ text: 'Enquiry' }],
    };
  });
};

const isApprovedTemplateCompatible = (template, builderMode) => {
  if (!template || template.status !== 'APPROVED') return false;

  const templateType = normalizeTemplateType(template);

  if (builderMode === 'carousel') {
    return templateType === 'CAROUSEL' && Array.isArray(template.carouselCards) && template.carouselCards.length >= 2;
  }

  return templateType !== 'CAROUSEL';
};

const isTemplateMediaCompatible = (template, builderMode, mediaType) => {
  if (!isApprovedTemplateCompatible(template, builderMode)) return false;
  if (!mediaType) return true;
  return getTemplateMediaMode(template) === String(mediaType).toUpperCase();
};

const CTA_BUTTON_ACTIONS = [
  { value: 'VIEW_PACKAGES', label: 'Package selection', itemTypes: ['PACKAGE'] },
  { value: 'VIEW_PROPERTIES', label: 'Property selection', itemTypes: ['PROPERTY'] },
  { value: 'CUSTOM_TRIP', label: 'Custom trip flow', itemTypes: [] },
  { value: 'VIEW_DETAILS', label: 'View details', itemTypes: ['PACKAGE', 'PROPERTY'] },
  { value: 'SEND_ITINERARY', label: 'Send itinerary', itemTypes: ['PACKAGE'] },
  { value: 'CHECK_AVAILABILITY', label: 'Check availability', itemTypes: ['PACKAGE'] },
  { value: 'TALK_TO_AGENT', label: 'WhatsApp / talk to agent', itemTypes: ['PACKAGE'] },
  { value: 'OPEN_FLOW', label: 'Open a WhatsApp flow', itemTypes: [] },
  { value: 'OPEN_URL', label: 'Open a link / URL', itemTypes: [] },
];

const CTA_BUTTON_ACTION_LABELS = CTA_BUTTON_ACTIONS.reduce((acc, action) => {
  acc[action.value] = action.label;
  return acc;
}, {});

// WhatsApp/Meta caps header videos at 16 MB.
const MAX_HEADER_VIDEO_BYTES = 16 * 1024 * 1024;

const normalizeButtonTextKey = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '_')
  .replace(/^_+|_+$/g, '');

const getButtonActionKey = (button, index) => `${normalizeButtonTextKey(button?.text || button?.title || `button_${index + 1}`)}:${index}`;

const getTemplateQuickReplyButtons = (template) => (
  Array.isArray(template?.buttons)
    ? template.buttons.filter((button) => String(button.type || 'QUICK_REPLY').toUpperCase() === 'QUICK_REPLY' && String(button.text || button.title || '').trim())
    : []
);

const getTemplateProviderButtons = (template) => (
  Array.isArray(template?.buttons)
    ? template.buttons.filter((button) => String(button.type || 'QUICK_REPLY').toUpperCase() !== 'QUICK_REPLY')
    : []
);

const getSectionKeyForButtonAction = (action, itemType) => {
  if (action === 'VIEW_PROPERTIES' || itemType === 'PROPERTY') return 'properties';
  if (action === 'CUSTOM_TRIP') return 'custom_trip';
  if (['VIEW_PACKAGES', 'VIEW_DETAILS', 'SEND_ITINERARY', 'CHECK_AVAILABILITY', 'TALK_TO_AGENT'].includes(action)) return 'packages';
  return null;
};

const buildDefaultButtonActions = (buttons = [], existing = {}) => buttons.reduce((acc, button, index) => {
  const key = getButtonActionKey(button, index);
  acc[key] = {
    buttonKey: key,
    buttonText: String(button.text || button.title || `Button ${index + 1}`).trim(),
    buttonIndex: index,
    action: existing[key]?.action || '',
    itemType: existing[key]?.itemType || null,
    itemId: existing[key]?.itemId || null,
    flowId: existing[key]?.flowId || null,
    url: existing[key]?.url || '',
  };
  return acc;
}, {});

const getDuplicateQuickReplyLabels = (buttons = []) => {
  const seen = new Set();
  const duplicates = new Set();
  buttons.forEach((button) => {
    const text = normalizeButtonTextKey(button.text || button.title);
    if (!text) return;
    if (seen.has(text)) duplicates.add(text);
    seen.add(text);
  });
  return Array.from(duplicates);
};

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();

  // If editing, fetch the campaign
  const { data: editData } = useCampaign(editId);
  const editCampaign = editData?.data || null;
  const isEdit = !!editId;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    type: 'BROADCAST',
    templateId: null,
    messageBody: '',
    audienceFilter: {},
    scheduledAt: null,
    scheduleMode: 'now',
    linkedPackageIds: [],
    format: 'SECTION_CTA',
    mediaType: 'NONE',
    mediaUrl: '',
    campaignSections: createDefaultCampaignSections(),
    carouselConfig: { contentType: 'MIXED', items: [] },
    ctaConfig: {},
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [audienceCount, setAudienceCount] = useState(null);
  const [sending, setSending] = useState(false);

  // Audience mode state
  const [audienceMode, setAudienceMode] = useState('all');
  const [packages, setPackages] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedBookingStatus, setSelectedBookingStatus] = useState('CONFIRMED');
  const [selectedLeadStatuses, setSelectedLeadStatuses] = useState([]);
  const [importedIds, setImportedIds] = useState([]);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState(''); // '' | 'importing' | 'done' | 'error'
  const [importCount, setImportCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [prebuiltPreviewId, setPrebuiltPreviewId] = useState('show_properties');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [campaignFlowBuilderOpen, setCampaignFlowBuilderOpen] = useState(false);
  const [campaignFlowSeed, setCampaignFlowSeed] = useState(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [headerMediaUploading, setHeaderMediaUploading] = useState(false);
  const [headerMediaUploadError, setHeaderMediaUploadError] = useState('');
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const fileInputRef = useRef(null);
  const headerMediaInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit && searchParams.get('audience') === 'import') {
      setAudienceMode('import');
    }
  }, [isEdit, searchParams]);

  // Load edit data when available
  useEffect(() => {
    if (editCampaign) {
      setFormData({
        name: editCampaign.name || '',
        type: editCampaign.type || 'BROADCAST',
        templateId: editCampaign.templateId || null,
        messageBody: editCampaign.messageBody || '',
        audienceFilter: editCampaign.audienceFilter || {},
        scheduledAt: editCampaign.scheduledAt || null,
        scheduleMode: editCampaign.scheduledAt ? 'scheduled' : 'now',
        linkedPackageIds: editCampaign.linkedPackageIds || [],
        format: editCampaign.format === 'ITEM_CAROUSEL' ? 'ITEM_CAROUSEL' : 'SECTION_CTA',
        mediaType: editCampaign.mediaType === 'VIDEO' ? 'VIDEO' : editCampaign.mediaType === 'IMAGE' ? 'IMAGE' : 'NONE',
        mediaUrl: editCampaign.mediaUrl || '',
        campaignSections: normalizeCampaignSections(editCampaign.campaignSections),
        carouselConfig: {
          contentType: editCampaign.carouselConfig?.contentType || 'MIXED',
          mediaMode: editCampaign.carouselConfig?.mediaMode || (editCampaign.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE'),
          items: editCampaign.carouselConfig?.items || [],
        },
        ctaConfig: editCampaign.ctaConfig || {},
      });
    }
  }, [editCampaign]);

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const previewMutation = usePreviewAudience();
  const createTemplateMutation = useCreateTemplate();
  const submitTemplateMutation = useSubmitTemplate();
  const { data: agencyTemplates } = useAgencyTemplates();

  const approvedTemplates = (agencyTemplates?.data || []).filter((template) => template.status === 'APPROVED');

  // Auto-select specialized template for Review Collection
  useEffect(() => {
    if (formData.type === 'REVIEW_COLLECTION' && approvedTemplates.length > 0 && !formData.templateId) {
      const reviewTemplate = approvedTemplates.find(t =>
        t.name === 'review_collection_campaign'
        || t.name === 'review_request'
        || t.displayName === 'Automated Review Collection'
        || t.displayName === 'Review Request'
        || (t.tags || []).some((tag) => ['review', 'feedback', 'post-trip'].includes(tag))
      );
      if (reviewTemplate) {
        setFormData(prev => ({ ...prev, templateId: reviewTemplate.id, messageBody: '' }));
        setSelectedTemplate(reviewTemplate);
      }
    }
  }, [formData.type, approvedTemplates.length]);

  const filteredTemplates = approvedTemplates.filter((t) =>
    (t.displayName || t.name || '').toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Load packages list
  useEffect(() => {
    packagesApi.list().then((res) => {
      setPackages(res?.data || []);
    }).catch(() => {});
    propertiesApi.list().then((res) => {
      setProperties(res?.data || []);
    }).catch(() => {});
  }, []);

  // Build audience filter from mode selections
  const buildFilterFromMode = useCallback(() => {
    const filter = { ...formData.audienceFilter };

    if (audienceMode === 'all') {
      delete filter.customerType;
      delete filter.packageId;
      delete filter.bookingStatus;
      delete filter.leadStatus;
      delete filter.manualCustomerIds;
    } else if (audienceMode === 'package_bookers') {
      filter.customerType = 'package_bookers';
      filter.packageId = selectedPackageId;
    } else if (audienceMode === 'package_enquirers') {
      filter.customerType = 'package_enquirers';
      filter.packageId = selectedPackageId;
    } else if (audienceMode === 'past_travelers') {
      filter.customerType = 'past_travelers';
      if (selectedPackageId) filter.packageId = selectedPackageId;
    } else if (audienceMode === 'leads_only') {
      filter.customerType = 'leads_only';
      if (selectedLeadStatuses.length > 0) filter.statuses = selectedLeadStatuses;
      if (selectedPackageId) filter.packageId = selectedPackageId;
    } else if (audienceMode === 'by_booking_status') {
      filter.customerType = 'by_booking_status';
      filter.bookingStatus = selectedBookingStatus;
    } else if (audienceMode === 'import') {
      filter.manualCustomerIds = importedIds;
    }

    return filter;
  }, [audienceMode, selectedPackageId, selectedBookingStatus, selectedLeadStatuses, importedIds, formData.audienceFilter]);

  // Refresh audience count
  const refreshAudience = useCallback(() => {
    const filter = buildFilterFromMode();
    setFormData((prev) => ({ ...prev, audienceFilter: filter }));
    previewMutation.mutate(filter, {
      onSuccess: (res) => setAudienceCount(res?.data?.count ?? 0),
    });
  }, [buildFilterFromMode]);

  useEffect(() => {
    if (step === 2) refreshAudience();
  }, [step, audienceMode, selectedPackageId, selectedBookingStatus, selectedLeadStatuses, importedIds.length]);

  const updateAdvancedFilter = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      audienceFilter: { ...prev.audienceFilter, [key]: value || undefined },
    }));
  };

  // CSV file import handler
  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setImportText(text);
      processImportText(text);
    };
    reader.readAsText(file);
  };

  // Process pasted/uploaded contacts
  const processImportText = async (text) => {
    setImportStatus('importing');
    try {
      const lines = text.split(/[\n\r]+/).filter(Boolean);
      const contacts = [];

      for (const line of lines) {
        const parts = line.split(/[,\t;]+/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length === 0) continue;

        const first = parts[0];
        if (/^(name|phone|mobile|number|contact)/i.test(first)) continue;

        if (parts.length === 1) {
          const phone = normalizePhone(parts[0]);
          if (phone) contacts.push({ phone });
        } else {
          const phoneCandidate = normalizePhone(parts[1]) || normalizePhone(parts[0]);
          const nameCandidate = /^\d/.test(parts[0]) ? parts[1] : parts[0];
          if (phoneCandidate) contacts.push({ name: nameCandidate, phone: phoneCandidate });
        }
      }

      if (contacts.length === 0) {
        setImportStatus('error');
        return;
      }

      const result = await campaignsApi.importContacts(contacts);
      setImportedIds(result?.data?.customerIds || []);
      setImportCount(result?.data?.count || 0);
      setImportStatus('done');
    } catch (err) {
      console.error('Import error:', err);
      setImportStatus('error');
    }
  };

  function normalizePhone(str) {
    if (!str) return null;
    const digits = str.replace(/[^\d+]/g, '');
    if (digits.length >= 10) return digits.startsWith('+') ? digits : `+91${digits.slice(-10)}`;
    return null;
  }

  const activeSections = (formData.campaignSections || []).filter((section) => section.enabled);
  const carouselItems = formData.carouselConfig?.items || [];
  const builderMode = formData.format === 'ITEM_CAROUSEL' ? 'carousel' : 'cta';
  const currentExperienceId = formData.format === 'SECTION_CTA'
    ? 'CTA_MENU'
    : formData.format === 'ITEM_CAROUSEL' && formData.carouselConfig?.mediaMode === 'VIDEO'
      ? 'VIDEO_CAROUSEL'
      : formData.format === 'ITEM_CAROUSEL'
        ? 'IMAGE_CAROUSEL'
        : 'CTA_MENU';
  const currentExperience = MESSAGE_EXPERIENCES.find((experience) => experience.id === currentExperienceId) || MESSAGE_EXPERIENCES[0];
  const activePackages = packages.filter((pkg) => pkg.isActive !== false);
  const activeProperties = properties.filter((property) => property.isActive !== false);
  const ctaTemplateButtons = builderMode === 'cta' ? getTemplateQuickReplyButtons(selectedTemplate) : [];
  const ctaProviderButtons = builderMode === 'cta' ? getTemplateProviderButtons(selectedTemplate) : [];
  const duplicateCtaButtonLabels = getDuplicateQuickReplyLabels(ctaTemplateButtons);
  const hasTemplateButtonActions = ctaTemplateButtons.length > 0;
  const rawCtaButtonActions = formData.ctaConfig?.buttonActions || {};
  const ctaButtonActions = hasTemplateButtonActions
    ? buildDefaultButtonActions(ctaTemplateButtons, rawCtaButtonActions)
    : rawCtaButtonActions;

  // Published WhatsApp flows the agency can bind to a button via the OPEN_FLOW action.
  const { data: flowsData } = useFlows({});
  const ctaFlowOptions = (flowsData?.data || [])
    .filter((flow) => String(flow.status || '').toUpperCase() === 'PUBLISHED' && flow.metaFlowId)
    .map((flow) => ({ id: flow.id, name: flow.name || 'Untitled flow', flowType: flow.flowType }));

  const getSectionByKey = useCallback(
    (key) => (formData.campaignSections || []).find((section) => section.key === key) || createDefaultCampaignSections().find((section) => section.key === key),
    [formData.campaignSections]
  );

  const selectedPackagesForSection = (section) => activePackages.filter((pkg) => (section?.selectedItemIds || []).includes(pkg.id));
  const selectedPropertiesForSection = (section) => activeProperties.filter((property) => (section?.selectedItemIds || []).includes(property.id));
  const isAutoSection = (section) => String(section?.selectionMode || '').toUpperCase() !== 'MANUAL';
  const sectionHasCatalogItems = (section) => {
    if (!section) return false;
    if ((section.selectedItemIds || []).length > 0) return true;
    if (!isAutoSection(section)) return false;
    if (section.itemType === 'PACKAGE') return activePackages.length > 0;
    if (section.itemType === 'PROPERTY') return activeProperties.length > 0;
    return false;
  };

  const selectMessageExperience = (experience) => {
    setFormData((prev) => {
      return {
        ...prev,
        format: experience.format,
        mediaType: experience.mediaMode || 'NONE',
        carouselConfig: {
          ...(prev.carouselConfig || {}),
          mediaMode: experience.mediaMode,
        },
      };
    });
  };

  const updateSection = (key, updates) => {
    setFormData((prev) => ({
      ...prev,
      campaignSections: (prev.campaignSections || createDefaultCampaignSections()).map((section) =>
        section.key === key ? { ...section, ...updates } : section
      ),
    }));
  };

  const toggleSectionItem = (key, itemId) => {
    const section = getSectionByKey(key);
    const selectedIds = section?.selectedItemIds || [];
    const nextSelectedIds = selectedIds.includes(itemId)
      ? selectedIds.filter((id) => id !== itemId)
      : [...selectedIds, itemId];

    updateSection(key, {
      selectionMode: nextSelectedIds.length > 0 ? 'MANUAL' : 'AUTO',
      selectedItemIds: nextSelectedIds,
    });
  };

  // Open ONE flow builder for the whole campaign, seeded with a starter node per
  // template button. Each button is bound to the shared flow + its own entry node,
  // so tapping it on WhatsApp enters the flow at that node.
  const configureCampaignFlow = () => {
    const buttons = ctaTemplateButtons;
    if (!buttons.length) return;
    const existingFlowId = formData.ctaConfig?.flowGraphId;
    const flowId = existingFlowId || `campaign_flow_${Date.now()}`;

    setFormData((prev) => {
      const currentActions = prev.ctaConfig?.buttonActions || {};
      const nextActions = { ...currentActions };
      buttons.forEach((button, index) => {
        const key = getButtonActionKey(button, index);
        nextActions[key] = {
          ...(currentActions[key] || {}),
          buttonKey: key,
          buttonText: String(button.text || button.title || `Button ${index + 1}`).trim(),
          buttonIndex: index,
          action: 'OPEN_FLOW',
          flowKind: 'GRAPH',
          flowId,
          entryNodeId: `entry_${index + 1}`,
          itemType: null,
          itemId: null,
          url: '',
        };
      });
      return {
        ...prev,
        ctaConfig: { ...(prev.ctaConfig || {}), flowGraphId: flowId, buttonActions: nextActions },
      };
    });

    setCampaignFlowSeed({
      flowId,
      buttons: buttons.map((button, index) => ({
        label: String(button.text || button.title || `Button ${index + 1}`).trim(),
        nodeId: `entry_${index + 1}`,
      })),
    });
    setCampaignFlowBuilderOpen(true);
  };

  // Free-form UPLOAD carousel cards (no catalog needed).
  const carouselMode = formData.carouselConfig?.mode || 'CATALOG';
  const setCarouselMode = (mode) => setFormData((prev) => ({ ...prev, carouselConfig: { ...(prev.carouselConfig || {}), mode } }));
  // Buttons every carousel card carries come ONLY from the approved template's card
  // buttons. WhatsApp buttons must be template-defined, so if the template has none
  // there are no buttons and no flow to configure. The agency doesn't add buttons.
  const carouselTemplateButtonLabels = (() => {
    const tplCards = selectedTemplate?.carouselCards;
    return (Array.isArray(tplCards) && Array.isArray(tplCards[0]?.buttons) ? tplCards[0].buttons : [])
      .map((b) => String(b.text || b.title || '').trim()).filter(Boolean).slice(0, 3);
  })();
  const carouselHasButtons = carouselTemplateButtonLabels.length > 0;
  const carouselDefaultButtons = () => carouselTemplateButtonLabels.map((label, i) => ({ buttonKey: `btn_${i + 1}`, buttonText: label }));
  const addUploadCard = () => setFormData((prev) => {
    const cards = Array.isArray(prev.carouselConfig?.cards) ? prev.carouselConfig.cards : [];
    if (cards.length >= 10) return prev;
    const id = `card_${Date.now()}_${cards.length + 1}`;
    const mediaType = (prev.carouselConfig?.mediaMode || prev.mediaType) === 'VIDEO' ? 'VIDEO' : 'IMAGE';
    return { ...prev, carouselConfig: { ...(prev.carouselConfig || {}), mode: 'UPLOAD', cards: [...cards, { id, mediaUrl: '', mediaName: '', mediaType, title: '', body: '', keyword: '', buttons: carouselDefaultButtons() }] } };
  });
  const updateUploadCard = (id, updates) => setFormData((prev) => ({
    ...prev,
    carouselConfig: { ...(prev.carouselConfig || {}), cards: (prev.carouselConfig?.cards || []).map((c) => (c.id === id ? { ...c, ...updates } : c)) },
  }));
  // Bulk upload: pick several images/videos at once → one card per file.
  const addUploadCardsFromFiles = async (files) => {
    const list = Array.from(files || []);
    const mediaType = (formData.carouselConfig?.mediaMode || formData.mediaType) === 'VIDEO' ? 'VIDEO' : 'IMAGE';
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      try {
        const res = await templatesApi.uploadMedia(file);
        const url = res?.data?.url;
        if (!url) continue;
        // eslint-disable-next-line no-loop-func
        setFormData((prev) => {
          const cards = Array.isArray(prev.carouselConfig?.cards) ? prev.carouselConfig.cards : [];
          if (cards.length >= 10) return prev;
          const id = `card_${Date.now()}_${cards.length + 1}_${Math.round(Math.random() * 1e4)}`;
          return { ...prev, carouselConfig: { ...(prev.carouselConfig || {}), mode: 'UPLOAD', cards: [...cards, { id, mediaUrl: url, mediaName: file.name, mediaType, title: '', body: '', keyword: '', buttons: carouselDefaultButtons() }] } };
        });
      } catch (err) { /* skip a failed file, keep going */ }
    }
  };
  // Keep every upload card's buttons in sync with the approved template's buttons.
  useEffect(() => {
    if (carouselMode !== 'UPLOAD') return;
    const cards = formData.carouselConfig?.cards;
    if (!Array.isArray(cards) || cards.length === 0) return;
    const desired = carouselTemplateButtonLabels;
    const needsSync = cards.some((c) => {
      const b = Array.isArray(c.buttons) ? c.buttons : [];
      return b.length !== desired.length || b.some((x, i) => String(x.buttonText || '') !== desired[i]);
    });
    if (!needsSync) return;
    setFormData((prev) => ({
      ...prev,
      carouselConfig: {
        ...(prev.carouselConfig || {}),
        cards: (prev.carouselConfig?.cards || []).map((c) => ({
          ...c,
          buttons: desired.map((label, i) => ({ ...((Array.isArray(c.buttons) && c.buttons[i]) || {}), buttonKey: `btn_${i + 1}`, buttonText: label })),
        })),
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselMode, selectedTemplate?.id]);

  const removeUploadCard = (id) => setFormData((prev) => ({
    ...prev,
    carouselConfig: { ...(prev.carouselConfig || {}), cards: (prev.carouselConfig?.cards || []).filter((c) => c.id !== id) },
  }));

  // Carousel: ONE shared flow with a starter node per button slot. Every card's
  // button[i] binds to the same flow + entry node `entry_{i+1}`. At runtime the
  // tapped card's item + keyword are seeded into the flow, so replies always know
  // which card the customer came from.
  const configureCarouselFlow = () => {
    const mode = formData.carouselConfig?.mode || 'CATALOG';
    let cards = formData.carouselConfig?.cards || [];
    // Catalog mode: cards are created lazily, so seed them from the selected items
    // if the agency hasn't touched a card yet.
    if (mode !== 'UPLOAD' && cards.length === 0) {
      cards = selectedCarouselRecords.map((record) => ({ id: record.id, itemId: record.id, itemType: record.itemType, buttons: [] }));
    }
    if (cards.length === 0) return;
    // If no card has buttons yet, give every card one default button so the flow
    // still seeds with a starter node (matches the CTA "Configure flow" behaviour).
    const existingMax = cards.reduce((max, card) => Math.max(max, Array.isArray(card.buttons) ? card.buttons.length : 0), 0);
    const ensureDefault = existingMax === 0;
    const maxButtons = ensureDefault ? 1 : existingMax;
    const flowId = formData.carouselConfig?.flowGraphId || `carousel_flow_${Date.now()}`;
    const slotLabels = Array.from({ length: maxButtons }, (_, i) => {
      const card = cards.find((c) => Array.isArray(c.buttons) && String(c.buttons[i]?.buttonText || '').trim());
      return String(card?.buttons[i]?.buttonText || (i === 0 ? 'Learn more' : `Button ${i + 1}`)).trim();
    });

    setFormData((prev) => {
      const nextCards = cards.map((card) => {
        const base = (Array.isArray(card.buttons) && card.buttons.length) ? card.buttons : (ensureDefault ? [{ buttonText: 'Learn more' }] : []);
        return {
          ...card,
          buttons: base.map((btn, i) => ({
            ...btn,
            buttonKey: `btn_${i + 1}`,
            buttonText: String(btn.buttonText || slotLabels[i] || `Button ${i + 1}`).trim(),
            action: 'OPEN_FLOW',
            flowKind: 'GRAPH',
            flowId,
            entryNodeId: `entry_${i + 1}`,
          })),
        };
      });
      return { ...prev, carouselConfig: { ...(prev.carouselConfig || {}), flowGraphId: flowId, cards: nextCards } };
    });

    setCampaignFlowSeed({ flowId, buttons: slotLabels.map((label, i) => ({ label, nodeId: `entry_${i + 1}` })) });
    setCampaignFlowBuilderOpen(true);
  };

  const updateButtonAction = (button, index, updates = {}) => {
    const key = getButtonActionKey(button, index);
    setFormData((prev) => {
      const currentActions = prev.ctaConfig?.buttonActions || {};
      const existing = currentActions[key] || buildDefaultButtonActions([button], {})[getButtonActionKey(button, 0)] || {};
      const nextAction = {
        ...existing,
        buttonKey: key,
        buttonText: String(button.text || button.title || `Button ${index + 1}`).trim(),
        buttonIndex: index,
        ...updates,
      };

      const allowedItemTypes = CTA_BUTTON_ACTIONS.find((action) => action.value === nextAction.action)?.itemTypes || [];
      if (allowedItemTypes.length === 0) {
        nextAction.itemType = null;
        nextAction.itemId = null;
      } else if (nextAction.itemType && !allowedItemTypes.includes(nextAction.itemType)) {
        nextAction.itemType = allowedItemTypes[0] || null;
        nextAction.itemId = null;
      } else if (!nextAction.itemType && nextAction.itemId) {
        nextAction.itemType = allowedItemTypes[0] || null;
      }

      // Targets are mutually exclusive per action type.
      if (nextAction.action !== 'OPEN_FLOW') {
        nextAction.flowId = null;
        nextAction.flowKind = null;
        nextAction.keyword = null;
      }
      if (nextAction.action !== 'OPEN_URL') nextAction.url = '';

      const sectionKey = getSectionKeyForButtonAction(nextAction.action, nextAction.itemType);

      const nextSections = ((prev.campaignSections || []).length ? prev.campaignSections : createDefaultCampaignSections()).map((section) => {
        if (section.key !== sectionKey) return section;
        const selectedItemIds = nextAction.itemId && ['PACKAGE', 'PROPERTY'].includes(nextAction.itemType)
          ? Array.from(new Set([...(section.selectedItemIds || []), nextAction.itemId]))
          : section.selectedItemIds || [];
        return {
          ...section,
          enabled: true,
          selectionMode: selectedItemIds.length > 0 ? 'MANUAL' : 'AUTO',
          selectedItemIds: section.itemType === 'CUSTOM_TRIP' ? [] : selectedItemIds,
        };
      });

      return {
        ...prev,
        campaignSections: nextSections,
        ctaConfig: {
          ...(prev.ctaConfig || {}),
          buttonActions: {
            ...currentActions,
            [key]: nextAction,
          },
        },
      };
    });
  };

  const toggleCarouselItem = (itemType, itemId) => {
    setFormData((prev) => {
      const current = prev.carouselConfig?.items || [];
      const exists = current.some((item) => item.itemType === itemType && item.itemId === itemId);
      const nextItems = exists
        ? current.filter((item) => !(item.itemType === itemType && item.itemId === itemId))
        : [...current, { itemType, itemId }].slice(0, 10);

      return {
        ...prev,
        carouselConfig: {
          ...(prev.carouselConfig || {}),
          contentType: nextItems.every((item) => item.itemType === 'PACKAGE') ? 'PACKAGES'
            : nextItems.every((item) => item.itemType === 'PROPERTY') ? 'PROPERTIES'
              : 'MIXED',
          items: nextItems,
        },
      };
    });
  };

  // Upsert per-image card config (keyword + flow button), keyed by catalog item id.
  const updateCarouselCard = (itemId, itemType, updates) => {
    setFormData((prev) => {
      const cards = Array.isArray(prev.carouselConfig?.cards) ? prev.carouselConfig.cards : [];
      const idx = cards.findIndex((card) => String(card.itemId || card.id || '') === String(itemId));
      const base = idx >= 0 ? cards[idx] : { itemId, itemType };
      const nextCard = { ...base, itemId, itemType, ...updates };
      const nextCards = idx >= 0 ? cards.map((card, i) => (i === idx ? nextCard : card)) : [...cards, nextCard];
      return { ...prev, carouselConfig: { ...(prev.carouselConfig || {}), cards: nextCards } };
    });
  };
  const carouselCards = formData.carouselConfig?.cards || [];

  const selectedCarouselRecords = carouselItems.map((item) => {
    const record = item.itemType === 'PROPERTY'
      ? activeProperties.find((property) => property.id === item.itemId)
      : activePackages.find((pkg) => pkg.id === item.itemId);
    return record ? { ...record, itemType: item.itemType } : null;
  }).filter(Boolean);
  const packageSection = getSectionByKey('packages');
  const propertySection = getSectionByKey('properties');
  const customTripSection = getSectionByKey('custom_trip');
  const selectedPackageRecords = selectedPackagesForSection(packageSection);
  const selectedPropertyRecords = selectedPropertiesForSection(propertySection);
  const selectedCtaCatalogRecords = activeSections.flatMap((section) => {
    if (section.itemType === 'PACKAGE') {
      return selectedPackagesForSection(section).map((pkg) => ({ ...pkg, itemType: 'PACKAGE' }));
    }
    if (section.itemType === 'PROPERTY') {
      return selectedPropertiesForSection(section).map((property) => ({ ...property, itemType: 'PROPERTY' }));
    }
    return [];
  });
  const allCatalogRecords = [
    ...activePackages.map((pkg) => ({ ...pkg, itemType: 'PACKAGE' })),
    ...activeProperties.map((property) => ({ ...property, itemType: 'PROPERTY' })),
  ];
  const configuredFeaturedCtaRecord = allCatalogRecords.find((item) =>
    item.itemType === formData.ctaConfig?.featuredItemType
    && item.id === formData.ctaConfig?.featuredItemId
  ) || null;
  const uploadedHeaderMediaUrl = String(formData.ctaConfig?.featuredMediaUrl || '').trim();
  const uploadedHeaderMediaName = String(formData.ctaConfig?.featuredMediaName || '').trim();
  const uploadedHeaderMediaRecord = uploadedHeaderMediaUrl
    ? {
        id: 'uploaded-header-media',
        itemType: 'UPLOAD',
        name: uploadedHeaderMediaName || 'Uploaded header image',
        imageUrl: uploadedHeaderMediaUrl,
      }
    : null;
  const featuredCtaRecord = uploadedHeaderMediaRecord || (configuredFeaturedCtaRecord && getCatalogItemMediaUrl(configuredFeaturedCtaRecord)
    ? configuredFeaturedCtaRecord
    : null);
  const ctaNeedsFeaturedMedia = builderMode === 'cta' && formData.mediaType === 'IMAGE';
  const compatibleApprovedTemplates = approvedTemplates.filter((template) =>
    isTemplateMediaCompatible(template, builderMode, formData.mediaType)
  );
  const filteredCompatibleTemplates = compatibleApprovedTemplates.filter((template) =>
    (template.displayName || template.name || '').toLowerCase().includes(templateSearch.toLowerCase())
  );
  const campaignDescription = String(formData.ctaConfig?.description || '').trim();
  // Named template variables filled at campaign time (excludes per-recipient contact vars).
  const templateVariableMap = Array.isArray(selectedTemplate?.variableMap) ? selectedTemplate.variableMap : [];
  const templateStaticVariables = templateVariableMap.filter((entry) => entry && entry.source === 'STATIC' && entry.name);
  const campaignVariableValues = formData.ctaConfig?.variableValues || {};
  const missingStaticVariables = templateStaticVariables.filter((entry) => !String(campaignVariableValues[entry.name] || '').trim());
  const humanizeVariableName = (name) => String(name || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  // Named templates resolve variables via variableValues; legacy positional ones use {{2}} = description.
  const templateNeedsCampaignDescription = builderMode === 'cta'
    && templateStaticVariables.length === 0
    && /\{\{\s*2\s*\}\}/.test(formData.messageBody || selectedTemplate?.body || '');
  const previewTemplateBody = (text) => {
    if (templateVariableMap.length) {
      return String(text || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, pos) => {
        const entry = templateVariableMap[Number(pos) - 1];
        if (!entry) return `Sample ${pos}`;
        if (entry.source === 'CONTACT') return 'Rahul';
        return String(campaignVariableValues[entry.name] || '').trim()
          || selectedTemplate?.sampleVariables?.[Number(pos) - 1]
          || humanizeVariableName(entry.name);
      });
    }
    return renderTemplatePreviewText(text, campaignDescription);
  };

  const handleHeaderMediaUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isVideoMode = formData.mediaType === 'VIDEO';
    if (isVideoMode && !file.type.startsWith('video/')) {
      setHeaderMediaUploadError('Please upload a video file.');
      return;
    }
    if (!isVideoMode && !file.type.startsWith('image/')) {
      setHeaderMediaUploadError('Please upload an image file.');
      return;
    }
    if (file.type.startsWith('video/') && file.size > MAX_HEADER_VIDEO_BYTES) {
      setHeaderMediaUploadError('Video is too large. WhatsApp allows videos up to 16 MB. Please compress it and try again.');
      return;
    }

    setHeaderMediaUploading(true);
    setHeaderMediaUploadError('');
    try {
      const response = await templatesApi.uploadMedia(file);
      const url = response?.data?.url;
      if (!url) throw new Error('Upload did not return a media URL');
      setFormData((prev) => ({
        ...prev,
        ctaConfig: {
          ...(prev.ctaConfig || {}),
          featuredMediaUrl: url,
          featuredMediaName: file.name,
          featuredItemType: null,
          featuredItemId: null,
        },
      }));
      setMediaSearch('');
      setShowMediaModal(false);
    } catch (err) {
      setHeaderMediaUploadError(err.response?.data?.error || err.message || 'Failed to upload image.');
    } finally {
      setHeaderMediaUploading(false);
    }
  };

  const applyApprovedTemplateSelection = useCallback((template) => {
    if (!template) {
      setSelectedTemplate(null);
      setFormData((prev) => ({
        ...prev,
        templateId: null,
      }));
      return;
    }

    const mediaMode = getTemplateMediaMode(template);

    setSelectedTemplate(template);
    setFormData((prev) => ({
      ...prev,
      templateId: template.id,
      messageBody: template.body || '',
      mediaType: mediaMode,
      format: normalizeTemplateType(template) === 'CAROUSEL' ? 'ITEM_CAROUSEL' : 'SECTION_CTA',
      ctaConfig: {
        ...(prev.ctaConfig || {}),
        buttonActions: normalizeTemplateType(template) === 'CAROUSEL'
          ? {}
          : buildDefaultButtonActions(getTemplateQuickReplyButtons(template), prev.ctaConfig?.buttonActions || {}),
      },
      carouselConfig: {
        ...(prev.carouselConfig || {}),
        mediaMode,
      },
    }));
  }, []);

  useEffect(() => {
    if (builderMode !== 'cta' || !selectedTemplate) return;
    const buttons = getTemplateQuickReplyButtons(selectedTemplate);
    if (!buttons.length) return;

    setFormData((prev) => ({
      ...prev,
      campaignSections: ((prev.campaignSections || []).length ? prev.campaignSections : createDefaultCampaignSections()).map((section) => {
        const buttonActions = Object.values(buildDefaultButtonActions(buttons, prev.ctaConfig?.buttonActions || {}));
        const shouldEnable = buttonActions.some((entry) => getSectionKeyForButtonAction(entry.action, entry.itemType) === section.key);
        if (!shouldEnable) return section;
        return {
          ...section,
          enabled: true,
          selectionMode: section.itemType === 'CUSTOM_TRIP' || (section.selectedItemIds || []).length > 0
            ? section.selectionMode
            : 'AUTO',
        };
      }),
      ctaConfig: {
        ...(prev.ctaConfig || {}),
        buttonActions: buildDefaultButtonActions(buttons, prev.ctaConfig?.buttonActions || {}),
      },
    }));
  }, [builderMode, selectedTemplate?.id]);

  useEffect(() => {
    if (!formData.templateId) {
      setSelectedTemplate(null);
      return;
    }

    const match = approvedTemplates.find((template) => template.id === formData.templateId) || null;
    setSelectedTemplate(match);
  }, [formData.templateId, approvedTemplates]);

  useEffect(() => {
    if (formData.type === 'REVIEW_COLLECTION') return;
    if (!approvedTemplates.length) return;

    const currentTemplate = approvedTemplates.find((template) => template.id === formData.templateId);
    if (currentTemplate && isTemplateMediaCompatible(currentTemplate, builderMode, formData.mediaType)) {
      return;
    }

    const fallbackTemplate = approvedTemplates.find((template) =>
      isTemplateMediaCompatible(template, builderMode, formData.mediaType)
    );
    if (fallbackTemplate) {
      applyApprovedTemplateSelection(fallbackTemplate);
      return;
    }

    if (formData.templateId) {
      setSelectedTemplate(null);
      setFormData((prev) => ({ ...prev, templateId: null }));
    }
  }, [builderMode, approvedTemplates, formData.templateId, formData.type, formData.mediaType, applyApprovedTemplateSelection]);

  const previewCarouselCards = builderMode !== 'carousel'
    ? []
    : carouselMode === 'UPLOAD'
      ? (formData.carouselConfig?.cards || []).slice(0, 10).map((c, i) => ({
          id: c.id,
          title: c.title || `Card ${i + 1}`,
          body: c.body || '',
          mediaType: c.mediaType || 'IMAGE',
          imageUrl: c.mediaType === 'VIDEO' ? '' : c.mediaUrl,
          buttons: (Array.isArray(c.buttons) ? c.buttons : []).map((b) => ({ text: b.buttonText, title: b.buttonText })),
        }))
      : buildCarouselPreviewCards(
          selectedCarouselRecords,
          selectedTemplate && normalizeTemplateType(selectedTemplate) === 'CAROUSEL' ? (selectedTemplate.carouselCards || []) : [],
          formData.mediaType
        );
  const previewButtons = selectedTemplate && normalizeTemplateType(selectedTemplate) !== 'CAROUSEL'
    ? ctaTemplateButtons
    : [];
  const ctaButtonActionEntries = ctaTemplateButtons.map((button, index) => {
    const key = getButtonActionKey(button, index);
    return ctaButtonActions[key] || buildDefaultButtonActions([button], {})[getButtonActionKey(button, 0)];
  });

  const isCtaButtonActionReady = (entry = {}) => {
    if (!CTA_BUTTON_ACTION_LABELS[entry.action]) return false;
    if (entry.action === 'VIEW_PACKAGES') return sectionHasCatalogItems(packageSection);
    if (entry.action === 'VIEW_PROPERTIES') return sectionHasCatalogItems(propertySection);
    if (entry.action === 'VIEW_DETAILS') {
      return !!entry.itemId || sectionHasCatalogItems(packageSection) || sectionHasCatalogItems(propertySection);
    }
    if (entry.action === 'SEND_ITINERARY') {
      return (entry.itemType === 'PACKAGE' && !!entry.itemId) || sectionHasCatalogItems(packageSection);
    }
    if (entry.action === 'CHECK_AVAILABILITY') {
      return (entry.itemType === 'PACKAGE' && !!entry.itemId) || sectionHasCatalogItems(packageSection);
    }
    return true;
  };

  const canProceed = () => {
    if (step === 0) return formData.name.trim().length > 0;
    if (step === 1) {
      if (!(formData.templateId || formData.messageBody.trim().length > 0)) return false;
      if (templateNeedsCampaignDescription && !campaignDescription) return false;
      if (templateStaticVariables.length && missingStaticVariables.length) return false;
      if (formData.format === 'SECTION_CTA') {
        if (hasTemplateButtonActions) {
          if (duplicateCtaButtonLabels.length > 0) return false;
          return ctaButtonActionEntries.length > 0
            && ctaButtonActionEntries.every(isCtaButtonActionReady)
            && (!ctaNeedsFeaturedMedia || !!featuredCtaRecord);
        }

        if (activeSections.length === 0) {
          if (ctaNeedsFeaturedMedia) return !!featuredCtaRecord;
          return true;
        }
        const catalogSections = activeSections.filter((section) => section.itemType === 'PACKAGE' || section.itemType === 'PROPERTY');
        const hasItemsForEnabledSections = catalogSections.every(sectionHasCatalogItems);
        if (!hasItemsForEnabledSections) return false;
        if (ctaNeedsFeaturedMedia) return !!featuredCtaRecord;
        return true;
      }
      if (formData.format === 'ITEM_CAROUSEL') {
        if (carouselMode === 'UPLOAD') {
          const mediaCards = (formData.carouselConfig?.cards || []).filter((card) => String(card?.mediaUrl || '').trim());
          return mediaCards.length >= 2 && mediaCards.length <= 10;
        }
        return carouselItems.length >= 2
          && carouselItems.length <= 10
          && selectedCarouselRecords.every((item) => getCatalogItemMediaUrl(item));
      }
      return true;
    }
    if (step === 2) {
      if (audienceMode === 'import') return importedIds.length > 0;
      if (['package_bookers', 'package_enquirers'].includes(audienceMode)) return !!selectedPackageId;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && formData.type === 'REVIEW_COLLECTION') {
      setStep(2); // Skip Step 1 (Template)
    } else {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step === 2 && formData.type === 'REVIEW_COLLECTION') {
      setStep(0); // Skip Step 1 back to Details
    } else if (step > 0) {
      setStep(step - 1);
    } else {
      navigate('/campaigns');
    }
  };
  const handleSubmit = async () => {
    setSending(true);
    try {
      const finalFilter = buildFilterFromMode();
      const isReviewCollection = formData.type === 'REVIEW_COLLECTION';
      const payload = {
        name: formData.name,
        type: formData.type,
        templateId: formData.templateId || null,
        messageBody: formData.messageBody || null,
        audienceFilter: finalFilter,
        linkedPackageIds: formData.linkedPackageIds || [],
        format: isReviewCollection ? 'STANDARD' : (formData.format || 'SECTION_CTA'),
        mediaType: isReviewCollection ? 'NONE' : (formData.mediaType || 'NONE'),
        mediaUrl: isReviewCollection || formData.mediaType === 'NONE' ? null : (formData.mediaUrl || null),
        campaignSections: !isReviewCollection && formData.format === 'SECTION_CTA'
          ? (formData.campaignSections || []).filter((section) => section.enabled)
          : [],
        carouselConfig: isReviewCollection ? { contentType: 'MIXED', items: [] } : (formData.carouselConfig || { contentType: 'MIXED', items: [] }),
        ctaConfig: isReviewCollection ? {} : {
          ...(formData.ctaConfig || {}),
          description: campaignDescription,
        },
        scheduledAt: formData.scheduleMode === 'scheduled' ? formData.scheduledAt : null,
        status: formData.scheduleMode === 'scheduled' ? 'SCHEDULED' : 'DRAFT',
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: editId, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/campaigns');
    } catch (err) {
      console.error('Failed to save campaign:', err);
    } finally {
      setSending(false);
    }
  };

  const getAudienceSummary = () => {
    const mode = AUDIENCE_MODES.find((m) => m.value === audienceMode);
    if (audienceMode === 'import') return `${importCount} imported contacts`;
    if (['package_bookers', 'package_enquirers', 'past_travelers', 'leads_only'].includes(audienceMode) && selectedPackageId) {
      const pkg = packages.find((p) => p.id === selectedPackageId);
      return `${mode?.label} — ${pkg?.name || 'Selected package'}`;
    }
    return mode?.label || 'All Clients';
  };

  // ── Render ──
  return (
    <div className="-mx-3 -mt-3 -mb-[calc(1rem+env(safe-area-inset-bottom))] sm:-mx-4 sm:-mb-4 md:-m-6 flex min-h-[calc(100dvh-60px)] flex-col campaign-wizard-page bg-white">

      {/* ── Decorative background orbs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 hidden overflow-hidden md:block">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-teal-400/8 to-[#f5f5f5]0/5 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-400/6 to-violet-500/4 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      {/* ── Main Card ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-white">

        {/* ── Step Indicator Bar ── */}
        <div className="relative overflow-x-auto border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-4 py-4 sm:px-6 sm:py-5 hide-scrollbar">
          <div className="mx-auto flex min-w-[560px] items-start justify-between w-full">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <React.Fragment key={i}>
                  <button
                    onClick={() => i < step && setStep(i)}
                    className={`group relative flex flex-col items-center gap-1.5 transition-all duration-300 ${
                      i < step ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Step circle */}
                    <div className={`relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-500 ${
                      isActive
                        ? 'bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white shadow-lg shadow-[#f0f0f0]0/25 scale-110'
                        : isDone
                        ? 'bg-gradient-to-br from-[#8a8a8a] to-[#f5f5f5]0 text-white shadow-md shadow-[#d4d4d4]/40'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                      {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-5 h-5" />}
                      {isActive && (
                        <span className="absolute inset-0 rounded-2xl animate-ping bg-[#f0f0f0]0/20" style={{ animationDuration: '2s' }} />
                      )}
                    </div>
                    {/* Label */}
                    <span className={`text-[11px] font-bold tracking-wide transition-colors duration-300 ${
                      isActive ? 'text-[#2d2d2d]'
                      : isDone ? 'text-[#404040]'
                      : 'text-slate-400'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 mt-5">
                      <div className="h-0.5 rounded-full overflow-hidden bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#8a8a8a] to-[#f0f0f0]0 transition-all duration-700 ease-out"
                          style={{ width: i < step ? '100%' : i === step ? '40%' : '0%' }}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 2xl:px-10">
          {/* ───── Step 1: Details ───── */}
          {step === 0 && (
            <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in">

<div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Maldives Promo"
                  className="w-full rounded-2xl border border-slate-200 px-5 py-3.5 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300 placeholder:text-slate-400"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Campaign Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CAMPAIGN_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isActive = formData.type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setFormData({ ...formData, type: t.value })}
                        className={`group relative flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-300 overflow-hidden ${
                          isActive
                            ? 'border-[#2d2d2d] bg-gradient-to-br from-[#f0f0f0] to-[#f5f5f5]/50 shadow-lg shadow-[#e5e5e5] scale-[1.01]'
                            : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/60 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${t.gradient} text-white shadow-lg transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{t.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.desc}</p>
                        </div>
                        {isActive && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white shadow-md animate-scale-in">
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </div>
                        )}
                        {/* Decorative active glow */}
                        {isActive && (
                          <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ───── Step 2: Template (Responsive UX) ───── */}
          {step === 1 && (
            <div className="w-full animate-fade-in">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)_minmax(0,1fr)]">
                
                {/* ── Left Column: Core Controls & Preview ── */}
                <div className="space-y-4">
                  {/* Campaign Mode */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Campaign Mode</p>
                    <div className="flex gap-2">
                      {TOP_LEVEL_MODES.map((mode) => {
                        const Icon = mode.icon;
                        const isActive = builderMode === mode.id;
                        return (
                          <button key={mode.id} type="button"
                            onClick={() => { if (mode.id === 'carousel') { selectMessageExperience(MESSAGE_EXPERIENCES.find((e) => e.id === 'IMAGE_CAROUSEL')); } else { setFormData((prev) => ({ ...prev, format: 'SECTION_CTA' })); } }}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 ${isActive ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            <Icon className="h-4 w-4" />{mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Media Type Filter */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Media Type</p>
                    {builderMode === 'cta' ? (
                      <div className="flex gap-2">
                        {[{ value: 'IMAGE', label: 'Image', icon: Image }, { value: 'VIDEO', label: 'Video', icon: Video }, { value: 'TEXT', label: 'Text', icon: Type }].map((opt) => {
                          const Icon = opt.icon;
                          const isActive = formData.mediaType === opt.value;
                          return (
                            <button key={opt.value} type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, mediaType: opt.value }))}
                              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 ${isActive ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                              <Icon className="h-4 w-4" />{opt.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {MESSAGE_EXPERIENCES.filter(e => e.group === 'carousel').map(exp => {
                          const Icon = exp.icon;
                          const isActive = currentExperience.id === exp.id;
                          return (
                            <button key={exp.id} type="button"
                              onClick={() => selectMessageExperience(exp)}
                              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 ${isActive ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                              <Icon className="h-4 w-4" />{exp.mediaMode}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Mobile-Only Drawer Triggers */}
                  <div className="lg:hidden space-y-4">
                    <button type="button" onClick={() => setShowTemplateDrawer(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-left transition hover:border-slate-300 hover:shadow-md group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedTemplate ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <Send className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Template</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {selectedTemplate ? (selectedTemplate.displayName || selectedTemplate.name) : 'Tap to choose a template'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition" />
                      </div>
                      {selectedTemplate && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 pl-[52px]">
                          {previewTemplateBody(selectedTemplate.body || '')}
                        </p>
                      )}
                    </button>

                    <button type="button" onClick={() => setShowConfigDrawer(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-left transition hover:border-slate-300 hover:shadow-md group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeSections.length > 0 || selectedCarouselRecords.length > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <Layers className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Content & Actions</p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {builderMode === 'carousel'
                                ? `${selectedCarouselRecords.length} carousel items`
                                : activeSections.length > 0
                                  ? activeSections.map(s => s.label).join(', ')
                                  : 'Tap to configure'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition" />
                      </div>
                      {(activeSections.length > 0 || selectedCarouselRecords.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                          {builderMode === 'cta' && (
                            <>
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{getMediaModeLabel(formData.mediaType)}</span>
                              {featuredCtaRecord && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">📷 {featuredCtaRecord.name}</span>}
                              {selectedPackageRecords.length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{selectedPackageRecords.length} pkg</span>}
                              {selectedPropertyRecords.length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{selectedPropertyRecords.length} prop</span>}
                            </>
                          )}
                          {builderMode === 'carousel' && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{selectedCarouselRecords.length}/10 items</span>}
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Inline WhatsApp Preview */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Live Preview</p>
                    <div className="rounded-xl bg-[#efeae2] p-3 ring-1 ring-slate-200">
                      <div className="ml-auto max-w-[92%] rounded-[12px] rounded-tr-sm bg-[#dcf8c6] p-3 text-xs text-slate-800 shadow-sm">
                        {builderMode === 'cta' && ctaNeedsFeaturedMedia && featuredCtaRecord && (
                          <div className="mb-3 overflow-hidden rounded-lg border border-black/10 bg-white">
                            <div className="aspect-[4/3] bg-slate-100"><img src={getCatalogItemMediaUrl(featuredCtaRecord)} alt="" className="h-full w-full object-cover" /></div>
                            <div className="border-t border-black/10 px-2 py-1 text-[10px] font-bold text-slate-600">{featuredCtaRecord.name}</div>
                          </div>
                        )}
                        <p className="whitespace-pre-line leading-relaxed">
                          {previewTemplateBody(formData.messageBody || 'Your campaign message will appear here.')}
                        </p>
                        {templateNeedsCampaignDescription && !campaignDescription && (
                          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            This template uses {'{{2}}'}, so add a campaign description before continuing.
                          </p>
                        )}
                        {templateStaticVariables.length > 0 && missingStaticVariables.length > 0 && (
                          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            Fill in {missingStaticVariables.map((entry) => `{{${entry.name}}}`).join(', ')} before continuing.
                          </p>
                        )}
                        {builderMode === 'cta' && (
                          <div className="mt-3 space-y-1.5 border-t border-black/10 pt-2">
                            {selectedTemplate && normalizeTemplateType(selectedTemplate) !== 'CAROUSEL'
                              ? previewButtons.length > 0 ? previewButtons.map((button, index) => (
                                <div key={`${button.type || 'button'}-${index}`} className="rounded-md bg-white px-3 py-1.5 text-center">
                                  <p className="text-[11px] font-bold text-sky-700">{button.text || `Button ${index + 1}`}</p>
                                  <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                                    {CTA_BUTTON_ACTION_LABELS[ctaButtonActions[getButtonActionKey(button, index)]?.action] || 'Configure in campaign'}
                                  </p>
                                </div>
                              )) : (<div className="rounded-md bg-white px-3 py-2 text-center text-[11px] font-bold text-slate-400">No previewable buttons</div>)
                              : activeSections.length > 0 ? activeSections.map((section) => (
                                <div key={section.key} className="rounded-md bg-white px-3 py-2 text-center text-[11px] font-bold text-sky-700">{section.label}</div>
                              )) : (<div className="rounded-md bg-white px-3 py-2 text-center text-[11px] font-bold text-slate-400">Enable at least one CTA action</div>)}
                          </div>
                        )}
                        {builderMode === 'carousel' && previewCarouselCards.length > 0 && (
                          <div className="mt-3 border-t border-black/10 pt-2 overflow-x-auto pb-2">
                            <div className="flex gap-2 min-w-max">
                              {previewCarouselCards.map((card, index) => (
                                <div key={`${card.itemType || 'T'}-${card.id || index}`} className="w-36 flex-shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white">
                                  <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">{getCatalogItemMediaUrl(card) ? <img src={getCatalogItemMediaUrl(card)} alt="" className="h-full w-full object-cover" /> : <Image className="h-6 w-6 text-slate-400" />}</div>
                                  <div className="p-2">
                                    <p className="truncate text-[11px] font-bold text-slate-900">{card.title || card.name || `Card ${index + 1}`}</p>
                                    {(card.buttons && card.buttons.length ? card.buttons : [{ text: 'Enquiry' }]).slice(0, 3).map((b, bi) => (
                                      <div key={bi} className="mt-1.5 rounded border border-sky-100 px-2 py-0.5 text-center text-[9px] font-bold text-sky-700">{b.text || b.title || 'Button'}</div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Middle/Right Columns (Desktop Only) ── */}
                <div className="hidden lg:flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
                    <p className="text-sm font-bold text-slate-900">{builderMode === 'carousel' ? 'Choose Carousel Template' : 'Choose CTA Template'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{filteredCompatibleTemplates.length} approved templates match media type</p>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TemplatePickerContent 
                      templates={filteredCompatibleTemplates} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} 
                      selectedId={formData.templateId} builderMode={builderMode} onSelect={applyApprovedTemplateSelection} 
                    />
                  </div>
                </div>

                <div className="hidden lg:flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
                    <p className="text-sm font-bold text-slate-900">Configure Content</p>
                    <p className="text-xs text-slate-500 mt-0.5">Set up media, description & actions</p>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ConfigContent 
                      builderMode={builderMode} formData={formData} setFormData={setFormData}
                      selectedTemplate={selectedTemplate} activeSections={activeSections} 
                      packageSection={packageSection} propertySection={propertySection} customTripSection={customTripSection}
                      activePackages={activePackages} activeProperties={activeProperties} 
                      selectedPackageRecords={selectedPackageRecords} selectedPropertyRecords={selectedPropertyRecords}
                      updateSection={updateSection} toggleSectionItem={toggleSectionItem} 
                      ctaNeedsFeaturedMedia={ctaNeedsFeaturedMedia} featuredCtaRecord={featuredCtaRecord}
                      getCatalogItemMediaUrl={getCatalogItemMediaUrl} setShowMediaModal={setShowMediaModal}
                      selectMessageExperience={selectMessageExperience} MESSAGE_EXPERIENCES={MESSAGE_EXPERIENCES} 
                      currentExperience={currentExperience} carouselItems={carouselItems} 
                      toggleCarouselItem={toggleCarouselItem} selectedCarouselRecords={selectedCarouselRecords}
                      ctaTemplateButtons={ctaTemplateButtons} ctaProviderButtons={ctaProviderButtons}
                      ctaButtonActions={ctaButtonActions} ctaButtonActionOptions={CTA_BUTTON_ACTIONS}
                      ctaButtonActionLabels={CTA_BUTTON_ACTION_LABELS} duplicateCtaButtonLabels={duplicateCtaButtonLabels}
                      selectedCtaCatalogRecords={selectedCtaCatalogRecords} allCatalogRecords={allCatalogRecords}
                      getButtonActionKey={getButtonActionKey} updateButtonAction={updateButtonAction}
                      ctaFlowOptions={ctaFlowOptions}
                      carouselCards={carouselCards} updateCarouselCard={updateCarouselCard}
                      onConfigureCampaignFlow={configureCampaignFlow}
                      campaignFlowConfigured={!!formData.ctaConfig?.flowGraphId}
                      onConfigureCarouselFlow={configureCarouselFlow}
                      carouselFlowConfigured={!!formData.carouselConfig?.flowGraphId}
                      carouselMode={carouselMode} setCarouselMode={setCarouselMode}
                      addUploadCard={addUploadCard} updateUploadCard={updateUploadCard} removeUploadCard={removeUploadCard}
                      addUploadCardsFromFiles={addUploadCardsFromFiles}
                      carouselHasButtons={carouselHasButtons}
                    />
                  </div>
                </div>

              </div>

              {/* ── Bottom Drawers (Mobile Only) ── */}
              <div className="lg:hidden">
                <TemplatePickerDrawer open={showTemplateDrawer} onClose={() => setShowTemplateDrawer(false)} templates={filteredCompatibleTemplates} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} selectedId={formData.templateId} onSelect={applyApprovedTemplateSelection} builderMode={builderMode} />
                <ConfigDrawer open={showConfigDrawer} onClose={() => setShowConfigDrawer(false)} builderMode={builderMode} formData={formData} setFormData={setFormData} selectedTemplate={selectedTemplate} activeSections={activeSections} packageSection={packageSection} propertySection={propertySection} customTripSection={customTripSection} activePackages={activePackages} activeProperties={activeProperties} selectedPackageRecords={selectedPackageRecords} selectedPropertyRecords={selectedPropertyRecords} updateSection={updateSection} toggleSectionItem={toggleSectionItem} ctaNeedsFeaturedMedia={ctaNeedsFeaturedMedia} featuredCtaRecord={featuredCtaRecord} getCatalogItemMediaUrl={getCatalogItemMediaUrl} setShowMediaModal={setShowMediaModal} selectMessageExperience={selectMessageExperience} MESSAGE_EXPERIENCES={MESSAGE_EXPERIENCES} currentExperience={currentExperience} carouselItems={carouselItems} toggleCarouselItem={toggleCarouselItem} selectedCarouselRecords={selectedCarouselRecords} ctaTemplateButtons={ctaTemplateButtons} ctaProviderButtons={ctaProviderButtons} ctaButtonActions={ctaButtonActions} ctaButtonActionOptions={CTA_BUTTON_ACTIONS} ctaButtonActionLabels={CTA_BUTTON_ACTION_LABELS} duplicateCtaButtonLabels={duplicateCtaButtonLabels} selectedCtaCatalogRecords={selectedCtaCatalogRecords} allCatalogRecords={allCatalogRecords} getButtonActionKey={getButtonActionKey} updateButtonAction={updateButtonAction} ctaFlowOptions={ctaFlowOptions} carouselCards={carouselCards} updateCarouselCard={updateCarouselCard} onConfigureCampaignFlow={configureCampaignFlow} campaignFlowConfigured={!!formData.ctaConfig?.flowGraphId} onConfigureCarouselFlow={configureCarouselFlow} carouselFlowConfigured={!!formData.carouselConfig?.flowGraphId} carouselMode={carouselMode} setCarouselMode={setCarouselMode} addUploadCard={addUploadCard} updateUploadCard={updateUploadCard} removeUploadCard={removeUploadCard} addUploadCardsFromFiles={addUploadCardsFromFiles} carouselHasButtons={carouselHasButtons} />
              </div>
            </div>
          )}

          {/* ───── Step 3: Audience ───── */}
          {step === 2 && (
            <div className="w-full max-w-[1400px] mx-auto space-y-5 animate-fade-in">
              <div className="wizard-section-header">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Users className="w-3.5 h-3.5" />
                  Target Audience
                </div>
                <h2 className="text-lg font-bold text-slate-900">Who should receive this campaign?</h2>
                <p className="text-sm text-slate-500 mt-0.5">Define your audience segment for maximum impact.</p>
              </div>

              {/* Audience Count Banner */}
              <div className={`relative overflow-hidden flex items-center gap-4 rounded-2xl p-5 transition-all duration-500 ${
                audienceMode === 'import' ? (importedIds.length > 0 ? 'bg-gradient-to-r from-[#f0f0f0] to-[#f5f5f5]/80 border border-[#d4d4d4]/80' : 'bg-slate-50 border border-slate-200/80')
                : audienceCount === 0 ? 'bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/80' : 'bg-gradient-to-r from-[#f0f0f0] to-[#f5f5f5]/80 border border-[#d4d4d4]/80'
              }`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  audienceMode === 'import' ? (importedIds.length > 0 ? 'bg-gradient-to-br from-[#f0f0f0]0 to-[#f5f5f5]0 text-white shadow-lg shadow-[#d4d4d4]/50' : 'bg-slate-200 text-slate-400')
                  : audienceCount === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200/50' : 'bg-gradient-to-br from-[#f0f0f0]0 to-[#f5f5f5]0 text-white shadow-lg shadow-[#d4d4d4]/50'
                }`}>
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className={`text-base font-bold ${
                    audienceMode === 'import' ? 'text-slate-800'
                    : audienceCount === 0 ? 'text-amber-800' : 'text-teal-800'
                  }`}>
                    {audienceMode === 'import'
                      ? (importedIds.length > 0 ? `${importedIds.length} contacts imported` : 'No contacts imported yet')
                      : previewMutation.isPending ? 'Counting...' : `${(audienceCount || 0).toLocaleString()} recipients match`
                    }
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {audienceMode === 'import' ? 'Upload CSV or paste phone numbers below' : 'Based on your selection'}
                  </p>
                </div>
                {audienceMode !== 'import' && (
                  <button
                    onClick={refreshAudience}
                    className="group flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-md hover:border-slate-300 transition-all duration-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                    Refresh
                  </button>
                )}
                {/* Decorative */}
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-[#b0b0b0]/10 to-[#b0b0b0]/10 blur-xl" />
              </div>

              {/* Audience Mode Cards */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {AUDIENCE_MODES.map((m) => {
                  const Icon = m.icon;
                  const isActive = audienceMode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => {
                        setAudienceMode(m.value);
                        if (m.value !== 'advanced') setShowAdvanced(false);
                        if (m.value === 'advanced') setShowAdvanced(true);
                      }}
                      className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-3.5 text-center transition-all duration-300 overflow-hidden ${
                        isActive
                          ? 'border-[#2d2d2d] bg-gradient-to-b from-[#f0f0f0] to-[#f5f5f5]/60 shadow-lg shadow-[#e5e5e5] scale-[1.02]'
                          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                        isActive
                          ? `bg-gradient-to-br ${m.gradient} text-white shadow-lg`
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-bold leading-tight transition-colors duration-300 ${isActive ? 'text-[#2d2d2d]' : 'text-slate-700'}`}>{m.label}</span>
                      {isActive && <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-teal-400/10 rounded-full blur-xl" />}
                    </button>
                  );
                })}
              </div>

              {/* Mode-specific options */}
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-5 space-y-4 shadow-sm">
                {/* ─── All Clients ─── */}
                {audienceMode === 'all' && (
                  <div className="flex items-center gap-4 py-3 px-2">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200/50">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Send to all clients</p>
                      <p className="text-xs text-slate-500 mt-0.5">Every customer in your database will receive this message.</p>
                    </div>
                  </div>
                )}

                {/* ─── Package Bookers | Enquirers | Past Travelers | Leads ─── */}
                {['package_bookers', 'package_enquirers', 'past_travelers', 'leads_only'].includes(audienceMode) && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                      {audienceMode === 'leads_only' ? 'Filter by package (optional)' : 'Select Package *'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1 hide-scrollbar">
                      {audienceMode === 'leads_only' && (
                        <button
                          onClick={() => setSelectedPackageId(null)}
                          className={`group flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-300 ${
                            !selectedPackageId ? 'border-[#2d2d2d] bg-gradient-to-r from-[#f0f0f0] to-[#f5f5f5]/50 shadow-md' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">All Packages</p>
                            <p className="text-xs text-slate-400">No package filter</p>
                          </div>
                        </button>
                      )}
                      {packages.map((pkg) => {
                        const isSelected = selectedPackageId === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            onClick={() => setSelectedPackageId(pkg.id)}
                            className={`group flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-300 ${
                              isSelected ? 'border-[#2d2d2d] bg-gradient-to-r from-[#f0f0f0] to-[#f5f5f5]/50 shadow-md' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            {pkg.imageUrl ? (
                              <img src={pkg.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{pkg.name}</p>
                              <p className="text-xs text-slate-400">{(pkg.destinations || []).join(', ') || pkg.category || '-'}</p>
                            </div>
                            {isSelected && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white flex-shrink-0 animate-scale-in">
                                <Check className="w-3 h-3" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Lead status filter for leads_only */}
                    {audienceMode === 'leads_only' && (
                      <div className="mt-4">
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Lead Status (optional)</label>
                        <div className="flex flex-wrap gap-2">
                          {LEAD_STATUSES.map((s) => {
                            const isSelected = selectedLeadStatuses.includes(s);
                            return (
                              <button
                                key={s}
                                onClick={() => setSelectedLeadStatuses(
                                  isSelected ? selectedLeadStatuses.filter((x) => x !== s)
                                : [...selectedLeadStatuses, s]
                                )}
                                className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-[#2d2d2d] to-[#404040] text-white shadow-md shadow-black/5'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {s.replace('_', ' ')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── By Booking Status ─── */}
                {audienceMode === 'by_booking_status' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Booking Status</label>
                    <div className="flex gap-2">
                      {BOOKING_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSelectedBookingStatus(s.value)}
                          className={`rounded-xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
                            selectedBookingStatus === s.value
                              ? 'bg-gradient-to-r from-[#2d2d2d] to-[#404040] text-white shadow-lg shadow-black/5'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Import Contacts ─── */}
                {audienceMode === 'import' && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-5 py-4 text-sm font-bold text-slate-600 hover:bg-white hover:border-teal-400 hover:shadow-md transition-all duration-300 flex-1"
                      >
                        <FileSpreadsheet className="w-6 h-6 text-slate-400 group-hover:text-[#f0f0f0]0 transition-colors" />
                        Upload CSV File
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,.tsv"
                        className="hidden"
                        onChange={handleFileImport}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                        Or paste contacts (one per line: <code className="text-[#404040] bg-[#f0f0f0] px-1.5 py-0.5 rounded">Name, Phone</code> or just <code className="text-[#404040] bg-[#f0f0f0] px-1.5 py-0.5 rounded">Phone</code>)
                      </label>
                      <textarea
                        rows={5}
                        placeholder={`John Doe, +919876543210\nJane, 8765432109\n+917654321098`}
                        className="w-full rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-mono bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300 resize-none"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => processImportText(importText)}
                        disabled={!importText.trim() || importStatus === 'importing'}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2d2d2d] to-[#404040] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
                      >
                        <UserPlus className="w-4 h-4" />
                        {importStatus === 'importing' ? 'Importing...' : 'Import Contacts'}
                      </button>

                      {importStatus === 'done' && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-[#2d2d2d] animate-fade-in">
                          <UserCheck className="w-4 h-4" /> {importCount} contacts imported!
                        </span>
                      )}
                      {importStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-rose-600 animate-fade-in">
                          <AlertTriangle className="w-4 h-4" /> No valid contacts found. Check format.
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-200/60 p-4">
                      <p className="text-xs text-blue-800 font-bold mb-1.5">📋 Supported formats:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• CSV: <code className="bg-white/60 px-1.5 py-0.5 rounded">Name, Phone</code> or just <code className="bg-white/60 px-1.5 py-0.5 rounded">Phone</code></li>
                        <li>• Phone can be: <code className="bg-white/60 px-1.5 py-0.5 rounded">+919876543210</code>, <code className="bg-white/60 px-1.5 py-0.5 rounded">09876543210</code>, or <code className="bg-white/60 px-1.5 py-0.5 rounded">9876543210</code></li>
                        <li>• Headers (name, phone, mobile) are auto-detected and skipped</li>
                        <li>• Max 10,000 contacts per import</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* ─── Advanced Filters ─── */}
                {(audienceMode === 'advanced' || showAdvanced) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Source</label>
                        <select
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.source || ''}
                          onChange={(e) => updateAdvancedFilter('source', e.target.value)}
                        >
                          <option value="">All Sources</option>
                          <option value="whatsapp_organic">WhatsApp Organic</option>
                          <option value="instagram_ad">Instagram Ads</option>
                          <option value="facebook_ad">Facebook Ads</option>
                          <option value="referral">Referral</option>
                          <option value="website">Website</option>
                          <option value="manual">Manual Entry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Destinations</label>
                        <input
                          type="text"
                          placeholder="e.g. Maldives, Bali"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={(formData.audienceFilter.destinations || []).join(', ')}
                          onChange={(e) => updateAdvancedFilter('destinations', e.target.value.split(',').map((d) => d.trim()).filter(Boolean))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Created After</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.createdAfter || ''}
                          onChange={(e) => updateAdvancedFilter('createdAfter', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Created Before</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.createdBefore || ''}
                          onChange={(e) => updateAdvancedFilter('createdBefore', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Last Active Before</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.lastActiveBefore || ''}
                          onChange={(e) => updateAdvancedFilter('lastActiveBefore', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Booked After</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.bookedAfter || ''}
                          onChange={(e) => updateAdvancedFilter('bookedAfter', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Booked Before</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.bookedBefore || ''}
                          onChange={(e) => updateAdvancedFilter('bookedBefore', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Spam Protection (days)</label>
                        <input type="number" placeholder="e.g. 7"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                          value={formData.audienceFilter.excludeCampaignDays || ''}
                          onChange={(e) => updateAdvancedFilter('excludeCampaignDays', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Toggle advanced for non-advanced modes */}
                {audienceMode !== 'advanced' && audienceMode !== 'import' && (
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="group flex items-center gap-2 text-xs font-bold text-[#404040] hover:text-[#2d2d2d] transition-all duration-300 mt-2"
                  >
                    <Filter className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform duration-300" />
                    {showAdvanced ? 'Hide advanced filters' : 'Add advanced filters'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ───── Step 4: Schedule ───── */}
          {step === 3 && (
            <div className="w-full max-w-[1400px] mx-auto space-y-5 animate-fade-in">
              <div className="wizard-section-header">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Delivery Schedule
                </div>
                <h2 className="text-lg font-bold text-slate-900">When should this campaign go out?</h2>
                <p className="text-sm text-slate-500 mt-0.5">Choose immediate delivery or schedule for the perfect time.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setFormData({ ...formData, scheduleMode: 'now' })}
                    className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300 sm:p-8 ${
                    formData.scheduleMode === 'now'
                      ? 'border-[#2d2d2d] bg-gradient-to-b from-[#f0f0f0] to-[#f5f5f5]/60 shadow-xl shadow-[#e5e5e5] scale-[1.01]'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-lg'
                  }`}
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-500 ${
                    formData.scheduleMode === 'now'
                      ? 'bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white shadow-xl shadow-black/5 scale-110'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>
                    <Send className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-extrabold text-slate-900">Send Now</p>
                    <p className="text-xs text-slate-500 mt-1">Save as draft, send manually later</p>
                  </div>
                  {formData.scheduleMode === 'now' && <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-teal-400/10 rounded-full blur-2xl" />}
                </button>

                <button
                  onClick={() => setFormData({ ...formData, scheduleMode: 'scheduled' })}
                  className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300 sm:p-8 ${
                    formData.scheduleMode === 'scheduled'
                      ? 'border-[#2d2d2d] bg-gradient-to-b from-[#f0f0f0] to-[#f5f5f5]/60 shadow-xl shadow-[#e5e5e5] scale-[1.01]'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-lg'
                  }`}
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-500 ${
                    formData.scheduleMode === 'scheduled'
                      ? 'bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white shadow-xl shadow-black/5 scale-110'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>
                    <Clock className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-extrabold text-slate-900">Schedule</p>
                    <p className="text-xs text-slate-500 mt-1">Pick a future date & time</p>
                  </div>
                  {formData.scheduleMode === 'scheduled' && <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-teal-400/10 rounded-full blur-2xl" />}
                </button>
              </div>

              {formData.scheduleMode === 'scheduled' && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm animate-fade-in">
                  <label className="block text-sm font-bold text-slate-700 mb-2.5">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 px-5 py-3.5 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                    value={formData.scheduledAt || ''}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ───── Step 5: Review & Send ───── */}
          {step === 4 && (
            <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in">
              <div className="wizard-section-header">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Eye className="w-3.5 h-3.5" />
                  Final Review
                </div>
                <h2 className="text-lg font-bold text-slate-900">Review your campaign before launching</h2>
                <p className="text-sm text-slate-500 mt-0.5">Double-check all details are correct. You can go back to any step to make changes.</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm overflow-hidden shadow-sm">
                {[
                  { label: 'Campaign Name', value: formData.name, icon: Megaphone },
                  { label: 'Type', value: CAMPAIGN_TYPES.find((t) => t.value === formData.type)?.label, icon: Target },
                  { label: 'Template', value: selectedTemplate?.displayName || formData.messageBody?.substring(0, 40) || 'Custom Message', icon: Send },
                  { label: 'Format', value: CAMPAIGN_FORMATS.find((format) => format.value === formData.format)?.label || 'Standard', icon: Layers, highlight: formData.format !== 'STANDARD' },
                  ...(formData.format === 'SECTION_CTA' ? [{
                    label: 'Customer Choices',
                    value: hasTemplateButtonActions
                      ? ctaButtonActionEntries.map((entry) => `${entry.buttonText}: ${CTA_BUTTON_ACTION_LABELS[entry.action] || 'Not configured'}`).join(', ')
                      : activeSections.map((section) => section.label).join(', ') || 'No sections enabled',
                    icon: UserPlus,
                    highlight: true,
                  }] : []),
                  ...(formData.format === 'ITEM_CAROUSEL' ? [{
                    label: 'Carousel Items',
                    value: `${selectedCarouselRecords.length} selected (${selectedCarouselRecords.filter((item) => item.itemType === 'PROPERTY').length} properties, ${selectedCarouselRecords.filter((item) => item.itemType === 'PACKAGE').length} packages)`,
                    icon: Package,
                    highlight: true,
                  }] : []),
                  { label: 'Audience', value: getAudienceSummary(), icon: Users, highlight: true },
                  { label: 'Est. Recipients', value: audienceMode === 'import' ? importedIds.length : (audienceCount || 0).toLocaleString(), icon: UserCheck, highlight: true },
                  ...(formData.linkedPackageIds.length > 0 ? [{ label: 'Linked Packages', value: `${formData.linkedPackageIds.length} package${formData.linkedPackageIds.length > 1 ? 's' : ''} — customers see "View Packages" button`, icon: Package, highlight: true }] : []),
                  { label: 'Delivery', value: formData.scheduleMode === 'scheduled' ? `Scheduled: ${new Date(formData.scheduledAt).toLocaleString()}` : 'Save as Draft', icon: Calendar },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className={`flex items-center justify-between px-5 py-4 ${idx > 0 ? 'border-t border-slate-100' : ''} hover:bg-slate-50/50 transition-colors duration-200`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-slate-500">{item.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${item.highlight ? 'text-[#2d2d2d]' : 'text-slate-900'}`}>
                        {item.value}
                        {item.label === 'Template' && formData.messageBody && !selectedTemplate && '...'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {((audienceMode === 'import' && importedIds.length === 0) || (audienceMode !== 'import' && audienceCount === 0)) && (
                <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/80 p-5 animate-fade-in">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200/40">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-amber-800">No recipients matched. Please go back and adjust your audience settings.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="relative flex items-center justify-between gap-3 border-t border-slate-100 bg-gradient-to-r from-white via-slate-50/30 to-white px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={goBack}
            className="group flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-md hover:border-slate-300 transition-all duration-300"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2d2d2d] to-[#404040] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#f0f0f0]0/20 hover:shadow-xl hover:shadow-[#f0f0f0]0/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2d2d2d] to-[#404040] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#f0f0f0]0/20 hover:shadow-xl hover:shadow-[#f0f0f0]0/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100"
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" strokeWidth={3} />
                  {isEdit ? 'Update Campaign' : 'Create Campaign'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {/* ── Media Selection Modal ── */}
      {campaignFlowBuilderOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Zap className="h-4 w-4 text-[#008069]" />
              Campaign flow — one entry per template button
            </div>
            <button
              type="button"
              onClick={() => setCampaignFlowBuilderOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Done
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading builder…</div>}>
              <SettingsFlowBuilder
                fullScreen
                initialFlowId={campaignFlowSeed?.flowId || null}
                initialButtons={campaignFlowSeed?.buttons || null}
              />
            </Suspense>
          </div>
        </div>
      )}

      {showMediaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMediaModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Select Header Media</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formData.mediaType === 'VIDEO'
                    ? 'Upload a video (max 16 MB) to use in the WhatsApp broadcast header. Leave empty to use the template’s approved video.'
                    : 'Upload an image or choose a package/property to feature in the CTA image header.'}
                </p>
              </div>
              <button onClick={() => setShowMediaModal(false)} className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {uploadedHeaderMediaUrl ? (
                      formData.mediaType === 'VIDEO' ? (
                        <video src={uploadedHeaderMediaUrl} className="h-14 w-14 rounded-xl object-cover shadow-sm" muted />
                      ) : (
                        <img src={uploadedHeaderMediaUrl} alt="" className="h-14 w-14 rounded-xl object-cover shadow-sm" />
                      )
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{formData.mediaType === 'VIDEO' ? 'Upload header video' : 'Upload header image'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {uploadedHeaderMediaUrl
                          ? (uploadedHeaderMediaName || `Uploaded ${formData.mediaType === 'VIDEO' ? 'video' : 'image'} selected`)
                          : `This ${formData.mediaType === 'VIDEO' ? 'video' : 'image'} will be used in the WhatsApp broadcast header.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {uploadedHeaderMediaUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          ctaConfig: {
                            ...(prev.ctaConfig || {}),
                            featuredMediaUrl: '',
                            featuredMediaName: '',
                          },
                        }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => headerMediaInputRef.current?.click()}
                      disabled={headerMediaUploading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      {headerMediaUploading ? 'Uploading...' : (formData.mediaType === 'VIDEO' ? 'Upload Video' : 'Upload Image')}
                    </button>
                    <input
                      ref={headerMediaInputRef}
                      type="file"
                      accept={formData.mediaType === 'VIDEO' ? 'video/*' : 'image/*'}
                      className="hidden"
                      onChange={handleHeaderMediaUpload}
                    />
                  </div>
                </div>
                {headerMediaUploadError && (
                  <p className="mt-2 text-xs font-semibold text-rose-600">{headerMediaUploadError}</p>
                )}
              </div>
              {formData.mediaType !== 'VIDEO' && (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search packages or properties..."
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-400/10"
                  />
                </div>
              )}
            </div>
            <div className={`flex-1 overflow-y-auto p-4 bg-slate-50/30 ${formData.mediaType === 'VIDEO' ? 'hidden' : ''}`}>
              <div className="grid gap-2">
                {allCatalogRecords
                  .filter(item => getCatalogItemMediaUrl(item) && item.name.toLowerCase().includes(mediaSearch.toLowerCase()))
                  .map(item => {
                    const isSelected = formData.ctaConfig?.featuredItemType === item.itemType && formData.ctaConfig?.featuredItemId === item.id;
                    return (
                      <button
                        key={`${item.itemType}-${item.id}`}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            ctaConfig: {
                              ...(prev.ctaConfig || {}),
                              featuredItemType: item.itemType,
                              featuredItemId: item.id,
                              featuredMediaUrl: '',
                              featuredMediaName: '',
                            },
                          }));
                          setShowMediaModal(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <img src={getCatalogItemMediaUrl(item)} alt="" className="h-14 w-14 rounded-xl object-cover shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.itemType === 'PROPERTY' ? item.location || 'Property' : (item.destinations || []).join(', ') || 'Package'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                            {item.itemType}
                          </div>
                          {isSelected && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                })}
                {allCatalogRecords.filter(item => getCatalogItemMediaUrl(item) && item.name.toLowerCase().includes(mediaSearch.toLowerCase())).length === 0 && (
                  <div className="text-center py-10 px-4">
                    <p className="text-sm font-bold text-slate-600">No media items found</p>
                    <p className="text-xs text-slate-500 mt-1">Try a different search term or add properties/packages with images.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
