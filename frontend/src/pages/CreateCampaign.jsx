// FILE: /frontend/src/pages/CreateCampaign.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Check, Users, Calendar,
  Send, Search, Megaphone, RotateCcw, Sparkles, Gift,
  Clock, Filter, Eye, AlertTriangle, Upload, UserPlus,
  Package, Globe, Plane, ShieldCheck, FileSpreadsheet,
  Inbox, UserCheck, Star, ArrowLeft, Zap, Target,
} from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, usePreviewAudience, useCampaign } from '../hooks/useCampaigns';
import { useAgencyTemplates, usePrebuiltTemplates } from '../hooks/useTemplates';
import { packagesApi } from '../api/packagesApi';
import { campaignsApi } from '../api/campaignsApi';

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
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [audienceCount, setAudienceCount] = useState(null);
  const [sending, setSending] = useState(false);

  // Audience mode state
  const [audienceMode, setAudienceMode] = useState('all');
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedBookingStatus, setSelectedBookingStatus] = useState('CONFIRMED');
  const [selectedLeadStatuses, setSelectedLeadStatuses] = useState([]);
  const [importedIds, setImportedIds] = useState([]);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState(''); // '' | 'importing' | 'done' | 'error'
  const [importCount, setImportCount] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      });
    }
  }, [editCampaign]);

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const previewMutation = usePreviewAudience();
  const { data: agencyTemplates } = useAgencyTemplates();
  const { data: prebuiltTemplates } = usePrebuiltTemplates();

  const allTemplates = [
    ...(agencyTemplates?.data || []),
    ...(prebuiltTemplates?.data || []),
  ];

  const filteredTemplates = allTemplates.filter((t) =>
    (t.displayName || t.name || '').toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Load packages list
  useEffect(() => {
    packagesApi.list().then((res) => {
      setPackages(res?.data || []);
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

  const canProceed = () => {
    if (step === 0) return formData.name.trim().length > 0;
    if (step === 1) return formData.templateId || formData.messageBody.trim().length > 0;
    if (step === 2) {
      if (audienceMode === 'import') return importedIds.length > 0;
      if (['package_bookers', 'package_enquirers'].includes(audienceMode)) return !!selectedPackageId;
      return true;
    }
    return true;
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

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigate('/campaigns');
    }
  };

  // ── Render ──
  return (
    <div className="min-h-[calc(100vh-48px)] flex flex-col campaign-wizard-page">

      {/* ── Decorative background orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-teal-400/8 to-[#f5f5f5]0/5 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-400/6 to-violet-500/4 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      {/* ── Page Header ── */}
      <div className="relative z-10 flex items-center gap-4 mb-5">
        <button
          onClick={() => navigate('/campaigns')}
          className="group flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm text-slate-400 hover:bg-white hover:text-slate-700 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300"
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
      <div className="relative z-10 flex-1 flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] overflow-hidden">

        {/* ── Step Indicator Bar ── */}
        <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
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
                      {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4.5 h-4.5" />}
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
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
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
            <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
              <div className="wizard-section-header">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#404040] mb-2">
                  <Send className="w-3.5 h-3.5" />
                  Message Content
                </div>
                <h2 className="text-lg font-bold text-slate-900">Choose a template or compose your message</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select an approved template for reliable delivery, or write a custom message.</p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-3 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 hide-scrollbar">
                {filteredTemplates.map((t) => {
                  const isSelected = formData.templateId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFormData({ ...formData, templateId: t.id, messageBody: '' });
                        setSelectedTemplate(t);
                      }}
                      className={`group relative flex flex-col gap-2.5 rounded-2xl border-2 p-4 text-left transition-all duration-300 overflow-hidden ${
                        isSelected
                          ? 'border-[#2d2d2d] bg-gradient-to-br from-[#f0f0f0] to-[#f5f5f5]/50 shadow-lg shadow-[#e5e5e5]'
                          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{t.icon || '📝'}</span>
                          <span className="text-sm font-bold text-slate-900 truncate">{t.displayName}</span>
                        </div>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#2d2d2d] to-[#404040] text-white flex-shrink-0 animate-scale-in">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{t.body}</p>
                      <div className="flex gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${t.category === 'MARKETING' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                          {t.category}
                        </span>
                        {t.isPrebuilt && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600">Prebuilt</span>
                        )}
                      </div>
                      {isSelected && <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-teal-400/10 rounded-full blur-2xl" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Or compose a custom message</label>
                <textarea
                  rows={4}
                  placeholder="Type your message here... Use {{name}} for personalization."
                  className="w-full rounded-2xl border border-slate-200 px-5 py-3.5 text-sm bg-slate-50/50 focus:bg-white focus:border-teal-400 focus:ring-4 focus:ring-[#f0f0f0]0/10 outline-none transition-all duration-300 resize-none"
                  value={formData.messageBody}
                  onChange={(e) => setFormData({ ...formData, messageBody: e.target.value, templateId: null })}
                />
                <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  Variables: {'{{name}}'} = customer name. Note: Custom messages require an approved template for WhatsApp delivery.
                </p>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                        <Icon className="w-4.5 h-4.5" />
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

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData({ ...formData, scheduleMode: 'now' })}
                  className={`group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 overflow-hidden ${
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
                  className={`group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 overflow-hidden ${
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
                  { label: 'Audience', value: getAudienceSummary(), icon: Users, highlight: true },
                  { label: 'Est. Recipients', value: audienceMode === 'import' ? importedIds.length : (audienceCount || 0).toLocaleString(), icon: UserCheck, highlight: true },
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
        <div className="relative flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-gradient-to-r from-white via-slate-50/30 to-white">
          <button
            onClick={goBack}
            className="group flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-md hover:border-slate-300 transition-all duration-300"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
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
