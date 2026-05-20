import React from 'react';
import { Check, Search, X, ChevronDown, ChevronRight, Package, Home, UserPlus, Image, Video, Plus, Send, Layers, Type } from 'lucide-react';

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
  getButtonActionKey, updateButtonAction, onDone
}) {
  const hasTemplateButtonActions = builderMode === 'cta' && ctaTemplateButtons.length > 0;
  const actionItemOptions = allCatalogRecords.filter((item) => ['PACKAGE', 'PROPERTY'].includes(item.itemType));

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

        {/* Description */}
        {builderMode === 'cta' && (
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
            {hasTemplateButtonActions ? (
              <div className="space-y-2">
                {duplicateCtaButtonLabels.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Duplicate quick-reply labels found. WhatsApp sends back button text, so make each quick reply unique before continuing.
                  </div>
                )}
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
                            <option value="">{hasSelectedPool ? 'Auto: show matching selected items' : 'Select an item or choose items below'}</option>
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
                      </div>
                    );
                  })}
                </div>
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
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {(formData.campaignSections || []).map(section => {
                  const Icon = section.itemType === 'PROPERTY' ? Home : section.itemType === 'CUSTOM_TRIP' ? UserPlus : Package;
                  const count = section.itemType === 'PACKAGE' ? selectedPackageRecords.length : section.itemType === 'PROPERTY' ? selectedPropertyRecords.length : 0;
                  return (
                    <button key={section.key} type="button"
                      onClick={() => updateSection(section.key, { enabled: !section.enabled, selectionMode: 'MANUAL', selectedItemIds: section.itemType === 'CUSTOM_TRIP' ? [] : section.selectedItemIds || [] })}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/60">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${section.enabled ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                        <p className="text-xs text-slate-400">{section.itemType === 'CUSTOM_TRIP' ? 'Opens custom-trip flow' : `${count} selected`}</p>
                      </div>
                      <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${section.enabled ? 'bg-slate-900' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${section.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Inline Package Picker */}
        {builderMode === 'cta' && packageSection.enabled && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Select Packages <span className="text-slate-300 normal-case">({selectedPackageRecords.length}/{activePackages.length})</span></p>
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Select Properties <span className="text-slate-300 normal-case">({selectedPropertyRecords.length}/{activeProperties.length})</span></p>
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
        {builderMode === 'carousel' && (
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
        getButtonActionKey={getButtonActionKey} updateButtonAction={updateButtonAction}
        onDone={onClose}
      />
    </BottomDrawer>
  );
}
