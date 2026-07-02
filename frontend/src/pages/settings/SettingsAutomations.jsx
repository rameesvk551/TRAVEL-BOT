import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation } from '@tanstack/react-query';
import client from '../../api/client';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function SettingsAutomations() {
  const { agency, updateAgency } = useAuthStore();
  const [form, setForm] = useState({
    autoReviewCollectionEnabled: agency?.autoReviewCollectionEnabled !== false,
    autoReviewDelayDays: agency?.autoReviewDelayDays ?? 2,
    followUpReminderEnabled: agency?.followUpReminderEnabled !== false,
    followUpReminderMinutes: agency?.followUpReminderMinutes ?? 30,
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Automations updated successfully.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update automations');
      setSuccess('');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    if (form.autoReviewCollectionEnabled !== (agency?.autoReviewCollectionEnabled !== false)) data.autoReviewCollectionEnabled = form.autoReviewCollectionEnabled;
    if (parseInt(form.autoReviewDelayDays, 10) !== (agency?.autoReviewDelayDays ?? 2)) data.autoReviewDelayDays = parseInt(form.autoReviewDelayDays, 10);
    if (form.followUpReminderEnabled !== (agency?.followUpReminderEnabled !== false)) data.followUpReminderEnabled = form.followUpReminderEnabled;
    if (parseInt(form.followUpReminderMinutes, 10) !== (agency?.followUpReminderMinutes ?? 30)) data.followUpReminderMinutes = parseInt(form.followUpReminderMinutes, 10);

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="shell-panel p-6">
        <div className="flex items-center gap-3 mb-8">
          <Cog6ToothIcon className="h-5 w-5 text-[#2d2d2d]" />
          <h2 className="text-xl font-extrabold text-slate-950">Automations</h2>
        </div>

        <div className="space-y-6">
          <div className="rounded-[20px] bg-slate-50 border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Auto Review Collection</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically ask customers for a review after their trip completes.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={form.autoReviewCollectionEnabled}
                  onChange={(e) => update('autoReviewCollectionEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
              </label>
            </div>
            
            {form.autoReviewCollectionEnabled && (
               <div className="mt-4 pt-4 border-t border-slate-200">
                 <label className="block text-sm font-semibold text-slate-700">Days to wait after return date</label>
                 <div className="flex items-center mt-2 gap-2">
                   <input 
                     type="number" 
                     min="0" 
                     max="30" 
                     value={form.autoReviewDelayDays}
                     onChange={(e) => update('autoReviewDelayDays', e.target.value)}
                     className="shell-input-rect w-24"
                   />
                   <span className="text-sm text-slate-500">days</span>
                 </div>
               </div>
            )}
          </div>

          <div className="rounded-[20px] bg-slate-50 border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Staff Follow-up Reminders</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">Automatically send WhatsApp notifications to assigned staff before a scheduled follow-up.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={form.followUpReminderEnabled}
                  onChange={(e) => update('followUpReminderEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d2d2d]"></div>
              </label>
            </div>
            
            {form.followUpReminderEnabled && (
               <div className="mt-4 pt-4 border-t border-slate-200">
                 <label className="block text-sm font-semibold text-slate-700">Offset minutes</label>
                 <div className="flex items-center mt-2 gap-2">
                   <input 
                     type="number" 
                     min="0" 
                     max="1440" 
                     value={form.followUpReminderMinutes}
                     onChange={(e) => update('followUpReminderMinutes', e.target.value)}
                     className="shell-input-rect w-24"
                   />
                   <span className="text-sm text-slate-500">minutes before follow-up</span>
                 </div>
               </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={updateMutation.isPending} className="shell-button">
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
