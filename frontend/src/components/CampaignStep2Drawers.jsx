import React from 'react';
import { Check, Search, X, ChevronDown, ChevronRight, Package, Home, UserPlus, Image, Video, Plus, Send, Layers, Type, Workflow } from 'lucide-react';
import CampaignFlowBinding from './CampaignFlowBinding';
import { templatesApi } from '../api/templatesApi';

// Per-card media upload — lets the agency replace a carousel card's catalog image
// with their own uploaded image/video. Meta requires one media type per carousel,
// so `mediaMode` (the campaign-level choice) fixes what can be uploaded.
function CardMediaUpload({ card, mediaMode, onUploaded }) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const isVideo = String(mediaMode || 'IMAGE').toUpperCase() === 'VIDEO';
  const accept = isVideo ? 'video/mp4,video/3gpp' : 'image/*';

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await templatesApi.uploadMedia(file);
      const url = res?.data?.url;
      if (!url) throw new Error('Upload failed');
      onUploaded({ mediaUrl: url, mediaName: file.name, mediaType: isVideo ? 'VIDEO' : 'IMAGE' });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400">
          {isVideo ? <Video className="h-3.5 w-3.5" /> : <Image className="h-3.5 w-3.5" />}
          <input type="file" accept={accept} onChange={handleChange} className="hidden" />
          {uploading ? 'Uploading…' : card?.mediaUrl ? `Replace ${isVideo ? 'video' : 'image'}` : `Upload ${isVideo ? 'video' : 'image'}`}
        </label>
        {card?.mediaUrl ? (
          <button type="button" onClick={() => onUploaded({ mediaUrl: '', mediaName: '', mediaType: null })} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-500" aria-label="Remove uploaded media">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {card?.mediaUrl ? <p className="truncate text-[11px] font-medium text-emerald-700">Using uploaded {card.mediaType === 'VIDEO' ? 'video' : 'image'}{card.mediaName ? `: ${card.mediaName}` : ''}</p> : null}
      {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

/* ── Reusable Bottom Drawer Shell ── */
function BottomDrawer({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex max-h-[82vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-drawer-up">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-base font-bold text-slate-900">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ── Template Picker Content ── */
export function TemplatePickerContent({ templates, templateSearch, setTemplateSearch, selectedId, onSelect, builderMode }) {
  const filtered = templates.filter(t => (t.displayName || t.name || '').toLowerCase().includes(templateSearch.toLowerCase()));
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Search templates..." className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-slate-400" />
        </div>
      </div>
      <div className="p-4 space-y-2 flex-1 overflow-y-auto">
        {filtered.length > 0 ? filtered.map(t => {
          const active = selectedId === t.id;
          const buttons = Array.isArray(t.buttons) ? t.buttons.length : 0;
          return (
            <button key={t.id} type="button" onClick={() => { onSelect(t); }}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${active ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-slate-100'}`}>
                <Send className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${active ? 'text-white' : 'text-slate-900'}`}>{t.displayName || t.name}</p>
                <p className={`text-xs mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>{buttons} buttons</p>
                <p className={`text-xs mt-1 line-clamp-2 ${active ? 'text-slate-200' : 'text-slate-500'}`}>{String(t.body || '').replace(/\{\{\d+\}\}/g, '{{name}}')}</p>
              </div>
              {active && <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-900"><Check className="h-3.5 w-3.5" strokeWidth={3} /></div>}
            </button>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">No approved templates found</div>
        )}
      </div>
    </div>
  );
}

/* ── Template Picker Drawer ── */
export function TemplatePickerDrawer({ open, onClose, templates, templateSearch, setTemplateSearch, selectedId, onSelect, builderMode }) {
  const filtered = templates.filter(t => (t.displayName || t.name || '').toLowerCase().includes(templateSearch.toLowerCase()));
  return (
    <BottomDrawer open={open} onClose={onClose} title={builderMode === 'carousel' ? 'Choose Carousel Template' : 'Choose CTA Template'} subtitle={`${filtered.length} approved templates`}>
      <TemplatePickerContent 
        templates={templates} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} 
        selectedId={selectedId} builderMode={builderMode}
        onSelect={(t) => { onSelect(t); onClose(); }} 
      />
    </BottomDrawer>
  );
}

/* ── Config Content ── */
export function ConfigContent({
  builderMode, formData, setFormData,
  selectedTemplate, activeSections, packageSection, propertySection, customTripSection,
  activePackages, activeProperties, selectedPackageRecords, selectedPropertyRecords,
  updateSection, toggleSectionItem, ctaNeedsFeaturedMedia, featuredCtaRecord,
  getCatalogItemMediaUrl, setShowMediaModal,
  selectMessageExperience, MESSAGE_EXPERIENCES, currentExperience,
  carouselItems, toggleCarouselItem, selectedCarouselRecords,
  ctaTemplateButtons = [], ctaProviderButtons = [], ctaButtonActions = {},
  ctaButtonActionOptions = [], ctaButtonActionLabels = {},
  duplicateCtaButtonLabels = [], selectedCtaCatalogRecords = [], allCatalogRecords = [],
  ctaFlowOptions = [],
  carouselCards = [], updateCarouselCard,
  onConfigureCampaignFlow, campaignFlowConfigured = false,
  onConfigureCarouselFlow, carouselFlowConfigured = false,
  carouselMode = 'CATALOG', setCarouselMode, addUploadCard, updateUploadCard, removeUploadCard, addUploadCardsFromFiles,
  carouselHasButtons = false,
  getButtonActionKey, updateButtonAction, onDone
}) {
  const hasTemplateButtonActions = builderMode === 'cta' && ctaTemplateButtons.length > 0;
  const actionItemOptions = allCatalogRecords.filter((item) => ['PACKAGE', 'PROPERTY'].includes(item.itemType));
  // Named template variables the campaign-creator fills (excludes per-recipient contact vars).
  const templateVariableMap = Array.isArray(selectedTemplate?.variableMap) ? selectedTemplate.variableMap : [];
  const templateStaticVariables = templateVariableMap.filter((entry) => entry && entry.source === 'STATIC' && entry.name);
  const humanizeVariableLabel = (name) => String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">

        {/* Media Type Toggle removed because it is handled in the main UI */}

        {/* Featured Media (CTA Image mode) */}
        {builderMode === 'cta' && ctaNeedsFeaturedMedia && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Header Image</p>
            <button onClick={() => setShowMediaModal(true)} className={`w-full rounded-2xl border-2 border-dashed p-4 text-center transition hover:border-slate-300 ${featuredCtaRecord ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}>
              {featuredCtaRecord ? (
                <div className="flex items-center gap-3">
                  <img src={getCatalogItemMediaUrl(featuredCtaRecord)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{featuredCtaRecord.name}</p>
                    <p className="text-xs text-slate-500">Tap to change</p>
                  </div>
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><Plus className="h-5 w-5 text-slate-500" /></div>
                  <p className="text-xs font-bold text-slate-600">Select header image</p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Header Video (CTA Video mode) — optional per-campaign override */}
        {builderMode === 'cta' && formData.mediaType === 'VIDEO' && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Header Video</p>
            <button onClick={() => setShowMediaModal(true)} className={`w-full rounded-2xl border-2 border-dashed p-4 text-center transition hover:border-slate-300 ${formData.ctaConfig?.featuredMediaUrl ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}>
              {formData.ctaConfig?.featuredMediaUrl ? (
                <div className="flex items-center gap-3">
                  <video src={formData.ctaConfig.featuredMediaUrl} className="h-14 w-14 rounded-xl object-cover" muted />
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{formData.ctaConfig?.featuredMediaName || 'Custom video'}</p>
                    <p className="text-xs text-slate-500">Tap to change · overrides template video</p>
                  </div>
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><Plus className="h-5 w-5 text-slate-500" /></div>
                  <p className="text-xs font-bold text-slate-600">Upload campaign video (optional)</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Max 16 MB · uses the template’s video if left empty</p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Template variables (named) — one labeled field per static variable */}
        {builderMode === 'cta' && templateStaticVariables.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Template Variables</p>
            <div className="space-y-3">
              {templateStaticVariables.map((variable) => (
                <label key={variable.name} className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">{humanizeVariableLabel(variable.name)}</span>
                  <textarea
                    rows={variable.name === 'description' ? 3 : 2}
                    value={formData.ctaConfig?.variableValues?.[variable.name] || ''}
                    onChange={e => setFormData(p => ({
                      ...p,
                      ctaConfig: {
                        ...(p.ctaConfig || {}),
                        variableValues: { ...(p.ctaConfig?.variableValues || {}), [variable.name]: e.target.value },
                      },
                    }))}
                    placeholder={`Value for {{${variable.name}}}`}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Contact variables (name, phone) fill automatically for each recipient.</p>
          </div>
        )}

        {/* Description (legacy positional {{2}} templates) */}
        {builderMode === 'cta' && templateStaticVariables.length === 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Campaign Description</p>
            <textarea rows={3} value={formData.ctaConfig?.description || ''}
              onChange={e => setFormData(p => ({ ...p, ctaConfig: { ...(p.ctaConfig || {}), description: e.target.value } }))}
              placeholder="Describe this campaign for the {{2}} placeholder..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white transition" />
          </div>
        )}

        {/* CTA Action Configuration */}
        {builderMode === 'cta' && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Action Buttons</p>
            {hasTemplateButtonActions && onConfigureCampaignFlow && (
              <button
                type="button"
                onClick={onConfigureCampaignFlow}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#008069]/30 bg-[#008069]/[0.04] px-4 py-3 text-left transition hover:bg-[#008069]/[0.08]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008069] text-white">
                  <Workflow className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">
                    {campaignFlowConfigured ? 'Edit campaign flow' : 'Configure flow'}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Build one flow with a starter node for each of the {ctaTemplateButtons.length} template buttons.
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#008069]" />
              </button>
            )}
            {hasTemplateButtonActions ? (
              <div className="space-y-2">
                {duplicateCtaButtonLabels.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Duplicate quick-reply labels found. WhatsApp sends back button text, so make each quick reply unique before continuing.
                  </div>
                )}
                {false && (
                <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {ctaTemplateButtons.map((button, index) => {
                    const key = getButtonActionKey?.(button, index) || `${button.text || button.title}-${index}`;
                    const current = ctaButtonActions[key] || {};
                    const action = current.action || '';
                    const allowedTypes = ctaButtonActionOptions.find((option) => option.value === action)?.itemTypes || [];
                    const itemOptions = actionItemOptions.filter((item) => allowedTypes.includes(item.itemType));
                    const needsItemPicker = ['VIEW_DETAILS', 'SEND_ITINERARY', 'CHECK_AVAILABILITY', 'TALK_TO_AGENT'].includes(action);
                    const hasSelectedPool = selectedCtaCatalogRecords.length > 0;
                    const selectedItemLabel = current.itemId
                      ? itemOptions.find((item) => item.itemType === current.itemType && item.id === current.itemId)?.name
                      : null;

                    return (
                      <div key={key} className="space-y-3 px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <Send className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{button.text || button.title || `Button ${index + 1}`}</p>
                            <p className="text-xs text-slate-400">{ctaButtonActionLabels[action] || 'Choose what this campaign should send next'}</p>
                          </div>
                        </div>
                        <select
                          value={action}
                          onChange={(event) => updateButtonAction?.(button, index, {
                            action: event.target.value,
                            itemType: null,
                            itemId: null,
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                        >
                          <option value="">Choose campaign action</option>
                          {ctaButtonActionOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {needsItemPicker && (
                          <select
                            value={current.itemId ? `${current.itemType}:${current.itemId}` : ''}
                            onChange={(event) => {
                              const [itemType, itemId] = String(event.target.value || '').split(':');
                              updateButtonAction?.(button, index, {
                                itemType: itemType || null,
                                itemId: itemId || null,
                              });
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                          >
                            <option value="">{hasSelectedPool ? 'Auto: show matching selected items' : 'Auto: show all active matching items'}</option>
                            {itemOptions.map((item) => (
                              <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>
                                {item.itemType === 'PROPERTY' ? 'Property' : 'Package'}: {item.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {needsItemPicker && selectedItemLabel && (
                          <p className="text-[11px] font-semibold text-emerald-600">Configured for {selectedItemLabel}</p>
                        )}
                        {action === 'OPEN_FLOW' && (
                          <CampaignFlowBinding
                            value={{ flowKind: current.flowKind, flowId: current.flowId, keyword: current.keyword }}
                            onChange={(next) => updateButtonAction?.(button, index, {
                              flowKind: next.flowKind,
                              flowId: next.flowId || null,
                              keyword: next.keyword || null,
                            })}
                          />
                        )}
                        {action === 'OPEN_URL' && (
                          <input
                            type="url"
                            inputMode="url"
                            value={current.url || ''}
                            onChange={(event) => updateButtonAction?.(button, index, { url: event.target.value })}
                            placeholder="https://example.com/landing"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
                {ctaProviderButtons.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Provider Buttons</p>
                    <div className="mt-2 space-y-1.5">
                      {ctaProviderButtons.map((button, index) => (
                        <div key={`${button.text || button.title}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700">{button.text || button.title || `Button ${index + 1}`}</span>
                          <span className="text-slate-400">{String(button.type || '').replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">This template has no buttons, so there's nothing to configure. Choose a template with buttons to build a flow.</p>
            )}
          </div>
        )}

        {/* Inline Package Picker */}
        {builderMode === 'cta' && packageSection.enabled && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Packages <span className="text-slate-300 normal-case">({selectedPackageRecords.length > 0 ? `${selectedPackageRecords.length}/${activePackages.length}` : `all ${activePackages.length} active`})</span>
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {activePackages.map(pkg => {
                const sel = (packageSection.selectedItemIds || []).includes(pkg.id);
                return (
                  <button key={pkg.id} type="button" onClick={() => toggleSectionItem('packages', pkg.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${sel ? 'border-slate-900 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    {pkg.imageUrl ? <img src={pkg.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><Package className="h-4 w-4 text-slate-400" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{pkg.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{(pkg.destinations || []).join(', ') || pkg.category || 'Package'}</p>
                    </div>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                      {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline Property Picker */}
        {builderMode === 'cta' && propertySection.enabled && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Properties <span className="text-slate-300 normal-case">({selectedPropertyRecords.length > 0 ? `${selectedPropertyRecords.length}/${activeProperties.length}` : `all ${activeProperties.length} active`})</span>
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {activeProperties.map(prop => {
                const sel = (propertySection.selectedItemIds || []).includes(prop.id);
                return (
                  <button key={prop.id} type="button" onClick={() => toggleSectionItem('properties', prop.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${sel ? 'border-slate-900 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    {prop.imageUrl ? <img src={prop.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><Home className="h-4 w-4 text-slate-400" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{prop.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{prop.location || prop.propertyType || 'Property'}</p>
                    </div>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                      {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Carousel Item Picker */}
        {/* Carousel source: catalog items vs free-form uploaded cards */}
        {builderMode === 'carousel' && setCarouselMode && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Carousel source</p>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 text-xs">
              {[{ k: 'CATALOG', l: 'From catalog' }, { k: 'UPLOAD', l: 'Upload media' }].map((o) => (
                <button key={o.k} type="button" onClick={() => setCarouselMode(o.k)}
                  className={`px-3 py-2 font-semibold transition ${carouselMode === o.k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            {carouselMode === 'UPLOAD' && <p className="mt-1.5 text-[11px] text-slate-400">Build cards by uploading your own images/videos — no packages needed.</p>}
          </div>
        )}

        {/* UPLOAD-mode: free-form cards (media + title + keyword + flow buttons) */}
        {builderMode === 'carousel' && carouselMode === 'UPLOAD' && addUploadCard && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Uploaded cards <span className="text-slate-300 normal-case">({(carouselCards || []).length}/10, 2-10 required)</span></p>
            {!carouselHasButtons && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">This template has no buttons, so there's nothing to open a flow. Pick a carousel template with buttons to configure flows.</p>
            )}
            {onConfigureCarouselFlow && carouselHasButtons && (carouselCards || []).length > 0 && (
              <button type="button" onClick={onConfigureCarouselFlow}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#008069]/30 bg-[#008069]/[0.04] px-4 py-3 text-left transition hover:bg-[#008069]/[0.08]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008069] text-white"><Workflow className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{carouselFlowConfigured ? 'Edit carousel flow' : 'Configure flow'}</span>
                  <span className="block text-[11px] text-slate-500">One flow with a starter node per button. Each tap knows which card it came from.</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#008069]" />
              </button>
            )}
            <div className="space-y-3">
              {(carouselCards || []).map((card, index) => {
                const buttons = Array.isArray(card.buttons) ? card.buttons : [];
                return (
                  <div key={card.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-slate-800">Card {index + 1}</p>
                      <button type="button" onClick={() => removeUploadCard(card.id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-500" aria-label="Remove card"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="mb-2">
                      <CardMediaUpload card={card} mediaMode={formData?.carouselConfig?.mediaMode} onUploaded={(media) => updateUploadCard(card.id, media)} />
                    </div>
                    <input value={card.title || ''} onChange={(e) => updateUploadCard(card.id, { title: e.target.value.slice(0, 120) })} placeholder="Card title" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069] mb-2" />
                    <textarea rows={2} value={card.body || ''} onChange={(e) => updateUploadCard(card.id, { body: e.target.value.slice(0, 1024) })} placeholder="Card text" className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069] mb-2" />
                    <input value={card.keyword || ''} onChange={(e) => updateUploadCard(card.id, { keyword: e.target.value.slice(0, 60) })} placeholder="Keyword (passed to flow as {campaign_keyword})" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069] mb-2" />
                    {/* Buttons are fixed by the approved template (same on every card);
                        their flow is set in one place via "Configure flow" above. */}
                    {carouselHasButtons && buttons.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Buttons (from template)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {buttons.map((button, i) => (
                            <span key={i} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{button.buttonText || `Button ${i + 1}`}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {(carouselCards || []).length < 10 && (
                <div className="flex gap-2">
                  <button type="button" onClick={addUploadCard} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400"><Plus className="h-4 w-4" />Add card</button>
                  {addUploadCardsFromFiles && (
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#008069]/40 bg-[#008069]/[0.03] px-3 py-3 text-sm font-semibold text-[#0b6b59] hover:border-[#008069]">
                      <Image className="h-4 w-4" />
                      Upload multiple
                      <input
                        type="file"
                        multiple
                        accept={(formData?.carouselConfig?.mediaMode || 'IMAGE') === 'VIDEO' ? 'video/mp4,video/3gpp' : 'image/*'}
                        onChange={(e) => { addUploadCardsFromFiles(e.target.files); e.target.value = ''; }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {builderMode === 'carousel' && carouselMode !== 'UPLOAD' && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Carousel Items <span className="text-slate-300 normal-case">({selectedCarouselRecords.length} selected, 2-10 required)</span></p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...activePackages.map(p => ({ ...p, _type: 'PACKAGE' })), ...activeProperties.map(p => ({ ...p, _type: 'PROPERTY' }))].map(item => {
                const sel = carouselItems.some(ci => ci.itemType === item._type && ci.itemId === item.id);
                const Icon = item._type === 'PROPERTY' ? Home : Package;
                return (
                  <button key={`${item._type}-${item.id}`} type="button" onClick={() => toggleCarouselItem(item._type, item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${sel ? 'border-slate-900 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><Icon className="h-4 w-4 text-slate-400" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{item._type === 'PROPERTY' ? (item.location || 'Property') : ((item.destinations || []).join(', ') || 'Package')}</p>
                    </div>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                      {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-image keyword + flow buttons (catalog carousel) */}
        {builderMode === 'carousel' && carouselMode !== 'UPLOAD' && selectedCarouselRecords.length > 0 && updateCarouselCard && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Per-image keyword & buttons <span className="text-slate-300 normal-case">(optional — up to 3 buttons that open a flow)</span></p>
            {onConfigureCarouselFlow && carouselHasButtons && selectedCarouselRecords.length > 0 && (
              <button
                type="button"
                onClick={onConfigureCarouselFlow}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#008069]/30 bg-[#008069]/[0.04] px-4 py-3 text-left transition hover:bg-[#008069]/[0.08]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008069] text-white">
                  <Workflow className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{carouselFlowConfigured ? 'Edit carousel flow' : 'Configure flow'}</span>
                  <span className="block text-[11px] text-slate-500">One flow with a starter node per button. Each tap knows which card it came from.</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#008069]" />
              </button>
            )}
            <div className="space-y-3">
              {selectedCarouselRecords.map((record) => {
                const card = (carouselCards || []).find((entry) => String(entry.itemId || entry.id || '') === String(record.id)) || {};
                const buttons = Array.isArray(card.buttons) ? card.buttons : [];
                const writeButtons = (next) => updateCarouselCard(record.id, record.itemType, {
                  buttons: next.map((btn, i) => ({ ...btn, buttonKey: `btn_${i + 1}`, action: 'OPEN_FLOW' })),
                });
                return (
                  <div key={`${record.itemType}-${record.id}`} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {(card.mediaType !== 'VIDEO' && (card.mediaUrl || record.imageUrl)) ? <img src={card.mediaUrl || record.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">{card.mediaType === 'VIDEO' ? <Video className="h-4 w-4 text-slate-400" /> : <Image className="h-4 w-4 text-slate-400" />}</div>}
                      <p className="truncate text-sm font-semibold text-slate-800">{record.name}</p>
                    </div>

                    <div className="mb-2">
                      <CardMediaUpload
                        card={card}
                        mediaMode={formData?.carouselConfig?.mediaMode}
                        onUploaded={(media) => updateCarouselCard(record.id, record.itemType, media)}
                      />
                    </div>

                    <input
                      value={card.keyword || ''}
                      onChange={(event) => updateCarouselCard(record.id, record.itemType, { keyword: event.target.value.slice(0, 60) })}
                      placeholder="Keyword for this image (passed to the flow as {campaign_keyword})"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069] mb-2"
                    />

                    <div className="space-y-3">
                      {buttons.map((button, index) => (
                        <div key={index} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              value={button.buttonText || ''}
                              onChange={(event) => writeButtons(buttons.map((b, i) => (i === index ? { ...b, buttonText: event.target.value.slice(0, 20) } : b)))}
                              placeholder="Button label (max 20 chars)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
                            />
                            <button type="button" onClick={() => writeButtons(buttons.filter((_, i) => i !== index))} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-500" aria-label="Remove button">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <CampaignFlowBinding
                            showKeyword={false}
                            value={{ flowKind: button.flowKind, flowId: button.flowId }}
                            onChange={(next) => writeButtons(buttons.map((b, i) => (i === index ? { ...b, flowKind: next.flowKind, flowId: next.flowId } : b)))}
                          />
                        </div>
                      ))}
                      {buttons.length < 3 && (
                        <button
                          type="button"
                          onClick={() => writeButtons([...buttons, { buttonText: 'Learn more', flowKind: 'GRAPH', flowId: '' }])}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add button
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Trip enabled note */}
        {builderMode === 'cta' && customTripSection.enabled && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Check className="h-4 w-4" strokeWidth={3} /></div>
            <p className="text-sm font-medium text-emerald-800">Custom Trip flow enabled</p>
          </div>
        )}

        {/* Done button (only visible if onDone is provided, i.e. in drawer mode) */}
        {onDone && (
          <div className="pt-2 shrink-0">
            <button type="button" onClick={onDone} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Config Drawer (description, media, CTA actions) ── */
export function ConfigDrawer({
  open, onClose, builderMode, formData, setFormData,
  selectedTemplate, activeSections, packageSection, propertySection, customTripSection,
  activePackages, activeProperties, selectedPackageRecords, selectedPropertyRecords,
  updateSection, toggleSectionItem, ctaNeedsFeaturedMedia, featuredCtaRecord,
  getCatalogItemMediaUrl, setShowMediaModal,
  selectMessageExperience, MESSAGE_EXPERIENCES, currentExperience,
  carouselItems, toggleCarouselItem, selectedCarouselRecords,
  ctaTemplateButtons = [], ctaProviderButtons = [], ctaButtonActions = {},
  ctaButtonActionOptions = [], ctaButtonActionLabels = {},
  duplicateCtaButtonLabels = [], selectedCtaCatalogRecords = [], allCatalogRecords = [],
  ctaFlowOptions = [],
  carouselCards = [], updateCarouselCard,
  onConfigureCampaignFlow, campaignFlowConfigured = false,
  onConfigureCarouselFlow, carouselFlowConfigured = false,
  carouselMode = 'CATALOG', setCarouselMode, addUploadCard, updateUploadCard, removeUploadCard, addUploadCardsFromFiles,
  carouselHasButtons = false,
  getButtonActionKey, updateButtonAction,
}) {
  return (
    <BottomDrawer open={open} onClose={onClose} title="Configure Content" subtitle="Set up media, description & actions">
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
        ctaButtonActions={ctaButtonActions} ctaButtonActionOptions={ctaButtonActionOptions}
        ctaButtonActionLabels={ctaButtonActionLabels} duplicateCtaButtonLabels={duplicateCtaButtonLabels}
        selectedCtaCatalogRecords={selectedCtaCatalogRecords} allCatalogRecords={allCatalogRecords}
        ctaFlowOptions={ctaFlowOptions}
        carouselCards={carouselCards} updateCarouselCard={updateCarouselCard}
        onConfigureCampaignFlow={onConfigureCampaignFlow} campaignFlowConfigured={campaignFlowConfigured}
        onConfigureCarouselFlow={onConfigureCarouselFlow} carouselFlowConfigured={carouselFlowConfigured}
        carouselMode={carouselMode} setCarouselMode={setCarouselMode} addUploadCard={addUploadCard} updateUploadCard={updateUploadCard} removeUploadCard={removeUploadCard} addUploadCardsFromFiles={addUploadCardsFromFiles}
        carouselHasButtons={carouselHasButtons}
        getButtonActionKey={getButtonActionKey} updateButtonAction={updateButtonAction}
        onDone={onClose}
      />
    </BottomDrawer>
  );
}
