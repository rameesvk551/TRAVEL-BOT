// FILE: /frontend/src/components/CampaignWizard.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Users, Calendar,
  Send, Search, Megaphone, RotateCcw, Sparkles, Gift,
  Clock, Filter, Eye, AlertTriangle, Upload, UserPlus,
  Package, Globe, Plane, ShieldCheck, FileSpreadsheet,
  Inbox, UserCheck, Star,
} from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, usePreviewAudience } from '../hooks/useCampaigns';
import { useAgencyTemplates, usePrebuiltTemplates } from '../hooks/useTemplates';
import { packagesApi } from '../api/packagesApi';
import { campaignsApi } from '../api/campaignsApi';

const CAMPAIGN_TYPES = [
  { value: 'BROADCAST', label: 'Broadcast', icon: Megaphone, desc: 'General announcement to all or filtered audiences', color: 'bg-blue-500' },
  { value: 'PROMOTIONAL', label: 'Promotional', icon: Gift, desc: 'Special offers, discounts, and deals', color: 'bg-emerald-500' },
  { value: 'RE_ENGAGEMENT', label: 'Re-engagement', icon: RotateCcw, desc: 'Win back inactive customers', color: 'bg-amber-500' },
  { value: 'SEASONAL', label: 'Seasonal', icon: Sparkles, desc: 'Holiday/season-based campaigns', color: 'bg-violet-500' },
  { value: 'REVIEW_COLLECTION', label: 'Review Collection', icon: Star, desc: 'Request trip reviews manually', color: 'bg-pink-500' },
];

