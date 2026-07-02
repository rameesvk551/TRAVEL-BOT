import { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useUpdateFollowUp, useAddNote, useUpdateLead, useAddFollowUp } from '../hooks/useLeads';

const LEAD_STATUSES = [
  'PACKAGE_SEARCHED',
  'PACKAGE_INTERESTED',
  'CONTACTED',
  'CONVERTED',
  'LOST',
];

export default function CompleteFollowUpModal({ isOpen, onClose, followUp, lead, agentId }) {
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('');
  const [status, setStatus] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [nextNote, setNextNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  const updateFollowUp = useUpdateFollowUp();
  const addNote = useAddNote();
  const updateLead = useUpdateLead();
  const addFollowUp = useAddFollowUp();

  useEffect(() => {
    if (isOpen) {
      setNote('');
      setStatus(lead?.status || '');
      setScheduleNext(false);
      setNextDate('');
      setNextTime('');
      setNextNote('');
      setIsRecurring(false);
      setRecurringInterval('monthly');
      setRecurringEndDate('');
    }
  }, [isOpen, lead]);

  if (!isOpen || !followUp || !lead) return null;

  const isSubmitting = updateFollowUp.isPending || addNote.isPending || updateLead.isPending || addFollowUp.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!note.trim()) return;
    if (scheduleNext && !nextNote.trim()) return;

    try {
      // 1. Mark follow-up as Done. The completion note doubles as the outcome so
      //    the backend (which now requires one) always has something to record.
      await updateFollowUp.mutateAsync({
        id: lead.id,
        followUpId: followUp.id,
        data: { status: 'Done', outcome: outcome || note.trim() }
      });

      // 2. Update Lead Status if changed
      if (status !== lead.status) {
        await updateLead.mutateAsync({
          id: lead.id,
          data: { status }
        });
      }

      // 3. Add Note if provided
      if (note.trim()) {
        await addNote.mutateAsync({
          id: lead.id,
          data: { content: note.trim() }
        });
      }

      // 4. Schedule next follow-up if selected
      if (scheduleNext && nextDate && nextTime) {
        const scheduledAt = new Date(`${nextDate}T${nextTime}`).toISOString();
        await addFollowUp.mutateAsync({
          id: lead.id,
          data: {
            scheduledAt,
            note: nextNote.trim() || 'Follow-up',
            agentId: agentId || lead.assignedAgentId,
            isRecurring,
            recurringInterval: isRecurring ? recurringInterval : null,
            recurringEndDate: (isRecurring && recurringEndDate) ? new Date(`${recurringEndDate}T23:59:59`).toISOString() : null
          }
        });
      }

      onClose();
    } catch (error) {
      console.error('Error completing follow-up:', error);
      const message = error?.response?.data?.message || error?.message || 'An error occurred while completing the follow-up.';
      alert(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
            Complete Follow-up
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Outcome Select */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="shell-input-rect w-full"
              disabled={isSubmitting}
            >
              <option value="">— Select Outcome —</option>
              <option value="Left Voicemail">Left Voicemail</option>
              <option value="Connected">Connected</option>
              <option value="Requested Quote">Requested Quote</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Follow-up Scheduled">Follow-up Scheduled</option>
            </select>
          </div>

          {/* Note Input */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Completion Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened during this follow-up?"
              rows={3}
              className="shell-input-rect w-full"
              disabled={isSubmitting}
            />
          </div>

          {/* Status Change */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Update Lead Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="shell-input-rect w-full"
              disabled={isSubmitting}
            >
              <option value="">— No status —</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Next Follow-up Toggle */}
          <div className="border-t border-neutral-100 pt-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                disabled={isSubmitting}
              />
              <span className="text-sm font-semibold text-neutral-900">Schedule Next Follow-up</span>
            </label>
          </div>

          {/* Next Follow-up Details */}
          {scheduleNext && (
            <div className="space-y-4 rounded-xl bg-neutral-50 p-4 border border-neutral-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-500">Date</label>
                  <input
                    type="date"
                    required
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="shell-input-rect w-full bg-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-500">Time</label>
                  <input
                    type="time"
                    required
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="shell-input-rect w-full bg-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-500">Follow-up Note <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Call to check if they liked the proposal"
                  value={nextNote}
                  onChange={(e) => setNextNote(e.target.value)}
                  className="shell-input-rect w-full bg-white text-sm"
                  disabled={isSubmitting}
                />
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    disabled={isSubmitting}
                  />
                  <span className="text-xs font-semibold text-neutral-700">Make this recurring?</span>
                </label>
                {isRecurring && (
                  <div className="grid grid-cols-2 gap-3 mt-2 p-2 border border-neutral-200 rounded-lg bg-white">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-500">Interval</label>
                      <select
                        value={recurringInterval}
                        onChange={(e) => setRecurringInterval(e.target.value)}
                        className="shell-input-rect w-full bg-white text-sm"
                        disabled={isSubmitting}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-500">End Date (Optional)</label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="shell-input-rect w-full bg-white text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="shell-button-secondary h-11 px-6 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !note.trim() || (scheduleNext && (!nextDate || !nextTime || !nextNote.trim()))}
              className="shell-button-primary h-11 px-6 text-sm"
            >
              {isSubmitting ? 'Saving...' : 'Complete & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
