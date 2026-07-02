import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation } from '@tanstack/react-query';
import client from '../../api/client';
import { PaperAirplaneIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAgencyTemplates, usePrebuiltTemplates } from '../../hooks/useTemplates';
import TemplateDetailDrawer from '../../components/TemplateDetailDrawer';

const DOCS = [
  {
    key: 'booking',
    label: 'Booking Confirmation',
    desc: 'Auto-send an approved Meta template when a new booking is created.',
    isTemplate: true,
  },
  {
    key: 'quotation',
    label: 'Quotation',
    desc: 'Auto-send a PDF when a quotation is marked as Sent.',
    isTemplate: true,
    docType: 'quotation',
  },
  {
    key: 'invoice',
    label: 'Invoice',
    desc: "Auto-send a PDF as soon as a booking's invoice is generated.",
    isTemplate: true,
    docType: 'invoice',
  },
  {
    key: 'receipt',
    label: 'Payment Receipt',
    desc: 'Auto-send a PDF receipt the moment a payment is confirmed paid.',
    isTemplate: true,
    docType: 'receipt',
  },
  {
    key: 'itinerary',
    label: 'Travel Itinerary',
    desc: 'Auto-send a branded PDF itinerary when an itinerary is marked as Sent.',
    captionPlaceholder: 'Here is your travel itinerary. We hope you love the plan!',
  },
];

export default function SettingsDocuments() {
  const { agency, updateAgency } = useAuthStore();
  const existing = agency?.documentSettings || {};
  
  const [autoSend, setAutoSend] = useState({
    booking: existing.autoSend?.booking ?? false,
    quotation: existing.autoSend?.quotation ?? false,
    invoice: existing.autoSend?.invoice ?? false,
    receipt: existing.autoSend?.receipt ?? false,
    itinerary: existing.autoSend?.itinerary ?? false,
  });

  const [captions, setCaptions] = useState({
    itinerary: existing.captions?.itinerary ?? '',
  });

  const [templates, setTemplates] = useState({
    booking: existing.templates?.booking ?? '',
    quotation: existing.templates?.quotation ?? '',
    invoice: existing.templates?.invoice ?? '',
    receipt: existing.templates?.receipt ?? '',
  });

  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isPrebuilt, setIsPrebuilt] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');

  const { data: agencyData } = useAgencyTemplates();
  const { data: prebuiltData } = usePrebuiltTemplates();

  const agencyTemplates = agencyData?.data || [];
  const prebuiltTemplates = prebuiltData?.data || [];

  const mutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Document delivery settings saved.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to save settings');
      setSuccess('');
    },
  });

  const save = () => {
    const cleanCaptions = {};
    Object.entries(captions).forEach(([k, v]) => { if (v && v.trim()) cleanCaptions[k] = v.trim(); });
    mutation.mutate({ documentSettings: { autoSend, captions: cleanCaptions, templates } });
  };

  const handleTemplateSelect = (docKey, templateId) => {
    // Check if it's a prebuilt template
    const prebuilt = prebuiltTemplates.find(t => t.id === templateId);
    if (prebuilt) {
      // Open drawer to clone and submit
      setSelectedTemplate(prebuilt);
      setIsPrebuilt(true);
      setDrawerMode('edit');
      setIsDrawerOpen(true);
      // We don't save it to the dropdown yet until it's approved, but we can clear the select
      return;
    }
    
    // Check if it's an agency template that is not approved
    const agencyTpl = agencyTemplates.find(t => t.id === templateId);
    if (agencyTpl && agencyTpl.status !== 'APPROVED') {
      setSelectedTemplate(agencyTpl);
      setIsPrebuilt(false);
      setDrawerMode('view'); // or edit
      setIsDrawerOpen(true);
      return;
    }

    setTemplates(t => ({ ...t, [docKey]: templateId }));
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setIsPrebuilt(false);
    setDrawerMode('create');
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {success && <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>}
      {error && <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

      <div className="shell-panel p-6">
        <div className="flex items-center gap-3">
          <PaperAirplaneIcon className="h-5 w-5 text-[#2d2d2d]" />
          <h2 className="text-xl font-extrabold text-slate-950">Send documents to WhatsApp</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          When a toggle is on, the document is generated as a branded PDF (using its default template) and delivered to the
          customer over WhatsApp automatically. For proactive notifications, you must use an approved Meta Template.
        </p>

        <div className="mt-6 space-y-4">
          {DOCS.map((doc) => {
            // For the document rows, surface exactly the one matching prebuilt
            // (tagged by docType) plus any of the agency's own document templates.
            const docPrebuilt = doc.docType
              ? prebuiltTemplates.filter((t) => (t.tags || []).includes(doc.docType))
              : prebuiltTemplates;
            const docAgencyTemplates = doc.docType
              ? agencyTemplates.filter((t) => (t.tags || []).includes(doc.docType) || t.headerType === 'DOCUMENT')
              : agencyTemplates;
            return (
            <div key={doc.key} className="rounded-[var(--radius-lg)] border border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <DocumentTextIcon className="h-5 w-5 text-neutral-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-neutral-900">{doc.label}</h3>
                    <p className="text-sm text-neutral-500">{doc.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSend((s) => ({ ...s, [doc.key]: !s[doc.key] }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${autoSend[doc.key] ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                  role="switch"
                  aria-checked={autoSend[doc.key]}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${autoSend[doc.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
              
              {autoSend[doc.key] && (
                <div className="mt-4 pl-8">
                  {doc.isTemplate ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-neutral-700">Meta WhatsApp Template</label>
                      <div className="flex items-center gap-3">
                        <select
                          value={templates[doc.key] || ''}
                          onChange={(e) => handleTemplateSelect(doc.key, e.target.value)}
                          className="flex-1 p-2.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select an Approved Template...</option>
                          {docAgencyTemplates.length > 0 && (
                            <optgroup label="Your Templates">
                              {docAgencyTemplates.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name} {t.status !== 'APPROVED' ? `(${t.status})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {docPrebuilt.length > 0 && (
                            <optgroup label="Prebuilt Templates (Requires Approval)">
                              {docPrebuilt.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name} (Preview & Setup)
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={handleNewTemplate}
                          className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          <PlusIcon className="h-4 w-4 mr-1.5" />
                          Create
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500">
                        Select a Meta-approved template. Prebuilt templates will need to be submitted for your account's approval first.
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">WhatsApp message (caption)</label>
                      <textarea
                        value={captions[doc.key]}
                        onChange={(e) => setCaptions((c) => ({ ...c, [doc.key]: e.target.value }))}
                        placeholder={doc.captionPlaceholder}
                        className="w-full p-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[70px]"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button type="button" onClick={save} disabled={mutation.isPending} className="shell-button">
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <TemplateDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        template={selectedTemplate}
        isPrebuilt={isPrebuilt}
        initialMode={drawerMode}
      />
    </div>
  );
}
