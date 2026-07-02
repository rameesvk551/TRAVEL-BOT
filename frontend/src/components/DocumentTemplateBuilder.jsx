// FILE: /frontend/src/components/DocumentTemplateBuilder.jsx
//
// Reusable "themed customizer" for quotation / invoice / receipt templates.
// Left: template list + design panels (layout, brand colours, logo, fonts,
// toggles, terms). Right: live preview that renders exactly like the PDF.
//
// Props:
//   docType   'quotation' | 'invoice' | 'receipt'
//   apiBase   REST base, e.g. '/quotation-templates'
//   title     heading shown above the builder

import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  PlusIcon, TrashIcon, CheckCircleIcon, SwatchIcon, EyeIcon,
  CodeBracketIcon, ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { renderPreviewHtml, sampleDataFor, FONT_OPTIONS } from '../utils/documentBuilder';

const LAYOUT_DESC = {
  modern: 'Bold coloured header band',
  classic: 'Centered, serif, traditional',
  minimal: 'Clean whitespace, thin rules',
};

export default function DocumentTemplateBuilder({ docType, apiBase, title }) {
  const [templates, setTemplates] = useState([]);
  const [presets, setPresets] = useState([]);
  const [defaultConfig, setDefaultConfig] = useState(null);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(null);
  const bgInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [tab, setTab] = useState('design'); // 'design' | 'preview' | 'code'
  const [previewHtml, setPreviewHtml] = useState('');

  const logoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const sample = useMemo(() => sampleDataFor(docType), [docType]);

  useEffect(() => { bootstrap(); /* eslint-disable-next-line */ }, [apiBase]);

  async function bootstrap() {
    setLoading(true);
    try {
      const [presetRes, listRes] = await Promise.all([
        api.get(`${apiBase}/presets`),
        api.get(apiBase),
      ]);
      setPresets(presetRes.data.data.presets || []);
      setDefaultConfig(presetRes.data.data.defaultConfig || {});
      const list = listRes.data.data || [];
      setTemplates(list);
      setActive(list[0] || null);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function refreshList(selectId) {
    const res = await api.get(apiBase);
    const list = res.data.data || [];
    setTemplates(list);
    if (selectId) setActive(list.find((t) => t.id === selectId) || list[0] || null);
  }

  async function createTemplate() {
    setSaving(true);
    try {
      const res = await api.post(apiBase, { name: `New ${docType} template`, config: defaultConfig });
      toast.success('Template created');
      await refreshList(res.data.data.id);
      setTab('design');
    } catch {
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    try {
      await api.put(`${apiBase}/${active.id}`, {
        name: active.name,
        htmlContent: active.htmlContent,
        config: active.config,
        isDefault: active.isDefault,
      });
      toast.success('Template saved');
      refreshList(active.id);
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id) {
    try {
      await api.put(`${apiBase}/${id}`, { isDefault: true });
      toast.success('Default updated');
      refreshList(id);
    } catch {
      toast.error('Failed to set default');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`${apiBase}/${id}`);
      toast.success('Template deleted');
      if (active?.id === id) setActive(null);
      refreshList();
    } catch {
      toast.error('Failed to delete template');
    }
  }

  // ---- config editing ----
  function patchConfig(updater) {
    setActive((prev) => {
      if (!prev) return prev;
      const config = JSON.parse(JSON.stringify(prev.config || {}));
      updater(config);
      return { ...prev, config };
    });
  }
  const setBrand = (k, v) => patchConfig((c) => { c.brand = { ...(c.brand || {}), [k]: v }; });
  const setHeader = (k, v) => patchConfig((c) => { c.header = { ...(c.header || {}), [k]: v }; });
  const setField = (k, v) => patchConfig((c) => { c.fields = { ...(c.fields || {}), [k]: v }; });
  const setContent = (k, v) => patchConfig((c) => { c.content = { ...(c.content || {}), [k]: v }; });
  const setBank = (k, v) => patchConfig((c) => { c.bank = { ...(c.bank || {}), [k]: v }; });

  function chooseLayout(key) {
    const preset = presets.find((p) => p.key === key);
    setActive((prev) => prev ? ({
      ...prev,
      htmlContent: preset ? preset.html : prev.htmlContent,
      config: { ...(prev.config || {}), layout: key },
    }) : prev);
  }

  async function uploadLogo(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/agencies/me/upload-asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBrand('logoUrl', res.data.data.url);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function uploadSignature(file) {
    if (!file) return;
    setUploadingSignature(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/agencies/me/upload-asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBrand('signatureUrl', res.data.data.url);
      toast.success('Signature uploaded');
    } catch {
      toast.error('Signature upload failed');
    } finally {
      setUploadingSignature(false);
    }
  }

  // Generic brand-image uploader (used for background + cover images).
  async function uploadBrandImage(key, file) {
    if (!file) return;
    setUploadingImage(key);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/agencies/me/upload-asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBrand(key, res.data.data.url);
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingImage(null);
    }
  }

  // ---- live preview ----
  // Rendered into a fully sandboxed iframe (sandbox="" + srcDoc): no script
  // execution and a unique opaque origin, so a malicious template can't run JS
  // in the app's origin. Images/CSS still render.
  useEffect(() => {
    if (!active || tab !== 'preview') return;
    setPreviewHtml(renderPreviewHtml(active.htmlContent, active.config, defaultConfig, sample));
  }, [active, tab, defaultConfig, sample]);

  if (loading) return <div className="p-6 text-neutral-500">Loading…</div>;

  const isItinerary = docType === 'itinerary';
  const cfg = active?.config || {};
  const brand = cfg.brand || {};
  const fields = cfg.fields || {};
  const header = cfg.header || {};
  const content = cfg.content || {};
  const bank = cfg.bank || {};
  const layout = cfg.layout || 'modern';

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col lg:flex-row min-h-[720px]">
        {/* Templates sidebar */}
        <div className="w-full lg:w-60 border-r border-neutral-200 bg-neutral-50 flex flex-col">
          <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
            <h3 className="font-semibold text-neutral-900">Templates</h3>
            <button onClick={createTemplate} disabled={saving} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md" title="New template">
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {templates.map((tpl) => (
              <div key={tpl.id} onClick={() => setActive(tpl)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${active?.id === tpl.id ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'hover:bg-neutral-100 text-neutral-700'}`}>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium truncate">{tpl.name}</span>
                  {tpl.isDefault && <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Default</span>}
                </div>
                <div className="flex items-center gap-1">
                  {!tpl.isDefault && (
                    <button onClick={(e) => { e.stopPropagation(); setDefault(tpl.id); }} className="text-neutral-400 hover:text-green-600" title="Set default">
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); remove(tpl.id); }} className="text-neutral-400 hover:text-red-600" title="Delete">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="p-4 text-sm text-neutral-500 text-center">No templates yet.</div>}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-50/60">
                <div className="flex items-center gap-3">
                  <input type="text" value={active.name}
                    onChange={(e) => setActive({ ...active, name: e.target.value })}
                    className="w-56 px-3 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Template name" />
                  <div className="flex bg-neutral-200/50 p-1 rounded-lg">
                    {[['design', 'Design', SwatchIcon], ['preview', 'Preview', EyeIcon], ['code', 'HTML', CodeBracketIcon]].map(([key, label, Icon]) => (
                      <button key={key} onClick={() => setTab(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}>
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={save} disabled={saving} className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg shadow-sm active:scale-95">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="flex-1 relative bg-neutral-50/30">
                {tab === 'design' && (
                  <div className="absolute inset-0 overflow-y-auto p-6 space-y-8 max-w-3xl">
                    {/* Layout */}
                    <Section title="Layout">
                      <div className="grid grid-cols-3 gap-3">
                        {presets.map((p) => (
                          <button key={p.key} onClick={() => chooseLayout(p.key)}
                            className={`text-left p-3 rounded-lg border-2 transition-colors ${layout === p.key ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                            <div className="font-semibold text-neutral-900">{p.name}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{LAYOUT_DESC[p.key] || ''}</div>
                          </button>
                        ))}
                      </div>
                    </Section>

                    {/* Branding */}
                    <Section title="Brand & Colours">
                      <div className="grid sm:grid-cols-2 gap-5">
                        <ColorField label="Primary colour" value={brand.primaryColor || '#4f46e5'} onChange={(v) => setBrand('primaryColor', v)} hint="Headers, table, accents" />
                        <ColorField label="Accent / heading colour" value={brand.accentColor || '#111827'} onChange={(v) => setBrand('accentColor', v)} />
                        <ColorField label="Text colour" value={brand.textColor || '#111827'} onChange={(v) => setBrand('textColor', v)} />
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">Font</label>
                          <select value={brand.fontFamily || 'Manrope'} onChange={(e) => setBrand('fontFamily', e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm">
                            {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="mt-5">
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                          <div className="w-28 h-16 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                            {brand.logoUrl ? <img src={brand.logoUrl} alt="logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-neutral-400">No logo</span>}
                          </div>
                          <div className="flex flex-col gap-2">
                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
                            <button onClick={() => logoInputRef.current?.click()} disabled={uploading}
                              className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg">
                              <ArrowUpTrayIcon className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload logo'}
                            </button>
                            {brand.logoUrl && <button onClick={() => setBrand('logoUrl', '')} className="text-xs text-neutral-500 hover:text-red-600 text-left">Remove (use company logo)</button>}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">Leave empty to fall back to your agency logo from Company Profile.</p>
                      </div>
                      <div className="mt-5">
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Signature</label>
                        <div className="flex items-center gap-4">
                          <div className="w-28 h-16 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                            {brand.signatureUrl ? <img src={brand.signatureUrl} alt="signature" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-neutral-400">No signature</span>}
                          </div>
                          <div className="flex flex-col gap-2">
                            <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadSignature(e.target.files?.[0])} />
                            <button onClick={() => signatureInputRef.current?.click()} disabled={uploadingSignature}
                              className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg">
                              <ArrowUpTrayIcon className="w-4 h-4" /> {uploadingSignature ? 'Uploading…' : 'Upload signature'}
                            </button>
                            {brand.signatureUrl && <button onClick={() => setBrand('signatureUrl', '')} className="text-xs text-neutral-500 hover:text-red-600 text-left">Remove (use company signature)</button>}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">Leave empty to fall back to the authorized signature from Company Profile.</p>
                      </div>
                    </Section>

                    {/* Background & cover images (itinerary) */}
                    {isItinerary && (
                      <Section title="Background & cover image">
                        <div className="grid sm:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">Page background image</label>
                            <div className="flex items-center gap-4">
                              <div className="w-28 h-16 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                                {brand.backgroundUrl ? <img src={brand.backgroundUrl} alt="background" className="max-h-full max-w-full object-cover" /> : <span className="text-xs text-neutral-400">None</span>}
                              </div>
                              <div className="flex flex-col gap-2">
                                <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBrandImage('backgroundUrl', e.target.files?.[0])} />
                                <button onClick={() => bgInputRef.current?.click()} disabled={uploadingImage === 'backgroundUrl'}
                                  className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg">
                                  <ArrowUpTrayIcon className="w-4 h-4" /> {uploadingImage === 'backgroundUrl' ? 'Uploading…' : 'Upload background'}
                                </button>
                                {brand.backgroundUrl && <button onClick={() => setBrand('backgroundUrl', '')} className="text-xs text-neutral-500 hover:text-red-600 text-left">Remove</button>}
                              </div>
                            </div>
                            <label className="block text-xs font-medium text-neutral-600 mt-3 mb-1">Background visibility: {brand.backgroundOpacity ?? 12}%</label>
                            <input type="range" min="0" max="60" value={brand.backgroundOpacity ?? 12} onChange={(e) => setBrand('backgroundOpacity', Number(e.target.value))} className="w-full" />
                            <p className="text-xs text-neutral-500 mt-1">A soft overlay keeps text readable over the image.</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">Cover / hero banner image</label>
                            <div className="flex items-center gap-4">
                              <div className="w-28 h-16 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
                                {brand.coverUrl ? <img src={brand.coverUrl} alt="cover" className="max-h-full max-w-full object-cover" /> : <span className="text-xs text-neutral-400">None</span>}
                              </div>
                              <div className="flex flex-col gap-2">
                                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBrandImage('coverUrl', e.target.files?.[0])} />
                                <button onClick={() => coverInputRef.current?.click()} disabled={uploadingImage === 'coverUrl'}
                                  className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg">
                                  <ArrowUpTrayIcon className="w-4 h-4" /> {uploadingImage === 'coverUrl' ? 'Uploading…' : 'Upload cover'}
                                </button>
                                {brand.coverUrl && <button onClick={() => setBrand('coverUrl', '')} className="text-xs text-neutral-500 hover:text-red-600 text-left">Remove</button>}
                              </div>
                            </div>
                            <p className="text-xs text-neutral-500 mt-3">Shown as a full-width banner under the header band.</p>
                          </div>
                        </div>
                      </Section>
                    )}

                    {/* Header */}
                    <Section title="Header">
                      <div className="grid sm:grid-cols-2 gap-5">
                        <TextField label="Document title" value={header.title || ''} onChange={(v) => setHeader('title', v)} placeholder={docType.toUpperCase()} />
                        <TextField label="Tagline (optional)" value={header.tagline || ''} onChange={(v) => setHeader('tagline', v)} placeholder="e.g. Your journey, our promise" />
                      </div>
                      <Toggle className="mt-4" label="Show logo / company name in header" checked={header.showLogo ?? true} onChange={(v) => setHeader('showLogo', v)} />
                    </Section>

                    {/* Sections to show */}
                    <Section title="Sections">
                      <div className="grid sm:grid-cols-2 gap-3">
                        {isItinerary ? (
                          <>
                            <Toggle label="Show day-by-day plan" checked={fields.showDayPlan ?? true} onChange={(v) => setField('showDayPlan', v)} />
                            <Toggle label="Show vehicle details" checked={fields.showVehicle ?? true} onChange={(v) => setField('showVehicle', v)} />
                            <Toggle label="Show hotel details" checked={fields.showHotels ?? true} onChange={(v) => setField('showHotels', v)} />
                            <Toggle label="Show price breakup" checked={fields.showPriceBreakup ?? true} onChange={(v) => setField('showPriceBreakup', v)} />
                            <Toggle label="Show inclusions" checked={fields.showInclusions ?? true} onChange={(v) => setField('showInclusions', v)} />
                            <Toggle label="Show exclusions" checked={fields.showExclusions ?? true} onChange={(v) => setField('showExclusions', v)} />
                            <Toggle label="Show contact footer band" checked={fields.showContactFooter ?? true} onChange={(v) => setField('showContactFooter', v)} />
                            <Toggle label="Show terms & conditions" checked={fields.showTerms ?? false} onChange={(v) => setField('showTerms', v)} />
                            <Toggle label="Show notes" checked={fields.showNotes ?? false} onChange={(v) => setField('showNotes', v)} />
                          </>
                        ) : (
                          <>
                            {docType === 'invoice' && <Toggle label="Show GST / tax breakup" checked={fields.showGst ?? true} onChange={(v) => setField('showGst', v)} />}
                            <Toggle label="Show payment / bank details" checked={fields.showBankDetails ?? true} onChange={(v) => setField('showBankDetails', v)} />
                            <Toggle label="Show UPI / QR placeholder" checked={fields.showQrCode ?? false} onChange={(v) => setField('showQrCode', v)} />
                            <Toggle label="Show authorised signatory" checked={fields.showSignatory ?? true} onChange={(v) => setField('showSignatory', v)} />
                            <Toggle label="Show terms & conditions" checked={fields.showTerms ?? true} onChange={(v) => setField('showTerms', v)} />
                            <Toggle label="Show notes" checked={fields.showNotes ?? true} onChange={(v) => setField('showNotes', v)} />
                            {docType === 'receipt' && <Toggle label='Show "PAID" stamp' checked={fields.showPaidStamp ?? true} onChange={(v) => setField('showPaidStamp', v)} />}
                          </>
                        )}
                      </div>
                    </Section>

                    {/* Payment details */}
                    {!isItinerary && (fields.showBankDetails ?? true) && (
                      <Section title="Payment details">
                        <div className="grid sm:grid-cols-2 gap-5">
                          <TextField label="Bank name" value={bank.name || ''} onChange={(v) => setBank('name', v)} />
                          <TextField label="Account number" value={bank.account || ''} onChange={(v) => setBank('account', v)} />
                          <TextField label="IFSC" value={bank.ifsc || ''} onChange={(v) => setBank('ifsc', v)} />
                          <TextField label="UPI ID" value={bank.upiId || ''} onChange={(v) => setBank('upiId', v)} />
                        </div>
                      </Section>
                    )}

                    {/* Text content */}
                    <Section title="Content">
                      {(fields.showTerms ?? true) && <TextArea label="Terms & conditions" value={content.termsText || ''} onChange={(v) => setContent('termsText', v)} />}
                      {(fields.showNotes ?? true) && <TextArea className="mt-4" label="Notes" value={content.notesText || ''} onChange={(v) => setContent('notesText', v)} />}
                      <TextField className="mt-4" label="Footer line (optional)" value={content.footerText || ''} onChange={(v) => setContent('footerText', v)} placeholder="e.g. This is a computer-generated document." />
                    </Section>
                  </div>
                )}

                {tab === 'preview' && (
                  <div className="absolute inset-0 overflow-y-auto bg-neutral-200/50 p-6 flex justify-center">
                    <div className="bg-white shadow-xl w-full max-w-[820px] min-h-[1080px] border border-neutral-200 shrink-0">
                      <iframe title="preview" sandbox="" srcDoc={previewHtml} className="w-full h-full min-h-[1080px] border-0" />
                    </div>
                  </div>
                )}

                {tab === 'code' && (
                  <div className="absolute inset-0 p-4 flex flex-col">
                    <p className="text-xs text-neutral-500 mb-2">Advanced: edit the Handlebars HTML directly. Variables: {`{{brand.*}}, {{agency.*}}, {{customer.*}}, {{doc.*}}, {{items}}, {{totals.*}}`}.</p>
                    <textarea value={active.htmlContent || ''} onChange={(e) => setActive({ ...active, htmlContent: e.target.value })}
                      className="flex-1 w-full p-4 font-mono text-[12px] border border-neutral-300 rounded-lg bg-neutral-900 text-green-400 resize-none" spellCheck="false" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-8 text-center">
              <SwatchIcon className="w-12 h-12 text-neutral-300 mb-3" />
              <h3 className="text-lg font-medium text-neutral-900 mb-1">No template selected</h3>
              <button onClick={createTemplate} className="mt-4 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg">Create your first template</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-base font-semibold text-neutral-900 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded border border-neutral-300 p-0.5 cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-md text-sm font-mono w-28" />
      </div>
      {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function TextArea({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[110px]" />
    </div>
  );
}

function Toggle({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex items-center gap-3 p-3 border border-neutral-200 rounded-lg bg-white cursor-pointer hover:border-blue-300 ${className}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-neutral-300 focus:ring-blue-500" />
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </label>
  );
}
