import React, { useState, useEffect, useRef } from 'react';
import {
   X, Save, Copy, Eye, Edit3, MessageSquare, Image as ImageIcon,
   Trash2, Plus, GripVertical, Check, ExternalLink, Smartphone,
   Type, Hash, List, Info, AlertCircle, ArrowLeft, MoreVertical,
   Phone, Video, Send, CheckCheck, Upload
} from 'lucide-react';
import {
   useCreateTemplate,
   useUpdateTemplate,
   useUsePrebuiltTemplate,
   useDeleteTemplate,
   useSubmitTemplate
} from '../hooks/useTemplates';
import { templatesApi } from '../api/templatesApi';
import toast from 'react-hot-toast';

const normalizeQuickReplyLabel = (value = '') => String(value || '')
   .trim()
   .toLowerCase()
   .replace(/[^\p{L}\p{N}]+/gu, ' ')
   .replace(/\s+/g, ' ')
   .trim();

const hasDuplicateQuickReplyLabels = (buttons = []) => {
   const seen = new Set();
   return buttons.some((button) => {
      if (String(button.type || 'QUICK_REPLY').toUpperCase() !== 'QUICK_REPLY') return false;
      const label = normalizeQuickReplyLabel(button.text);
      if (!label) return false;
      if (seen.has(label)) return true;
      seen.add(label);
      return false;
   });
};