const AUDIENCE_MODES = [
  { value: 'all', label: 'All Clients', icon: Users, desc: 'Send to every customer in your database', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'package_bookers', label: 'Package Bookers', icon: Package, desc: 'Clients who booked a specific package', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'package_enquirers', label: 'Package Enquiries', icon: Star, desc: 'Leads who enquired about a package but haven\'t booked', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'past_travelers', label: 'Past Travelers', icon: Plane, desc: 'Customers with confirmed/completed bookings', color: 'text-teal-600', bg: 'bg-teal-50' },
  { value: 'leads_only', label: 'Active Leads', icon: Inbox, desc: 'Current pipeline leads (filter by status)', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { value: 'by_booking_status', label: 'By Booking Status', icon: ShieldCheck, desc: 'Pending, confirmed, or completed bookings', color: 'text-violet-600', bg: 'bg-violet-50' },
  { value: 'import', label: 'Import Contacts', icon: Upload, desc: 'Upload a CSV or paste phone numbers', color: 'text-rose-600', bg: 'bg-rose-50' },
  { value: 'advanced', label: 'Advanced Filters', icon: Filter, desc: 'Destination, budget, date range, source & more', color: 'text-slate-600', bg: 'bg-slate-100' },
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
  { label: 'Details', icon: Megaphone },
  { label: 'Template', icon: Send },
  { label: 'Audience', icon: Users },
  { label: 'Schedule', icon: Calendar },
  { label: 'Review', icon: Eye },
];

export default function CampaignWizard({ onClose, editCampaign = null }) {
  const isEdit = !!editCampaign;
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: editCampaign?.name || '',
    type: editCampaign?.type || 'BROADCAST',
    templateId: editCampaign?.templateId || null,
    messageBody: editCampaign?.messageBody || '',
    audienceFilter: editCampaign?.audienceFilter || {},
    scheduledAt: editCampaign?.scheduledAt || null,
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
      // No special filter — all customers
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

        // Try to detect: phone-only, or name+phone, or has headers
        const first = parts[0];
        if (/^(name|phone|mobile|number|contact)/i.test(first)) continue; // Skip header

        // If only one column, assume it's a phone
        if (parts.length === 1) {
          const phone = normalizePhone(parts[0]);
          if (phone) contacts.push({ phone });
        } else {
          // Try first as name, second as phone
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
        await updateMutation.mutateAsync({ id: editCampaign.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? 'Edit Campaign' : 'Create Campaign'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step + 1} of {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-50 bg-slate-50/50">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={i}>
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isActive ? 'bg-[#0d6a5f] text-white shadow-sm' :
                    isDone ? 'bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100' :
                    'text-slate-400'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isDone ? 'text-emerald-400' : 'text-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ───── Step 1: Details ───── */}
          {step === 0 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Maldives Promo"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {CAMPAIGN_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isActive = formData.type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setFormData({ ...formData, type: t.value })}
                        className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                          isActive ? 'border-[#0d6a5f] bg-teal-50/50 ring-1 ring-teal-500/20' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${t.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                        </div>
                        {isActive && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d6a5f] text-white">
                            <Check className="w-3 h-3" />
                          </div>
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
            <div className="space-y-4 animate-in fade-in">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {filteredTemplates.map((t) => {
                  const isSelected = formData.templateId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFormData({ ...formData, templateId: t.id, messageBody: '' });
                        setSelectedTemplate(t);
                      }}
                      className={`flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition ${
                        isSelected ? 'border-[#0d6a5f] bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{t.icon || '📝'}</span>
                          <span className="text-sm font-semibold text-slate-900 truncate">{t.displayName}</span>
                        </div>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d6a5f] text-white flex-shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{t.body}</p>
                      <div className="flex gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.category === 'MARKETING' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                          {t.category}
                        </span>
                        {t.isPrebuilt && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">Prebuilt</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Or compose a custom message</label>
                <textarea
                  rows={4}
                  placeholder="Type your message here... Use {{name}} for personalization."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition resize-none"
                  value={formData.messageBody}
                  onChange={(e) => setFormData({ ...formData, messageBody: e.target.value, templateId: null })}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Variables: {'{{name}}'} = customer name. Note: Custom messages require an approved template for WhatsApp delivery.
                </p>
              </div>
            </div>
          )}

          {/* ───── Step 3: Audience ───── */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Audience Count Banner */}
              <div className={`flex items-center gap-3 rounded-xl p-4 ${
                audienceMode === 'import' ? (importedIds.length > 0 ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50 border border-slate-200')
                : audienceCount === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-teal-50 border border-teal-200'
              }`}>
                <Users className={`w-5 h-5 ${
                  audienceMode === 'import' ? (importedIds.length > 0 ? 'text-teal-600' : 'text-slate-400')
                  : audienceCount === 0 ? 'text-amber-600' : 'text-teal-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-bold ${
                    audienceMode === 'import' ? 'text-slate-800'
                    : audienceCount === 0 ? 'text-amber-800' : 'text-teal-800'
                  }`}>
                    {audienceMode === 'import'
                      ? (importedIds.length > 0 ? `${importedIds.length} contacts imported` : 'No contacts imported yet')
                      : previewMutation.isPending ? 'Counting...' : `${(audienceCount || 0).toLocaleString()} recipients match`
                    }
                  </p>
                  <p className="text-xs text-slate-500">
                    {audienceMode === 'import' ? 'Upload CSV or paste phone numbers below' : 'Based on your selection'}
                  </p>
                </div>
                {audienceMode !== 'import' && (
                  <button
                    onClick={refreshAudience}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>

              {/* Audience Mode Cards */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Who should receive this campaign?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition ${
                          isActive ? 'border-[#0d6a5f] bg-teal-50/50 ring-1 ring-teal-500/20' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? 'bg-[#0d6a5f] text-white' : `${m.bg} ${m.color}`}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode-specific options */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                {/* ─── All Clients ─── */}
                {audienceMode === 'all' && (
                  <div className="flex items-center gap-3 text-center py-4">
                    <Users className="w-8 h-8 text-blue-500 mx-auto" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">Send to all clients</p>
                      <p className="text-xs text-slate-500">Every customer in your database will receive this message.</p>
                    </div>
                  </div>
                )}

                {/* ─── Package Bookers | Enquirers | Past Travelers with package | Leads with package ─── */}
                {['package_bookers', 'package_enquirers', 'past_travelers', 'leads_only'].includes(audienceMode) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {audienceMode === 'leads_only' ? 'Filter by package (optional)' : 'Select Package *'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                      {audienceMode === 'leads_only' && (
                        <button
                          onClick={() => setSelectedPackageId(null)}
                          className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                            !selectedPackageId ? 'border-[#0d6a5f] bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Globe className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">All Packages</p>
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
                            className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                              isSelected ? 'border-[#0d6a5f] bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {pkg.imageUrl ? (
                              <img src={pkg.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{pkg.name}</p>
                              <p className="text-xs text-slate-400">{(pkg.destinations || []).join(', ') || pkg.category || '-'}</p>
                            </div>
                            {isSelected && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d6a5f] text-white flex-shrink-0">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Lead status filter for leads_only */}
                    {audienceMode === 'leads_only' && (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lead Status (optional)</label>
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
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  isSelected ? 'bg-[#0d6a5f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Booking Status</label>
                    <div className="flex gap-2">
                      {BOOKING_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSelectedBookingStatus(s.value)}
                          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                            selectedBookingStatus === s.value
                              ? 'bg-[#0d6a5f] text-white shadow-sm'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
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
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition flex-1"
                      >
                        <FileSpreadsheet className="w-5 h-5 text-slate-400" />
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Or paste contacts (one per line: <code className="text-teal-600">Name, Phone</code> or just <code className="text-teal-600">Phone</code>)
                      </label>
                      <textarea
                        rows={5}
                        placeholder={`John Doe, +919876543210\nJane, 8765432109\n+917654321098`}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition resize-none"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => processImportText(importText)}
                        disabled={!importText.trim() || importStatus === 'importing'}
                        className="flex items-center gap-2 rounded-xl bg-[#0d6a5f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0b5a51] transition disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        {importStatus === 'importing' ? 'Importing...' : 'Import Contacts'}
                      </button>

                      {importStatus === 'done' && (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                          <UserCheck className="w-4 h-4" /> {importCount} contacts imported!
                        </span>
                      )}
                      {importStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                          <AlertTriangle className="w-4 h-4" /> No valid contacts found. Check format.
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <p className="text-xs text-blue-800 font-semibold mb-1">📋 Supported formats:</p>
                      <ul className="text-xs text-blue-700 space-y-0.5">
                        <li>• CSV: <code>Name, Phone</code> or just <code>Phone</code></li>
                        <li>• Phone can be: <code>+919876543210</code>, <code>09876543210</code>, or <code>9876543210</code></li>
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
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Source</label>
                        <select
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
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
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Destinations</label>
                        <input
                          type="text"
                          placeholder="e.g. Maldives, Bali"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
                          value={(formData.audienceFilter.destinations || []).join(', ')}
                          onChange={(e) => updateAdvancedFilter('destinations', e.target.value.split(',').map((d) => d.trim()).filter(Boolean))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Created After</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
                          value={formData.audienceFilter.createdAfter || ''}
                          onChange={(e) => updateAdvancedFilter('createdAfter', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Created Before</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
                          value={formData.audienceFilter.createdBefore || ''}
                          onChange={(e) => updateAdvancedFilter('createdBefore', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Last Active Before</label>
                        <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
                          value={formData.audienceFilter.lastActiveBefore || ''}
                          onChange={(e) => updateAdvancedFilter('lastActiveBefore', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Spam Protection (days)</label>
                        <input type="number" placeholder="e.g. 7"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 outline-none"
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
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition mt-2"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {showAdvanced ? 'Hide advanced filters' : 'Add advanced filters'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ───── Step 4: Schedule ───── */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFormData({ ...formData, scheduleMode: 'now' })}
                  className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition ${
                    formData.scheduleMode === 'now' ? 'border-[#0d6a5f] bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${formData.scheduleMode === 'now' ? 'bg-[#0d6a5f] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Send className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">Send Now</p>
                    <p className="text-xs text-slate-500 mt-0.5">Save as draft, send manually later</p>
                  </div>
                </button>
                <button
                  onClick={() => setFormData({ ...formData, scheduleMode: 'scheduled' })}
                  className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition ${
                    formData.scheduleMode === 'scheduled' ? 'border-[#0d6a5f] bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${formData.scheduleMode === 'scheduled' ? 'bg-[#0d6a5f] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">Schedule</p>
                    <p className="text-xs text-slate-500 mt-0.5">Pick a future date & time</p>
                  </div>
                </button>
              </div>
              {formData.scheduleMode === 'scheduled' && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-teal-500 outline-none"
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
            <div className="space-y-4 animate-in fade-in">
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Campaign Name</span>
                  <span className="text-sm font-semibold text-slate-900">{formData.name}</span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Type</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {CAMPAIGN_TYPES.find((t) => t.value === formData.type)?.label}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Template</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {selectedTemplate?.displayName || formData.messageBody?.substring(0, 40) || 'Custom Message'}
                    {formData.messageBody && !selectedTemplate && '...'}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Audience</span>
                  <span className="text-sm font-semibold text-teal-700">{getAudienceSummary()}</span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Est. Recipients</span>
                  <span className="text-sm font-bold text-teal-700">
                    {audienceMode === 'import' ? importedIds.length : (audienceCount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">Delivery</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formData.scheduleMode === 'scheduled'
                      ? `Scheduled: ${new Date(formData.scheduledAt).toLocaleString()}`
                      : 'Save as Draft'}
                  </span>
                </div>
              </div>

              {((audienceMode === 'import' && importedIds.length === 0) || (audienceMode !== 'import' && audienceCount === 0)) && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-800">No recipients. Adjust your audience before saving.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 rounded-xl bg-[#0d6a5f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b5a51] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-xl bg-[#0d6a5f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b5a51] transition disabled:opacity-60"
            >
              {sending ? (
                <><span className="animate-spin">⏳</span> Saving...</>
              ) : (
                <><Check className="w-4 h-4" /> {isEdit ? 'Update Campaign' : 'Create Campaign'}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
