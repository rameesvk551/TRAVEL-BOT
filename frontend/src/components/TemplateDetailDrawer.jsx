import React, { useState, useEffect } from 'react';
import {
   X, Save, Copy, Eye, Edit3, MessageSquare, Image as ImageIcon,
   Trash2, Plus, GripVertical, Check, ExternalLink, Smartphone,
   Type, Hash, List, Info, AlertCircle, ArrowLeft, MoreVertical,
   Phone, Video, Send, CheckCheck
} from 'lucide-react';
import {
   useCreateTemplate,
   useUpdateTemplate,
   useUsePrebuiltTemplate,
   useDeleteTemplate,
   useSubmitTemplate
} from '../hooks/useTemplates';
import toast from 'react-hot-toast';

export default function TemplateDetailDrawer({
   template: initialTemplate,
   isOpen,
   onClose,
   isPrebuilt: initialIsPrebuilt
}) {
   const [mode, setMode] = useState('view'); // 'view' or 'edit'
   const [formData, setFormData] = useState({
      displayName: '',
      category: 'MARKETING',
      headerType: 'NONE',
      body: '',
      footer: '',
      buttons: [],
      icon: '💬',
      tags: []
   });

   const createMutation = useCreateTemplate();
   const updateMutation = useUpdateTemplate();
   const usePrebuiltMutation = useUsePrebuiltTemplate();
   const deleteMutation = useDeleteTemplate();
   const submitMutation = useSubmitTemplate();

   useEffect(() => {
      if (initialTemplate) {
         setFormData({
            displayName: initialTemplate.displayName || '',
            category: initialTemplate.category || 'MARKETING',
            headerType: initialTemplate.headerType || 'NONE',
            body: initialTemplate.body || '',
            footer: initialTemplate.footer || '',
            buttons: initialTemplate.buttons || [],
            icon: initialTemplate.icon || '💬',
            tags: initialTemplate.tags || []
         });
         // If it's prebuilt and we want to "Use Template", we start in edit mode
         // If we clicked "Preview", we start in view mode
         // If we clicked "Edit", we start in edit mode
         // This is handled by the parent passing the template
      } else {
         // New template mode
         setFormData({
            displayName: '',
            category: 'MARKETING',
            headerType: 'NONE',
            body: '',
            footer: '',
            buttons: [],
            icon: '💬',
            tags: []
         });
         setMode('edit');
      }
   }, [initialTemplate]);

   if (!isOpen) return null;

   const handleSave = async () => {
      try {
         if (initialIsPrebuilt) {
            // "Use Template" flow: fork it
            await usePrebuiltMutation.mutateAsync({
               id: initialTemplate.id,
               data: formData
            });
         } else if (initialTemplate?.id) {
            // "Edit" flow: update existing
            await updateMutation.mutateAsync({
               id: initialTemplate.id,
               data: formData
            });
         } else {
            // "New" flow: create new
            await createMutation.mutateAsync(formData);
         }
         onClose();
      } catch (err) {
         console.error('Failed to save template:', err);
         toast.error(err.response?.data?.error || 'Failed to save template');
      }
   };

   const handleSubmitForApproval = async () => {
      if (!initialTemplate?.id || initialIsPrebuilt) return;

      try {
         await submitMutation.mutateAsync(initialTemplate.id);
         toast.success('Template submitted to Meta for approval');
         onClose();
      } catch (err) {
         console.error('Failed to submit template:', err);
         toast.error(err.response?.data?.error || 'Failed to submit template');
      }
   };

   const isPending = createMutation.isPending || updateMutation.isPending || usePrebuiltMutation.isPending || submitMutation.isPending;
   const canSubmit = !initialIsPrebuilt && initialTemplate?.id && ['DRAFT', 'REJECTED', 'PAUSED'].includes(initialTemplate.status);

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-auto overflow-hidden">
         <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={onClose}
         />

         <aside className="relative flex h-full w-full transform flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ease-out md:max-w-2xl">
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
                     </div>
                  </section>

                  <section className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-neutral-400" />
                        <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Message Content</h3>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1 flex items-center justify-between">
                           <span>Body Message</span>
                           <span className="text-[10px] text-neutral-400 font-normal italic">Use {'{{1}}'}, {'{{2}}'} for variables</span>
                        </label>
                        <textarea
                           rows={6}
                           value={formData.body}
                           onChange={e => setFormData({ ...formData, body: e.target.value })}
                           placeholder="Type your message here..."
                           className="shell-input-rect bg-white py-3 resize-none font-sans leading-relaxed"
                        />
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
               </div>

               {/* Preview Section */}
               <div className="flex w-full flex-col border-l border-neutral-100 bg-neutral-100/50 md:w-[280px] lg:w-[320px]">
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
                                    {formData.headerType !== 'NONE' && (
                                       <div className="p-1 pb-0">
                                          <div className="bg-black/5 rounded-[8px] aspect-[16/9] flex items-center justify-center overflow-hidden border border-black/5">
                                             {formData.headerType === 'IMAGE' ? (
                                                <ImageIcon className="w-10 h-10 text-black/10" />
                                             ) : formData.headerType === 'VIDEO' ? (
                                                <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                                                   <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-white/60 border-b-[8px] border-b-transparent ml-1" />
                                                </div>
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
                                                   if (part.startsWith('*') && part.endsWith('*')) return <strong key={j}>{part.slice(1, -1)}</strong>;
                                                   if (part.startsWith('_') && part.endsWith('_')) return <em key={j}>{part.slice(1, -1)}</em>;
                                                   if (part.startsWith('~') && part.endsWith('~')) return <del key={j}>{part.slice(1, -1)}</del>;
                                                   if (part.startsWith('`') && part.endsWith('`')) return <code key={j} className="bg-black/5 px-1 rounded">{part.slice(1, -1)}</code>;
                                                   return part.replace(/{{[1-9]}}/g, '___');
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

                                       {/* Time and Status */}
                                       <div className="flex justify-end items-center gap-1 mt-0.5 ml-auto">
                                          <span className="text-[10px] text-[#667781]">12:30 PM</span>
                                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                       </div>
                                    </div>

                                    {/* Interactive Buttons (Inside the bubble but at the bottom) */}
                                    {formData.buttons.length > 0 && (
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
                        disabled={isPending || !formData.displayName || !formData.body}
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