const extractPlaceholderIndexes = (text = '') => {
   const matches = String(text || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
   return [...new Set(matches
      .map((token) => Number(token.replace(/[^\d]/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0))]
      .sort((a, b) => a - b);
};

const VARIABLE_PRESETS = [
   { position: 1, label: 'Name', token: '{{1}}', sample: 'Rahul' },
   { position: 2, label: 'Trip Description', token: '{{2}}', sample: 'Kashmir 4N 5D - hotels, transfers, sightseeing, from Rs 39,999/person' },
   { position: 3, label: 'Trip Name', token: '{{3}}', sample: 'Kashmir Family Escape' },
   { position: 4, label: 'Agency Name', token: '{{4}}', sample: 'Wayon Travels' },
];

const normalizeSampleVariables = (value) => (Array.isArray(value) ? [...value] : []);

const sampleForPosition = (position) => (
   VARIABLE_PRESETS.find((preset) => preset.position === position)?.sample || `Sample ${position}`
);

const withCompleteBodyExamples = (data) => {
   const sampleVariables = normalizeSampleVariables(data.sampleVariables);
   extractPlaceholderIndexes(data.body).forEach((position) => {
      const index = position - 1;
      if (!String(sampleVariables[index] || '').trim()) {
         sampleVariables[index] = sampleForPosition(position);
      }
   });
   return { ...data, sampleVariables };
};

const stripButtonRoutes = (buttons = []) => (
   Array.isArray(buttons)
      ? buttons.map(({ route, action, routing, ...button }) => button)
      : []
);

const buildTemplatePayload = (data) => ({
   ...withCompleteBodyExamples(data),
   buttons: stripButtonRoutes(data.buttons),
   carouselCards: Array.isArray(data.carouselCards)
      ? data.carouselCards.map((card) => ({
         ...card,
         buttons: stripButtonRoutes(card.buttons),
      }))
      : [],
});

export default function TemplateDetailDrawer({
   template: initialTemplate,
   draftSeed,
   isOpen,
   onClose,
   isPrebuilt: initialIsPrebuilt,
   initialMode = 'view'
}) {
   const newCarouselCard = () => ({
      title: '',
      body: '',
      mediaType: 'IMAGE',
      mediaUrl: '',
      buttons: [
         { type: 'QUICK_REPLY', text: 'Enquiry' },
         { type: 'QUICK_REPLY', text: 'See Others' },
      ],
   });

   const [mode, setMode] = useState('view'); // 'view' or 'edit'
   const [uploadingMediaKey, setUploadingMediaKey] = useState(null);
   const [formData, setFormData] = useState({
      displayName: '',
      category: 'MARKETING',
      templateType: 'STANDARD',
      headerType: 'NONE',
      headerContent: '',
      body: '',
      footer: '',
      buttons: [],
      carouselCards: [],
      sampleVariables: [],
      icon: '💬',
      tags: []
   });

   const createMutation = useCreateTemplate();
   const updateMutation = useUpdateTemplate();
   const usePrebuiltMutation = useUsePrebuiltTemplate();
   const deleteMutation = useDeleteTemplate();
   const submitMutation = useSubmitTemplate();
   const bodyTextareaRef = useRef(null);

   useEffect(() => {
      if (initialTemplate) {
         setFormData({
            displayName: initialTemplate.displayName || '',
            category: initialTemplate.category || 'MARKETING',
            templateType: initialTemplate.templateType || 'STANDARD',
            headerType: initialTemplate.headerType || 'NONE',
            headerContent: initialTemplate.headerContent || '',
            body: initialTemplate.body || '',
            footer: initialTemplate.footer || '',
            buttons: initialTemplate.buttons || [],
            carouselCards: initialTemplate.carouselCards || [],
            sampleVariables: normalizeSampleVariables(initialTemplate.sampleVariables),
            icon: initialTemplate.icon || '????',
            tags: initialTemplate.tags || []
         });
         setMode(initialMode);
      } else {
         setFormData({
            displayName: draftSeed?.displayName || '',
            category: draftSeed?.category || 'MARKETING',
            templateType: draftSeed?.templateType || 'STANDARD',
            headerType: draftSeed?.headerType || 'NONE',
            headerContent: draftSeed?.headerContent || '',
            body: draftSeed?.body || '',
            footer: draftSeed?.footer || '',
            buttons: draftSeed?.buttons || [],
            carouselCards: draftSeed?.carouselCards || [],
            sampleVariables: normalizeSampleVariables(draftSeed?.sampleVariables),
            icon: draftSeed?.icon || '????',
            tags: draftSeed?.tags || []
         });
         setMode(initialMode || 'edit');
      }
   }, [draftSeed, initialMode, initialTemplate]);

   if (!isOpen) return null;

   const handleSave = async () => {
      if (!hasValidButtons) {
         toast.error('Add button text, URL values, phone numbers, and unique quick-reply labels before saving.');
         return;
      }
      try {
         const payload = buildTemplatePayload(formData);
         if (initialIsPrebuilt) {
            // "Use Template" flow: fork it
            await usePrebuiltMutation.mutateAsync({
               id: initialTemplate.id,
               data: payload
            });
         } else if (initialTemplate?.id) {
            // "Edit" flow: update existing
            await updateMutation.mutateAsync({
               id: initialTemplate.id,
               data: payload
            });
         } else {
            // "New" flow: create new
            await createMutation.mutateAsync(payload);
         }
         onClose();
      } catch (err) {
         console.error('Failed to save template:', err);
         toast.error(err.response?.data?.error || 'Failed to save template');
      }
   };

   const handleSubmitForApproval = async () => {
      if (!initialTemplate?.id || initialIsPrebuilt) return;
      if (!hasValidHeader) {
         toast.error('Add the required header text or media sample URL before submitting.');
         return;
      }
      if (!hasValidBodyExamples) {
         toast.error('Add sample values for the variables used in the body before submitting.');
         return;
      }
      if (!hasValidButtons) {
         toast.error('Add button text, URL values, phone numbers, and unique quick-reply labels before submitting.');
         return;
      }
      if (!hasValidCarouselCards) {
         toast.error('Carousel templates need 2 to 10 cards, and each card needs body text plus a valid public media URL.');
         return;
      }

      try {
         if (!initialIsPrebuilt && initialTemplate?.id && mode === 'edit') {
            await updateMutation.mutateAsync({
               id: initialTemplate.id,
               data: buildTemplatePayload(formData)
            });
         }
         await submitMutation.mutateAsync(initialTemplate.id);
         toast.success('Template submitted to Meta for approval');
         onClose();
      } catch (err) {
         console.error('Failed to submit template:', err);
         toast.error(err.response?.data?.error || 'Failed to submit template');
      }
   };

   const handleTemplateMediaUpload = async (file, target) => {
      if (!file) return;
      const isVideoTarget = target.type === 'header'
         ? String(formData.headerType || '').toUpperCase() === 'VIDEO'
         : String(formData.carouselCards[target.cardIndex]?.mediaType || '').toUpperCase() === 'VIDEO';

      if (isVideoTarget && !file.type.startsWith('video/')) {
         toast.error('Please upload a video file for this video template.');
         return;
      }
      if (!isVideoTarget && !file.type.startsWith('image/')) {
         toast.error('Please upload an image file for this image template.');
         return;
      }

      const uploadKey = target.type === 'header' ? 'header' : `card-${target.cardIndex}`;
      setUploadingMediaKey(uploadKey);
      try {
         const response = await templatesApi.uploadMedia(file);
         const url = response?.data?.url;
         if (!url) throw new Error('Upload did not return a media URL');

         if (target.type === 'header') {
            setFormData((current) => ({ ...current, headerContent: url }));
         } else {
            updateCarouselCard(target.cardIndex, { mediaUrl: url });
         }
         toast.success('Template media uploaded');
      } catch (err) {
         console.error('Failed to upload template media:', err);
         toast.error(err.response?.data?.error || 'Failed to upload template media');
      } finally {
         setUploadingMediaKey(null);
      }
   };

   const isPending = createMutation.isPending || updateMutation.isPending || usePrebuiltMutation.isPending || submitMutation.isPending || !!uploadingMediaKey;
   const isCarousel = String(formData.templateType || '').toUpperCase() === 'CAROUSEL';
   const setSampleVariable = (position, sample) => {
      setFormData((current) => {
         const sampleVariables = normalizeSampleVariables(current.sampleVariables);
         sampleVariables[position - 1] = sample;
         return { ...current, sampleVariables };
      });
   };
   const insertBodyVariable = (preset) => {
      let nextCursor = 0;
      setFormData((current) => {
         const body = String(current.body || '');
         const textarea = bodyTextareaRef.current;
         const start = textarea?.selectionStart ?? body.length;
         const end = textarea?.selectionEnd ?? start;
         const nextBody = `${body.slice(0, start)}${preset.token}${body.slice(end)}`;
         const sampleVariables = normalizeSampleVariables(current.sampleVariables);
         sampleVariables[preset.position - 1] = sampleVariables[preset.position - 1] || preset.sample;
         nextCursor = start + preset.token.length;
         return { ...current, body: nextBody, sampleVariables };
      });
      window.setTimeout(() => {
         bodyTextareaRef.current?.focus();
         bodyTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      }, 0);
   };
   const renderPreviewText = (text) => String(text || '').replace(/{{\s*(\d+)\s*}}/g, (_match, position) => {
      const index = Number(position) - 1;
      return formData.sampleVariables?.[index] || VARIABLE_PRESETS[index]?.sample || `Sample ${position}`;
   });
   const isValidHttpUrl = (value) => {
      try {
         const parsed = new URL(String(value || '').trim());
         return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (_err) {
         return false;
      }
   };
   const hasValidHeader = formData.headerType === 'NONE'
      || (formData.headerType === 'TEXT' && !!String(formData.headerContent || '').trim())
      || (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(formData.headerType || '').toUpperCase()) && !!String(formData.headerContent || '').trim());
   const hasValidButtons = !Array.isArray(formData.buttons) || formData.buttons.every((button) => {
      const type = String(button.type || 'QUICK_REPLY').toUpperCase();
      if (!String(button.text || '').trim()) return false;
      if (type === 'URL') return !!String(button.url || '').trim();
      if (type === 'PHONE_NUMBER') return !!String(button.phoneNumber || '').trim();
      return true;
   }) && !hasDuplicateQuickReplyLabels(formData.buttons);
   const bodyPlaceholderIndexes = extractPlaceholderIndexes(formData.body);
   const samplePresets = (bodyPlaceholderIndexes.length ? bodyPlaceholderIndexes : [1, 2])
      .map((position) => VARIABLE_PRESETS.find((preset) => preset.position === position) || {
         position,
         label: `Variable ${position}`,
         token: `{{${position}}}`,
         sample: `Sample ${position}`,
      });
   const hasValidBodyExamples = bodyPlaceholderIndexes.every((position) => {
      const value = formData.sampleVariables?.[position - 1];
      return String(value || sampleForPosition(position)).trim();
   });
   const hasValidCarouselCards = !isCarousel || (
      formData.carouselCards.length >= 2
      && formData.carouselCards.length <= 10
      && formData.carouselCards.every((card) => String(card.body || '').trim() && isValidHttpUrl(card.mediaUrl))
   );
   const canSave = !!formData.displayName
      && !!formData.body
      && hasValidHeader
      && hasValidButtons
      && hasValidCarouselCards;
   const canSubmit = !initialIsPrebuilt
      && initialTemplate?.id
      && ['DRAFT', 'REJECTED', 'PAUSED'].includes(initialTemplate.status)
      && canSave;

   const updateCarouselCard = (index, updates) => {
      setFormData((current) => ({
         ...current,
         carouselCards: current.carouselCards.map((card, idx) => (idx === index ? { ...card, ...updates } : card)),
      }));
   };

   const updateCarouselCardButton = (cardIndex, buttonIndex, updates) => {
      setFormData((current) => ({
         ...current,
         carouselCards: current.carouselCards.map((card, idx) => {
            if (idx !== cardIndex) return card;
            const buttons = (card.buttons || []).map((button, buttonIdx) =>
               buttonIdx === buttonIndex ? { ...button, ...updates } : button
            );
            return { ...card, buttons };
         }),
      }));
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-auto overflow-hidden">
         <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={onClose}
         />

         <aside className="relative flex h-full w-full transform flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-out md:max-w-4xl lg:max-w-5xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-4 sm:px-6">
               <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ring-1 ring-neutral-200 ${initialIsPrebuilt ? 'bg-indigo-50' : 'bg-neutral-50'}`}>
                     {formData.icon || '💬'}
                  </div>
                  <div>
                     <h2 className="text-lg font-bold text-neutral-900 leading-none">
                        {initialTemplate ? (mode === 'edit' ? `Edit Template` : formData.displayName) : 'New Template'}
                     </h2>
                     {initialIsPrebuilt && mode === 'view' && (
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1 block">Prebuilt Library</span>
                     )}
                     {!initialIsPrebuilt && initialTemplate?.status && (
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 block">{initialTemplate.status}</span>
                     )}
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  {mode === 'view' && !initialIsPrebuilt && (
                     <button
                        onClick={() => setMode('edit')}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                     >
                        <Edit3 className="w-5 h-5" />
                     </button>
                  )}
                  {mode === 'edit' && (
                     <button
                        onClick={() => setMode('view')}
                        disabled={!initialTemplate}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                     >
                        <Eye className="w-5 h-5" />
                     </button>
                  )}
                  <button
                     onClick={onClose}
                     className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-neutral-50/50 md:flex-row">
               {/* Main Form Section */}
               <div className={`flex-1 space-y-6 p-4 sm:p-6 ${mode === 'view' ? 'hidden md:block opacity-50 pointer-events-none' : ''}`}>
                  {isCarousel && (
                     <section className="space-y-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                           <div className="flex items-center gap-2">
                              <List className="w-4 h-4 text-neutral-400" />
                              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Carousel Cards</h3>
                           </div>
                           <button
                              onClick={() => setFormData({ ...formData, carouselCards: [...formData.carouselCards, newCarouselCard()].slice(0, 10) })}
                              disabled={formData.carouselCards.length >= 10}
                              className="p-1 px-2 text-[10px] bg-neutral-900 text-white rounded font-bold hover:bg-neutral-800 transition-colors disabled:opacity-40"
                           >
                              + Add Card
                           </button>
                        </div>

                        <div className="space-y-3">
                           {formData.carouselCards.map((card, idx) => (
                              <div key={idx} className="space-y-3 rounded-[var(--radius-md)] border border-neutral-100 bg-neutral-50 p-3">
                                 <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Card {idx + 1}</p>
                                    <button
                                       onClick={() => setFormData({ ...formData, carouselCards: formData.carouselCards.filter((_, cardIdx) => cardIdx !== idx) })}
                                       className="p-1 text-neutral-400 hover:text-rose-500"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                                 <input
                                    type="text"
                                    value={card.title || ''}
                                    onChange={e => updateCarouselCard(idx, { title: e.target.value })}
                                    placeholder="Card title, e.g. Bali Family Escape"
                                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none"
                                 />
                                 <textarea
                                    rows={3}
                                    value={card.body || ''}
                                    onChange={e => updateCarouselCard(idx, { body: e.target.value })}
                                    placeholder="Short package/property description"
                                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none resize-none"
                                 />
                                 <input
                                    type="url"
                                    value={card.mediaUrl || ''}
                                    onChange={e => updateCarouselCard(idx, { mediaUrl: e.target.value })}
                                    placeholder="Public image/video URL required by Meta"
                                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none"
                                 />
                                 <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-neutral-300 bg-white px-3 py-2 text-[11px] font-bold text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-900">
                                    <Upload className="h-3.5 w-3.5" />
                                    {uploadingMediaKey === `card-${idx}` ? 'Uploading...' : `Upload ${String(card.mediaType || 'IMAGE').toLowerCase()} sample`}
                                    <input
                                       type="file"
                                       accept={String(card.mediaType || '').toUpperCase() === 'VIDEO' ? 'video/*' : 'image/*'}
                                       className="hidden"
                                       disabled={!!uploadingMediaKey}
                                       onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          event.target.value = '';
                                          handleTemplateMediaUpload(file, { type: 'card', cardIndex: idx });
                                       }}
                                    />
                                 </label>
                                 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {(card.buttons || []).slice(0, 2).map((button, buttonIdx) => (
                                       <input
                                          key={buttonIdx}
                                          type="text"
                                          value={button.text || ''}
                                          onChange={e => updateCarouselCardButton(idx, buttonIdx, { text: e.target.value })}
                                          placeholder={buttonIdx === 0 ? 'Enquiry' : 'See Others'}
                                          className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none"
                                       />
                                    ))}
                                 </div>
                              </div>
                           ))}
                           {formData.carouselCards.length === 0 && (
                              <div className="text-center py-4 border-2 border-dashed border-neutral-200 rounded text-neutral-400 text-[11px] font-medium">
                                 Add 2 to 10 carousel cards with images.
                              </div>
                           )}
                        </div>
                     </section>
                  )}

                  <section className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <Type className="w-4 h-4 text-neutral-400" />
                        <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Template Basics</h3>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">Display Name</label>
                        <input
                           type="text"
                           value={formData.displayName}
                           onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                           placeholder="e.g., Booking Confirmation"
                           className="shell-input-rect bg-white"
                        />
                     </div>

                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                           <label className="block text-xs font-bold text-neutral-500 mb-1">Template Format</label>
                           <select
                              value={formData.templateType}
                              onChange={e => {
                                 const nextType = e.target.value;
                                 setFormData({
                                    ...formData,
                                    templateType: nextType,
                                    headerType: nextType === 'CAROUSEL' ? 'NONE' : formData.headerType,
                                    headerContent: nextType === 'CAROUSEL' ? '' : formData.headerContent,
                                    footer: nextType === 'CAROUSEL' ? '' : formData.footer,
                                    buttons: nextType === 'CAROUSEL' ? [] : formData.buttons,
                                    carouselCards: nextType === 'CAROUSEL' && formData.carouselCards.length === 0
                                       ? [newCarouselCard(), newCarouselCard()]
                                       : formData.carouselCards,
                                 });
                              }}
                              className="shell-input-rect bg-white"
                           >
                              <option value="STANDARD">Standard Message</option>
                              <option value="CAROUSEL">Carousel Cards</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-neutral-500 mb-1">Category</label>
                           <select
                              value={formData.category}
                              onChange={e => setFormData({ ...formData, category: e.target.value })}
                              className="shell-input-rect bg-white"
                           >
                              <option value="MARKETING">Marketing</option>
                              <option value="UTILITY">Utility</option>
                              <option value="AUTHENTICATION">Authentication</option>
                           </select>
                        </div>
                        {!isCarousel && (
                        <div>
                           <label className="block text-xs font-bold text-neutral-500 mb-1">Header Type</label>
                           <select
                              value={formData.headerType}
                              onChange={e => setFormData({ ...formData, headerType: e.target.value })}
                              className="shell-input-rect bg-white"
                           >
                              <option value="NONE">Text Only</option>
                              <option value="IMAGE">Image</option>
                              <option value="VIDEO">Video</option>
                              <option value="DOCUMENT">Document</option>
                              <option value="TEXT">Text Header</option>
                           </select>
                        </div>
                        )}
                     </div>

                     {!isCarousel && formData.headerType !== 'NONE' && (
                        <div>
                           <label className="block text-xs font-bold text-neutral-500 mb-1">
                              {formData.headerType === 'TEXT' ? 'Header Text' : 'Header Media Sample URL'}
                           </label>
                           <input
                              type={formData.headerType === 'TEXT' ? 'text' : 'url'}
                              value={formData.headerContent || ''}
                              onChange={e => setFormData({ ...formData, headerContent: e.target.value })}
                              placeholder={
                                 formData.headerType === 'TEXT'
                                    ? 'Short header text for Meta approval'
                                    : formData.headerType === 'VIDEO'
                                       ? 'Public video URL required by Meta'
                                       : formData.headerType === 'DOCUMENT'
                                          ? 'Public document URL required by Meta'
                                          : 'Public image URL required by Meta'
                              }
                              className="shell-input-rect bg-white"
                           />
                           {['IMAGE', 'VIDEO'].includes(String(formData.headerType || '').toUpperCase()) && (
                              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-900">
                                 <Upload className="h-4 w-4" />
                                 {uploadingMediaKey === 'header' ? 'Uploading...' : `Upload ${String(formData.headerType || '').toLowerCase()} sample`}
                                 <input
                                    type="file"
                                    accept={String(formData.headerType || '').toUpperCase() === 'VIDEO' ? 'video/*' : 'image/*'}
                                    className="hidden"
                                    disabled={!!uploadingMediaKey}
                                    onChange={(event) => {
                                       const file = event.target.files?.[0];
                                       event.target.value = '';
                                       handleTemplateMediaUpload(file, { type: 'header' });
                                    }}
                                 />
                              </label>
                           )}
                           <p className="mt-1 text-[11px] text-neutral-400">
                              {formData.headerType === 'TEXT'
                                 ? 'Meta needs header text when you choose a text header.'
                                 : 'Upload a tenant-specific sample file, or paste a public URL. We convert it to Meta media sample during approval.'}
                           </p>
                        </div>
                     )}
                  </section>

                  <section className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-neutral-400" />
                        <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Message Content</h3>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1 flex items-center justify-between">
                           <span>Body Message</span>
                           <span className="text-[10px] text-neutral-400 font-normal italic">Meta variables use numbered tokens</span>
                        </label>
                        <div className="mb-2 flex flex-wrap gap-2">
                           {VARIABLE_PRESETS.map((preset) => (
                              <button
                                 key={preset.token}
                                 type="button"
                                 onClick={() => insertBodyVariable(preset)}
                                 className="inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                                 title={`Insert ${preset.label}`}
                              >
                                 <Hash className="h-3 w-3" />
                                 {preset.token} {preset.label}
                              </button>
                           ))}
                        </div>
                        <textarea
                           ref={bodyTextareaRef}
                           rows={6}
                           value={formData.body}
                           onChange={e => setFormData({ ...formData, body: e.target.value })}
                           placeholder="Type your message here..."
                           className="shell-input-rect bg-white py-3 resize-none font-sans leading-relaxed"
                        />
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                           {samplePresets.map((preset) => (
                              <label key={preset.token} className="block">
                                 <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                    Sample for {preset.token} {preset.label}
                                 </span>
                                 <input
                                    type="text"
                                    value={formData.sampleVariables?.[preset.position - 1] || ''}
                                    onChange={(event) => setSampleVariable(preset.position, event.target.value)}
                                    placeholder={preset.sample}
                                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none"
                                 />
                              </label>
                           ))}
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">Footer Text (Optional)</label>
                        <input
                           type="text"
                           value={formData.footer}
                           onChange={e => setFormData({ ...formData, footer: e.target.value })}
                           className="shell-input-rect bg-white"
                        />
                     </div>
                  </section>

                  {!isCarousel && (
                  <section className="space-y-4">
                     <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                           <List className="w-4 h-4 text-neutral-400" />
                           <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Buttons</h3>
                        </div>
                        <button
                           onClick={() => setFormData({ ...formData, buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: '' }] })}
                           className="p-1 px-2 text-[10px] bg-neutral-900 text-white rounded font-bold hover:bg-neutral-800 transition-colors"
                        >
                           + Add Button
                        </button>
                     </div>

                     <div className="space-y-2">
                        {formData.buttons.map((btn, idx) => (
                           <div key={idx} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-neutral-100 bg-neutral-50 p-2 group sm:flex-row sm:items-center">
                              <div className="bg-neutral-100 p-2 rounded cursor-grab">
                                 <GripVertical className="w-3 h-3 text-neutral-400" />
                              </div>
                              <select
                                 value={btn.type}
                                 onChange={e => {
                                    const newBtns = [...formData.buttons];
                                    newBtns[idx].type = e.target.value;
                                    if (e.target.value !== 'URL') newBtns[idx].url = '';
                                    if (e.target.value !== 'PHONE_NUMBER') newBtns[idx].phoneNumber = '';
                                    delete newBtns[idx].route;
                                    delete newBtns[idx].action;
                                    delete newBtns[idx].routing;
                                    setFormData({ ...formData, buttons: newBtns });
                                 }}
                                 className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-0 sm:w-32"
                              >
                                 <option value="QUICK_REPLY">Quick Reply</option>
                                 <option value="URL">Visit Website</option>
                                 <option value="PHONE_NUMBER">Call Number</option>
                              </select>
                              <input
                                 type="text"
                                 value={btn.text}
                                 onChange={e => {
                                    const newBtns = [...formData.buttons];
                                    newBtns[idx].text = e.target.value;
                                    setFormData({ ...formData, buttons: newBtns });
                                 }}
                                 placeholder="Button Text"
                                 className="flex-1 bg-white border border-neutral-200 rounded px-3 py-1.5 text-xs focus:ring-0 focus:outline-none"
                              />
                              {btn.type === 'URL' && (
                                 <input
                                    type="url"
                                    value={btn.url || ''}
                                    onChange={e => {
                                       const newBtns = [...formData.buttons];
                                       newBtns[idx].url = e.target.value;
                                       setFormData({ ...formData, buttons: newBtns });
                                    }}
                                    placeholder="https://example.com/page"
                                    className="flex-1 bg-white border border-neutral-200 rounded px-3 py-1.5 text-xs focus:ring-0 focus:outline-none"
                                 />
                              )}
                              {btn.type === 'PHONE_NUMBER' && (
                                 <input
                                    type="text"
                                    value={btn.phoneNumber || ''}
                                    onChange={e => {
                                       const newBtns = [...formData.buttons];
                                       newBtns[idx].phoneNumber = e.target.value;
                                       setFormData({ ...formData, buttons: newBtns });
                                    }}
                                    placeholder="+91 9876543210"
                                    className="flex-1 bg-white border border-neutral-200 rounded px-3 py-1.5 text-xs focus:ring-0 focus:outline-none"
                                 />
                              )}
                              <button
                                 onClick={() => {
                                    const newBtns = formData.buttons.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, buttons: newBtns });
                                 }}
                                 className="p-2 text-neutral-400 hover:text-rose-500 rounded-lg group-hover:bg-rose-50 transition-colors"
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        ))}
                        {formData.buttons.length === 0 && (
                           <div className="text-center py-4 border-2 border-dashed border-neutral-200 rounded text-neutral-400 text-[11px] font-medium">
                              No buttons added yet.
                           </div>
                        )}
                     </div>
                  </section>
                  )}
               </div>

               {/* Preview Section */}
               <div className="flex w-full flex-col border-l border-neutral-100 bg-neutral-100/50 md:w-[280px] md:shrink-0 lg:w-[320px]">
                  <div className="h-full p-4 sm:p-6">
                     <div className="sticky top-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                           <Smartphone className="w-4 h-4 text-neutral-400" />
                           <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">WhatsApp Preview</h3>
                        </div>

                        {/* Phone Mockup */}
                        <div className="relative mx-auto flex aspect-[9/19.5] max-h-[560px] w-full max-w-[300px] origin-top scale-100 flex-col overflow-hidden rounded-[32px] border-[8px] border-neutral-900 bg-[#EFEAE2] shadow-2xl md:scale-[0.95]">
                           {/* Phone Notch */}
                           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-neutral-900 rounded-b-2xl z-30" />

                           {/* Status Bar */}
                           <div className="h-10 pt-6 px-7 flex justify-between items-center z-20">
                              <span className="text-[10px] font-bold text-neutral-900">12:30</span>
                              <div className="flex gap-1 items-center">
                                 <div className="w-3 h-3 rounded-full border border-neutral-900/20 flex items-center justify-center p-[1px]">
                                    <div className="w-full h-full bg-neutral-900 rounded-full" />
                                 </div>
                                 <div className="w-4 h-2 rounded-sm border border-neutral-900/20 relative">
                                    <div className="absolute left-0 top-0 h-full w-3/4 bg-neutral-900 rounded-sm" />
                                 </div>
                              </div>
                           </div>

                           {/* Chat Header */}
                           <div className="bg-[#f0f2f5] px-3 py-2 flex items-center gap-2 border-b border-neutral-200/50 z-20">
                              <ArrowLeft className="w-4 h-4 text-[#54656f]" />
                              <div className="w-8 h-8 rounded-full bg-neutral-300 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                 <h4 className="text-[12px] font-bold text-[#111b21] truncate">WhatsApp CRM</h4>
                                 <p className="text-[9px] text-[#667781]">online</p>
                              </div>
                              <div className="flex items-center gap-3 text-[#54656f] pr-1">
                                 <Video className="w-3.5 h-3.5" />
                                 <Phone className="w-3 h-3" />
                                 <MoreVertical className="w-3.5 h-3.5" />
                              </div>
                           </div>

                           {/* Chat Area with Wallpaper */}
                           <div className="flex-1 overflow-y-auto relative bg-[#efeae2] flex flex-col p-3 pt-4 custom-scrollbar">
                              {/* Wallpaper pattern (Subtle overlay) */}
                              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 4.878L59.905 0h-5.278l-5.278 4.878h5.277zM1.373 55.122L6.65 60H1.372l-5.277-4.878h5.278zM27 31.3l3-3 3 3-3 3-3-3zM3.373 4.878L8.65 0H3.372L-1.906 4.878h5.278zM56.627 55.122L61.905 60h-5.278l-5.278-4.878h5.277zM30 10.5l3-3 3 3-3 3-3-3zM30 52.5l3-3 3 3-3 3-3-3zM10.5 30l3-3 3 3-3 3-3-3zM52.5 30l3-3 3 3-3 3-3-3z' fill='%23000000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")` }}
                              />

                              {/* Date Pill */}
                              <div className="self-center bg-[#ffffff] px-2.5 py-1 rounded-md shadow-sm mb-4">
                                 <span className="text-[10px] text-[#54656f] font-medium uppercase">Today</span>
                              </div>

                              {/* Outgoing Message Bubble (using greenish color) */}
                              <div className="self-end max-w-[85%] relative mb-1 group">
                                 {/* Message Tail */}
                                 <div className="absolute -right-[6px] top-0 w-[12px] h-[12px] bg-[#dcf8c6] rotate-45 transform origin-top-left z-0"
                                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)' }} />

                                 <div className="bg-[#dcf8c6] rounded-[10px] rounded-tr-none shadow-sm relative z-10 overflow-hidden flex flex-col">
                                    {/* Header Media */}
                                    {!isCarousel && formData.headerType !== 'NONE' && (
                                       <div className="p-1 pb-0">
                                          <div className="bg-black/5 rounded-[8px] aspect-[16/9] flex items-center justify-center overflow-hidden border border-black/5">
                                             {formData.headerType === 'IMAGE' ? (
                                                formData.headerContent
                                                   ? <img src={formData.headerContent} alt="" className="h-full w-full object-cover" />
                                                   : <ImageIcon className="w-10 h-10 text-black/10" />
                                             ) : formData.headerType === 'VIDEO' ? (
                                                formData.headerContent ? (
                                                   <div className="relative h-full w-full bg-black/20">
                                                      <div className="absolute inset-0 flex items-center justify-center">
                                                         <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
                                                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white/80 border-b-[8px] border-b-transparent ml-1" />
                                                         </div>
                                                      </div>
                                                   </div>
                                                ) : (
                                                <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                                                   <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white/60 border-b-[8px] border-b-transparent ml-1" />
                                                </div>
                                                )
                                             ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                   <div className="w-10 h-10 bg-black/10 rounded flex items-center justify-center">
                                                      <List className="w-6 h-6 text-white/40" />
                                                   </div>
                                                   <span className="text-[10px] font-bold text-black/20 uppercase">{formData.headerType}</span>
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                    )}

                                    {/* Message Content */}
                                    <div className="p-2 pb-1 pr-6 min-w-[120px]">
                                       {/* Body */}
                                       <div className="text-[13px] text-[#111b21] whitespace-pre-wrap leading-[19px] break-words">
                                          {formData.body.split('\n').map((line, i) => (
                                             <React.Fragment key={i}>
                                                {line.split(/(\*.*?\*|_.*?_|~.*?~|`.*?`)/).map((part, j) => {
                                                   if (part.startsWith('*') && part.endsWith('*')) return <strong key={j}>{renderPreviewText(part.slice(1, -1))}</strong>;
                                                   if (part.startsWith('_') && part.endsWith('_')) return <em key={j}>{renderPreviewText(part.slice(1, -1))}</em>;
                                                   if (part.startsWith('~') && part.endsWith('~')) return <del key={j}>{renderPreviewText(part.slice(1, -1))}</del>;
                                                   if (part.startsWith('`') && part.endsWith('`')) return <code key={j} className="bg-black/5 px-1 rounded">{renderPreviewText(part.slice(1, -1))}</code>;
                                                   return renderPreviewText(part);
                                                })}
                                                {i < formData.body.split('\n').length - 1 && <br />}
                                             </React.Fragment>
                                          )) || <span className="text-black/20 italic">Type your message...</span>}
                                       </div>

                                       {/* Footer Text */}
                                       {formData.footer && (
                                          <div className="mt-1 text-[11px] text-[#667781]">
                                             {formData.footer}
                                          </div>
                                       )}

                                       {isCarousel && formData.carouselCards.length > 0 && (
                                          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                             {formData.carouselCards.slice(0, 4).map((card, idx) => (
                                                <div key={idx} className="w-32 flex-shrink-0 overflow-hidden rounded-[8px] border border-black/10 bg-white/70">
                                                   <div className="flex aspect-[4/3] items-center justify-center bg-black/5">
                                                      {card.mediaUrl ? (
                                                         <img src={card.mediaUrl} alt="" className="h-full w-full object-cover" />
                                                      ) : (
                                                         <ImageIcon className="w-6 h-6 text-black/20" />
                                                      )}
                                                   </div>
                                                   <div className="p-2">
                                                      <p className="truncate text-[11px] font-bold text-[#111b21]">{card.title || `Card ${idx + 1}`}</p>
                                                      <p className="mt-1 line-clamp-2 text-[10px] text-[#54656f]">{card.body || 'Card description'}</p>
                                                      <div className="mt-2 space-y-1">
                                                         {(card.buttons || []).slice(0, 2).map((button, buttonIdx) => (
                                                            <div key={buttonIdx} className="rounded border border-[#00a5f4]/20 px-1 py-0.5 text-center text-[9px] font-medium text-[#00a5f4]">
                                                               {button.text || (buttonIdx === 0 ? 'Enquiry' : 'See Others')}
                                                            </div>
                                                         ))}
                                                      </div>
                                                   </div>
                                                </div>
                                             ))}
                                          </div>
                                       )}

                                       {/* Time and Status */}
                                       <div className="flex justify-end items-center gap-1 mt-0.5 ml-auto">
                                          <span className="text-[10px] text-[#667781]">12:30 PM</span>
                                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                       </div>
                                    </div>

                                    {/* Interactive Buttons (Inside the bubble but at the bottom) */}
                                    {!isCarousel && formData.buttons.length > 0 && (
                                       <div className="border-t border-black/5 mt-1">
                                          {formData.buttons.map((btn, idx) => (
                                             <div
                                                key={idx}
                                                className={`py-2 px-4 text-center flex items-center justify-center gap-2 hover:bg-black/5 cursor-pointer transition-colors ${idx > 0 ? 'border-t border-black/5' : ''}`}
                                             >
                                                {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5 text-[#00a5f4]" />}
                                                {btn.type === 'PHONE_NUMBER' && <Phone className="w-3.5 h-3.5 text-[#00a5f4]" />}
                                                <span className="text-[13px] font-medium text-[#00a5f4] truncate">
                                                   {btn.text || (idx === 0 ? 'Primary Action' : 'Action')}
                                                </span>
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Input Area (Simulation) */}
                              <div className="mt-auto flex items-center gap-2 pt-4">
                                 <div className="flex-1 bg-white rounded-full px-4 py-2 shadow-sm flex items-center">
                                    <span className="text-[13px] text-[#667781]">Type a message</span>
                                 </div>
                                 <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center shadow-md">
                                    <Send className="w-5 h-5 text-white" />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="p-4 bg-white/50 backdrop-blur-md rounded-2xl border border-neutral-200/50 shadow-sm mt-auto space-y-2">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#53bdeb] animate-pulse" />
                              <h4 className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Live Preview Mode</h4>
                           </div>
                           <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                              This preview represents exactly how your template will appear to customers on WhatsApp.
                              Markdown formatting is supported.
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-white p-4 sm:p-6">
               {mode === 'edit' || initialIsPrebuilt ? (
                  <>
                     <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700 transition-colors"
                     >
                        Cancel
                     </button>
                     <button
                        onClick={handleSave}
                        disabled={isPending || !canSave}
                        className="flex-1 shell-button-primary py-2.5 flex items-center justify-center gap-2"
                     >
                        {isPending ? 'Saving...' : (
                           <>
                              {initialIsPrebuilt ? <Copy className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                              {initialIsPrebuilt ? 'Clone to My Library' : 'Save Template'}
                           </>
                        )}
                     </button>
                  </>
               ) : (
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                     <button
                        onClick={() => setMode('edit')}
                        disabled={initialTemplate?.status === 'PENDING'}
                        className="flex-1 shell-button-primary py-2.5 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                     >
                        <Edit3 className="w-4 h-4" />
                        Edit Template Content
                     </button>
                     {canSubmit && (
                        <button
                           onClick={handleSubmitForApproval}
                           disabled={isPending}
                           className="flex-1 rounded-[var(--radius-sm)] bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                           <Send className="w-4 h-4" />
                           {submitMutation.isPending ? 'Submitting...' : 'Submit to Meta'}
                        </button>
                     )}
                  </div>
               )}
            </div>
         </aside>
      </div>
   );
}
