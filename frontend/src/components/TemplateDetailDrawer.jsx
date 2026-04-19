import React, { useState, useEffect } from 'react';
import { 
  X, Save, Copy, Eye, Edit3, MessageSquare, Image as ImageIcon, 
  Trash2, Plus, GripVertical, Check, ExternalLink, Smartphone, 
  Type, Hash, List, Info, AlertCircle
} from 'lucide-react';
import { 
  useCreateTemplate, 
  useUpdateTemplate, 
  useUsePrebuiltTemplate, 
  useDeleteTemplate 
} from '../hooks/useTemplates';

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
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || usePrebuiltMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-auto overflow-hidden">
      <div 
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose} 
      />
      
      <aside className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white sticky top-0 z-10">
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col md:flex-row bg-neutral-50/50">
          {/* Main Form Section */}
          <div className={`flex-1 p-6 space-y-6 ${mode === 'view' ? 'hidden md:block opacity-50 pointer-events-none' : ''}`}>
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
                    onChange={e => setFormData({...formData, displayName: e.target.value})}
                    placeholder="e.g., Booking Confirmation"
                    className="shell-input-rect bg-white"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">Category</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
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
                        onChange={e => setFormData({...formData, headerType: e.target.value})}
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
                    onChange={e => setFormData({...formData, body: e.target.value})}
                    placeholder="Type your message here..."
                    className="shell-input-rect bg-white py-3 resize-none font-sans leading-relaxed"
                   />
                </div>

                <div>
                   <label className="block text-xs font-bold text-neutral-500 mb-1">Footer Text (Optional)</label>
                   <input 
                    type="text"
                    value={formData.footer}
                    onChange={e => setFormData({...formData, footer: e.target.value})}
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
                    onClick={() => setFormData({...formData, buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: '' }]})}
                    className="p-1 px-2 text-[10px] bg-neutral-900 text-white rounded font-bold hover:bg-neutral-800 transition-colors"
                  >
                    + Add Button
                  </button>
                </div>

                <div className="space-y-2">
                   {formData.buttons.map((btn, idx) => (
                      <div key={idx} className="flex gap-2 items-center group">
                         <div className="bg-neutral-100 p-2 rounded cursor-grab">
                            <GripVertical className="w-3 h-3 text-neutral-400" />
                         </div>
                         <select 
                            value={btn.type}
                            onChange={e => {
                               const newBtns = [...formData.buttons];
                               newBtns[idx].type = e.target.value;
                               setFormData({...formData, buttons: newBtns});
                            }}
                            className="w-32 bg-white border border-neutral-200 rounded px-2 py-1.5 text-xs focus:ring-0 focus:outline-none"
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
                               setFormData({...formData, buttons: newBtns});
                            }}
                            placeholder="Button Text"
                            className="flex-1 bg-white border border-neutral-200 rounded px-3 py-1.5 text-xs focus:ring-0 focus:outline-none"
                         />
                         <button 
                            onClick={() => {
                               const newBtns = formData.buttons.filter((_, i) => i !== idx);
                               setFormData({...formData, buttons: newBtns});
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
          <div className="w-full md:w-[280px] lg:w-[320px] bg-neutral-100/50 border-l border-neutral-100 flex flex-col">
             <div className="p-6 h-full">
                <div className="sticky top-6 flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-neutral-400" />
                    <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">WhatsApp Preview</h3>
                  </div>

                  {/* Phone Mockup */}
                  <div className="w-full aspect-[9/16] max-h-[500px] bg-[#E5DDD5] rounded-[24px] border-[8px] border-neutral-900 shadow-2xl relative overflow-hidden flex flex-col">
                     {/* Phone Notch */}
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-neutral-900 rounded-b-xl z-20" />
                     
                     <div className="flex-1 overflow-y-auto p-3 pt-6 space-y-4">
                        <div className="max-w-[90%] bg-white rounded-[12px] rounded-tl-none shadow-sm relative p-2 pt-1">
                           {/* Header */}
                           {formData.headerType !== 'NONE' && (
                              <div className="bg-neutral-100 rounded-[8px] aspect-video flex items-center justify-center mb-2 overflow-hidden border border-neutral-200/50">
                                 {formData.headerType === 'IMAGE' ? (
                                    <ImageIcon className="w-8 h-8 text-neutral-300" />
                                 ) : (
                                    <span className="text-[10px] font-bold text-neutral-400">HEADER {formData.headerType}</span>
                                 )}
                              </div>
                           )}

                           {/* Body */}
                           <div className="px-1 text-[13px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
                              {formData.body.replace(/{{[1-9]}}/g, '___') || <span className="text-neutral-300">Message body will appear here...</span>}
                           </div>

                           {/* Footer */}
                           {formData.footer && (
                              <div className="px-1 mt-2 text-[11px] text-neutral-400">
                                 {formData.footer}
                              </div>
                           )}

                           {/* Time */}
                           <div className="flex justify-end pr-1 mt-0.5">
                              <span className="text-[9px] text-neutral-400 uppercase">12:30 PM</span>
                           </div>
                        </div>

                        {/* Buttons Overlay */}
                        <div className="space-y-1.5 w-full">
                           {formData.buttons.map((btn, idx) => (
                              <div key={idx} className="w-full bg-white/95 backdrop-blur-sm rounded-lg py-2.5 text-center shadow-sm border-t border-neutral-100/50 flex items-center justify-center gap-2">
                                 {btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-[#00a5f4]" />}
                                 {btn.type === 'PHONE_NUMBER' && <Smartphone className="w-3 h-3 text-[#00a5f4]" />}
                                 <span className="text-[13px] font-semibold text-[#00a5f4]">{btn.text || (idx === 0 ? 'Primary Action' : 'Action')}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
                  
                  <div className="p-3 bg-neutral-900 rounded-xl text-white shadow-lg space-y-3 mt-auto">
                     <p className="text-[10px] text-neutral-400 font-medium leading-tight">
                        This is a visual preview. Actual appearance may vary on different devices.
                     </p>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-neutral-100 bg-white flex items-center justify-between gap-4">
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
              <button 
                onClick={() => setMode('edit')}
                className="w-full shell-button-primary py-2.5 flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Template Content
              </button>
           )}
        </div>
      </aside>
    </div>
  );
}
