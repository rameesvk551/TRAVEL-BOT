// FILE: /frontend/src/pages/CreateCampaign.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Check, Users, Calendar,
  Send, Search, Megaphone, RotateCcw, Sparkles, Gift,
  Clock, Filter, Eye, AlertTriangle, Upload, UserPlus,
  Package, Globe, Plane, ShieldCheck, FileSpreadsheet,
  Inbox, UserCheck, Star, ArrowLeft, Zap, Target,
  Home, Layers, Image, Video,
} from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, usePreviewAudience, useCampaign } from '../hooks/useCampaigns';
import { useAgencyTemplates, useCreateTemplate, useSubmitTemplate } from '../hooks/useTemplates';
import { packagesApi } from '../api/packagesApi';
import { campaignsApi } from '../api/campaignsApi';
import { propertiesApi } from '../api/propertiesApi';

const CAMPAIGN_TYPES = [
  { value: 'BROADCAST', label: 'Broadcast', icon: Megaphone, desc: 'General announcement to all or filtered audiences', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'PROMOTIONAL', label: 'Promotional', icon: Gift, desc: 'Special offers, discounts, and deals', gradient: 'from-[#f5f5f5]0 to-[#404040]' },
  { value: 'RE_ENGAGEMENT', label: 'Re-engagement', icon: RotateCcw, desc: 'Win back inactive customers', gradient: 'from-amber-500 to-orange-600' },
  { value: 'SEASONAL', label: 'Seasonal', icon: Sparkles, desc: 'Holiday/season-based campaigns', gradient: 'from-violet-500 to-purple-600' },
  { value: 'REVIEW_COLLECTION', label: 'Review Collection', icon: Star, desc: 'Request trip reviews manually', gradient: 'from-pink-500 to-rose-600' },
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
    description: 'Send image or video message with description and action buttons.',
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

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { id: editId } = useParams();

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
    mediaType: 'IMAGE',
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
  const fileInputRef = useRef(null);

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
        mediaType: editCampaign.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        mediaUrl: editCampaign.mediaUrl || '',
        campaignSections: normalizeCampaignSections(editCampaign.campaignSections),
        carouselConfig: {
          contentType: editCampaign.carouselConfig?.contentType || 'MIXED',
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

  const getSectionByKey = useCallback(
    (key) => (formData.campaignSections || []).find((section) => section.key === key) || createDefaultCampaignSections().find((section) => section.key === key),
    [formData.campaignSections]
  );

  const selectedPackagesForSection = (section) => activePackages.filter((pkg) => (section?.selectedItemIds || []).includes(pkg.id));
  const selectedPropertiesForSection = (section) => activeProperties.filter((property) => (section?.selectedItemIds || []).includes(property.id));

  const selectMessageExperience = (experience) => {
    setFormData((prev) => {
      return {
        ...prev,
        format: experience.format,
        mediaType: experience.mediaMode === 'VIDEO' ? 'VIDEO' : 'IMAGE',
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
      selectionMode: 'MANUAL',
      selectedItemIds: nextSelectedIds,
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

  const canProceed = () => {
    if (step === 0) return formData.name.trim().length > 0;
    if (step === 1) {
      if (!(formData.templateId || formData.messageBody.trim().length > 0)) return false;
      if (formData.format === 'SECTION_CTA') {
        if (activeSections.length === 0) return false;

        return activeSections.every((section) => {
          if (section.itemType === 'CUSTOM_TRIP') return true;
          return (section.selectedItemIds || []).length > 0;
        });
      }
      if (formData.format === 'ITEM_CAROUSEL') {
        return carouselItems.length >= 2
          && carouselItems.length <= 10
          && selectedCarouselRecords.every((item) => item.imageUrl || item.coverImageUrl);
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
      const payload = {
        name: formData.name,
        type: formData.type,
        templateId: formData.templateId || null,
        messageBody: formData.messageBody || null,
        audienceFilter: finalFilter,
        linkedPackageIds: formData.linkedPackageIds || [],
        format: formData.format || 'SECTION_CTA',
        mediaType: formData.mediaType || 'IMAGE',
        mediaUrl: formData.mediaUrl || null,
        campaignSections: formData.format === 'SECTION_CTA'
          ? (formData.campaignSections || []).filter((section) => section.enabled)
          : [],
        carouselConfig: formData.carouselConfig || { contentType: 'MIXED', items: [] },
        ctaConfig: formData.ctaConfig || {},
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

      {/* ── Page Header ── */}
      <div className="relative z-10 px-4 pt-4 sm:px-6 md:px-8 mb-4 flex items-center gap-3 sm:mb-5 sm:gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-100 pb-4">
        <button
          onClick={() => navigate('/campaigns')}
          className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-slate-200/80 bg-white/80 text-slate-400 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-slate-700 hover:shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform duration-200" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {isEdit ? 'Edit Campaign' : 'Create Campaign'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#f0f0f0]0" />
            Step {step + 1} of {STEPS.length} — {STEPS[step].desc}
          </p>
        </div>
      </div>

      {/* ── Main Card ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-white">

        {/* ── Step Indicator Bar ── */}
        <div className="relative overflow-x-auto border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-4 py-4 sm:px-6 sm:py-5 hide-scrollbar">
          <div className="mx-auto flex min-w-[560px] items-center justify-between sm:max-w-2xl">
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
                    <div className="flex-1 mx-2">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* ───── Step 1: Details ───── */}
          {step === 0 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div className="wizard-section-header">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Target className="w-3.5 h-3.5" />
                  Campaign Identity
                </div>
                <h2 className="text-lg font-bold text-slate-900">Give your campaign a name</h2>
                <p className="text-sm text-slate-500 mt-0.5">Choose a descriptive name and type that represents this campaign's purpose.</p>
              </div>

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

          {/* ───── Step 2: Template ───── */}
          {step === 1 && (
            <div className="w-full space-y-6 animate-fade-in">
              <div className="wizard-section-header max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Send className="w-3.5 h-3.5" />
                  Message Content
                </div>
                <h2 className="text-lg font-bold text-slate-900">What do you want to send?</h2>
                <p className="text-sm text-slate-500 mt-0.5">Choose a carousel to send swipeable cards, or a message with image/video and action buttons.</p>
              </div>

              {/* ── Open Templates Banner ── */}
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Publish templates in Template Messages</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open Templates, preview or edit the template, submit it to Meta, wait for Approved, then return here and select it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/templates')}
                  className="shell-button-secondary min-h-10"
                >
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                  Open Templates
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">Campaign content workspace</p>
                          <p className="mt-1 text-xs text-slate-500">Write the message and manually choose exactly what customers can view next.</p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                          {builderMode === 'cta' ? 'CTA flow' : 'Manual carousel'}
                        </div>
                      </div>

                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Campaign message</label>
                      <textarea
                        rows={6}
                        value={formData.messageBody}
                        onChange={(e) => setFormData((prev) => ({ ...prev, messageBody: e.target.value }))}
                        placeholder={builderMode === 'cta'
                          ? 'Write the message customers will see before choosing View Packages, View Properties, or Custom Trip.'
                          : 'Write the intro message customers will see above your selected carousel cards.'}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                      />
                    </div>

                    {builderMode === 'cta' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">CTA actions</p>
                              <p className="mt-1 text-xs text-slate-500">Packages and properties use manual selection. Custom Trip is toggle-only.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{activeSections.length} enabled</span>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            {(formData.campaignSections || []).map((section) => {
                              const Icon = section.itemType === 'PROPERTY' ? Home : section.itemType === 'CUSTOM_TRIP' ? UserPlus : Package;
                              const selectedCount = section.itemType === 'PACKAGE'
                                ? selectedPackageRecords.length
                                : section.itemType === 'PROPERTY'
                                  ? selectedPropertyRecords.length
                                  : 0;
                              return (
                                <button
                                  key={section.key}
                                  type="button"
                                  onClick={() => updateSection(section.key, {
                                    enabled: !section.enabled,
                                    selectionMode: 'MANUAL',
                                    selectedItemIds: section.itemType === 'CUSTOM_TRIP' ? [] : section.selectedItemIds || [],
                                  })}
                                  className={`rounded-2xl border p-4 text-left transition ${
                                    section.enabled ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${section.enabled ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    {section.enabled && <Check className="h-4 w-4" strokeWidth={3} />}
                                  </div>
                                  <p className={`text-sm font-bold ${section.enabled ? 'text-white' : 'text-slate-900'}`}>{section.label}</p>
                                  <p className={`mt-1 text-xs ${section.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                                    {section.itemType === 'CUSTOM_TRIP'
                                      ? 'Starts the existing custom-trip flow.'
                                      : `${selectedCount} item${selectedCount === 1 ? '' : 's'} selected`}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {packageSection.enabled && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900">View Packages selection</p>
                                <p className="mt-1 text-xs text-slate-500">Choose the exact packages shown after the CTA is tapped.</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedPackageRecords.length} selected</span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {activePackages.map((pkg) => {
                                const isSelected = (packageSection.selectedItemIds || []).includes(pkg.id);
                                return (
                                  <button
                                    key={pkg.id}
                                    type="button"
                                    onClick={() => toggleSectionItem('packages', pkg.id)}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                  >
                                    {pkg.imageUrl ? <img src={pkg.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Package className="h-6 w-6" /></div>}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-slate-900">{pkg.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{(pkg.destinations || []).join(', ') || pkg.category || 'Package'}</p>
                                    </div>
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-transparent'}`}>
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {propertySection.enabled && (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900">View Properties selection</p>
                                <p className="mt-1 text-xs text-slate-500">Choose the exact properties shown after the CTA is tapped.</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedPropertyRecords.length} selected</span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {activeProperties.map((property) => {
                                const isSelected = (propertySection.selectedItemIds || []).includes(property.id);
                                return (
                                  <button
                                    key={property.id}
                                    type="button"
                                    onClick={() => toggleSectionItem('properties', property.id)}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                  >
                                    {property.imageUrl ? <img src={property.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Home className="h-6 w-6" /></div>}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-slate-900">{property.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{property.location || property.propertyType || 'Property'}</p>
                                    </div>
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-transparent'}`}>
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {customTripSection.enabled && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                            <p className="text-sm font-bold text-emerald-900">Custom Trip enabled</p>
                            <p className="mt-1 text-xs text-emerald-700">No item selection is needed. Customers go directly into the existing custom-trip lead flow.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {builderMode === 'carousel' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">Carousel selection</p>
                              <p className="mt-1 text-xs text-slate-500">Pick 2 to 10 packages, properties, or a mix. Selection order is preserved.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedCarouselRecords.length} selected</span>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Packages</p>
                              {activePackages.map((pkg) => {
                                const isSelected = carouselItems.some((item) => item.itemType === 'PACKAGE' && item.itemId === pkg.id);
                                return (
                                  <button
                                    key={pkg.id}
                                    type="button"
                                    onClick={() => toggleCarouselItem('PACKAGE', pkg.id)}
                                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                  >
                                    {pkg.imageUrl ? <img src={pkg.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Package className="h-6 w-6" /></div>}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-slate-900">{pkg.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{(pkg.destinations || []).join(', ') || pkg.category || 'Package'}</p>
                                    </div>
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-transparent'}`}>
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Properties</p>
                              {activeProperties.map((property) => {
                                const isSelected = carouselItems.some((item) => item.itemType === 'PROPERTY' && item.itemId === property.id);
                                return (
                                  <button
                                    key={property.id}
                                    type="button"
                                    onClick={() => toggleCarouselItem('PROPERTY', property.id)}
                                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${isSelected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                  >
                                    {property.imageUrl ? <img src={property.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Home className="h-6 w-6" /></div>}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-slate-900">{property.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{property.location || property.propertyType || 'Property'}</p>
                                    </div>
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-transparent'}`}>
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <p className="text-sm font-bold text-slate-900">Builder mode</p>
                      <div className="grid grid-cols-1 gap-3">
                        {TOP_LEVEL_MODES.map((mode) => {
                          const Icon = mode.icon;
                          const isActive = builderMode === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                if (mode.id === 'carousel') {
                                  selectMessageExperience(MESSAGE_EXPERIENCES.find((e) => e.id === 'IMAGE_CAROUSEL'));
                                } else {
                                  setFormData((prev) => ({ ...prev, format: 'SECTION_CTA' }));
                                }
                              }}
                              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border-2 p-3.5 text-left transition-all duration-300 ${
                                isActive
                                  ? 'border-slate-900 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-md shadow-slate-900/10'
                                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm'
                              }`}
                            >
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                                isActive
                                  ? `bg-gradient-to-br ${mode.gradient} text-white shadow-sm`
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                              }`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>{mode.label}</p>
                              </div>
                              {isActive && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 animate-scale-in">
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* ── Sub-options ── */}
                      {builderMode === 'carousel' && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Media Type</p>
                          <div className="flex gap-2">
                            {MESSAGE_EXPERIENCES.filter((e) => e.group === 'carousel').map((experience) => {
                              const Icon = experience.icon;
                              const selected = currentExperience.id === experience.id;
                              return (
                                <button
                                  key={experience.id}
                                  type="button"
                                  onClick={() => selectMessageExperience(experience)}
                                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
                                    selected
                                      ? 'bg-slate-900 text-white shadow-sm'
                                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {experience.mediaMode}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {builderMode === 'cta' && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Media Type</p>
                          <div className="flex gap-2">
                            {[
                              { value: 'IMAGE', label: 'Image', icon: Image },
                              { value: 'VIDEO', label: 'Video', icon: Video },
                            ].map((opt) => {
                              const Icon = opt.icon;
                              const selected = formData.mediaType === opt.value && formData.format === 'SECTION_CTA';
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, format: 'SECTION_CTA', mediaType: opt.value }));
                                  }}
                                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
                                    selected
                                      ? 'bg-slate-900 text-white shadow-sm'
                                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Live Preview</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{builderMode === 'cta' ? 'CTA message' : 'Carousel'}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                        {formData.mediaType}
                      </span>
                    </div>
                    <div className="rounded-xl bg-[#efeae2] p-3 shadow-sm ring-1 ring-slate-200">
                      <div className="ml-auto max-w-[92%] rounded-[12px] rounded-tr-sm bg-[#dcf8c6] p-3 text-xs text-slate-800 shadow-sm">
                        <p className="whitespace-pre-line leading-relaxed">
                          {(formData.messageBody || 'Your campaign message will appear here.').replace('{{name}}', 'Rahul')}
                        </p>

                        {builderMode === 'cta' && (
                          <div className="mt-3 space-y-1.5 border-t border-black/10 pt-2">
                            {activeSections.length > 0 ? activeSections.map((section) => (
                              <div key={section.key} className="rounded-md bg-white px-3 py-2 text-center text-[11px] font-bold text-sky-700">
                                {section.label}
                              </div>
                            )) : (
                              <div className="rounded-md bg-white px-3 py-2 text-center text-[11px] font-bold text-slate-400">
                                Enable at least one CTA action
                              </div>
                            )}
                          </div>
                        )}

                        {builderMode === 'carousel' && (
                          <div className="mt-3 space-y-2 border-t border-black/10 pt-2">
                            {selectedCarouselRecords.length > 0 ? selectedCarouselRecords.slice(0, 4).map((card, index) => {
                              const mediaType = String(formData.mediaType || 'IMAGE').toUpperCase();
                              return (
                                <div key={`${card.itemType}-${card.id}`} className="overflow-hidden rounded-lg border border-black/10 bg-white">
                                  <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-500">
                                    {(card.imageUrl || card.coverImageUrl) ? (
                                      <img src={card.imageUrl || card.coverImageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : mediaType === 'VIDEO' ? (
                                      <Video className="h-7 w-7" />
                                    ) : (
                                      <Image className="h-7 w-7" />
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="truncate text-[11px] font-bold text-slate-900">{card.name || `Card ${index + 1}`}</p>
                                    <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">
                                      {card.itemType === 'PACKAGE'
                                        ? (card.destinations || []).join(', ') || card.category || 'Package'
                                        : card.location || card.propertyType || 'Property'}
                                    </p>
                                    <div className="mt-2 rounded border border-sky-100 px-2 py-1 text-center text-[9px] font-bold text-sky-700">Enquiry</div>
                                  </div>
                                </div>
                              );
                            }) : (
                              <div className="rounded-md bg-white px-3 py-3 text-center text-[11px] font-bold text-slate-400">
                                Select 2 to 10 items to preview the carousel
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* ── Format specific configurations ── */}
              {false && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">

                {formData.format === 'SECTION_CTA' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Customer Choice Menu</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Enable the choices customers should see after your campaign message.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {activeSections.length} active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {(formData.campaignSections || DEFAULT_CAMPAIGN_SECTIONS).map((section) => {
                        const Icon = section.itemType === 'PROPERTY' ? Home : section.itemType === 'CUSTOM_TRIP' ? UserPlus : Package;
                        const availableCount = section.itemType === 'PROPERTY'
                          ? activeProperties.length
                          : section.itemType === 'PACKAGE'
                            ? activePackages.filter((pkg) => {
                              if (section.filter?.category === 'INTERNATIONAL') return pkg.category === 'INTERNATIONAL';
                              if (section.filter?.category === 'DOMESTIC') return pkg.category === 'DOMESTIC';
                              return true;
                            }).length
                            : null;

                        return (
                          <div key={section.key} className={`rounded-xl border p-3 transition ${section.enabled ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-200 bg-white/70'}`}>
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => updateSection(section.key, { enabled: !section.enabled })}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                                  section.enabled
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-300 hover:text-slate-500'
                                }`}
                              >
                                {section.enabled ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={section.label}
                                  onChange={(e) => updateSection(section.key, { label: e.target.value })}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-400"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                  {section.itemType === 'CUSTOM_TRIP'
                                    ? 'Starts a lead form for name, destination, travellers, budget, and dates.'
                                    : `${section.itemType === 'PROPERTY' ? 'Property' : 'Package'} flow${availableCount !== null ? `, ${availableCount} available` : ''}.`}
                                </p>
                              </div>
                              {section.itemType === 'PACKAGE' && (
                                <select
                                  value={section.filter?.category || 'ALL'}
                                  onChange={(e) => updateSection(section.key, { filter: { ...(section.filter || {}), category: e.target.value } })}
                                  className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-slate-400"
                                >
                                  <option value="ALL">All packages</option>
                                  <option value="INTERNATIONAL">International</option>
                                  <option value="DOMESTIC">Domestic</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}



              </div>}

              {/* ── Link Packages (for Seasonal / Promotional) ── */}
              {false && ['SEASONAL', 'PROMOTIONAL'].includes(formData.type) && packages.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Package className="w-4 h-4 text-violet-500" />
                        Link Packages to Campaign
                      </label>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customers will see a "View Packages" button and can browse these packages directly.
                      </p>
                    </div>
                    {formData.linkedPackageIds.length > 0 && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-600 animate-scale-in">
                        {formData.linkedPackageIds.length} linked
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 hide-scrollbar">
                    {packages.filter((p) => p.isActive !== false).map((pkg) => {
                      const isLinked = formData.linkedPackageIds.includes(pkg.id);
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              linkedPackageIds: isLinked
                                ? prev.linkedPackageIds.filter((id) => id !== pkg.id)
                                : [...prev.linkedPackageIds, pkg.id],
                            }));
                          }}
                          className={`group relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-300 ${
                            isLinked
                              ? 'border-violet-400 bg-violet-50/60 shadow-md shadow-violet-100/60'
                              : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Checkbox indicator */}
                          <div className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 shrink-0 transition-all duration-300 ${
                            isLinked
                              ? 'border-violet-500 bg-violet-500 text-white'
                              : 'border-slate-300 group-hover:border-slate-400'
                          }`}>
                            {isLinked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{pkg.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {pkg.duration || 'Custom'} • ₹{Math.round((pkg.basePrice || 0) / 100).toLocaleString('en-IN')}/person
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {formData.linkedPackageIds.length > 0 && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50/50 border border-violet-200/60 p-3">
                      <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-violet-700 leading-relaxed">
                        <span className="font-bold">Interactive Broadcast:</span> After receiving your message, customers will see a <span className="font-bold">"🏖️ View Packages"</span> button. Tapping it shows these {formData.linkedPackageIds.length} package{formData.linkedPackageIds.length > 1 ? 's' : ''} with full details, images, and enquiry actions.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

          {/* ───── Step 3: Audience ───── */}
          {step === 2 && (
            <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
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
            <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
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

          {/* ───── Step 5: Review ───── */}
          {step === 4 && (
            <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
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
                    value: activeSections.map((section) => section.label).join(', ') || 'No sections enabled',
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
    </div>
  );
}
