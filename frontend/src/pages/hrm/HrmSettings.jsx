// FILE: /frontend/src/pages/hrm/HrmSettings.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  useHrmSettings, useSaveSettings, useLeaveTypes, useSaveLeaveType, useDeleteLeaveType,
  useHolidays, useSaveHoliday, useDeleteHoliday,
} from '../../api/hrm';
import { SectionCard, Field, WeekdayPicker, Spinner, fmtDate, currentMonthStr } from './hrmUi';

const BASIS = [
  ['WORKING', 'Working days (excl. offs & holidays)'],
  ['CALENDAR', 'Calendar days in month'],
  ['FIXED_30', 'Fixed 30 days'],
];

function WorkRules() {
  const { data, isLoading } = useHrmSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (data) setForm({
      workdayStartTime: data.workdayStartTime,
      graceMinutes: data.graceMinutes,
      fullDayMinutes: data.fullDayMinutes,
      halfDayMinutes: data.halfDayMinutes,
      defaultWeeklyOffDays: data.defaultWeeklyOffDays || [0],
      payrollDaysBasis: data.payrollDaysBasis,
      forcePunchIn: data.forcePunchIn !== false,
    });
  }, [data]);

  if (isLoading || !form) return <SectionCard title="Work rules"><Spinner /></SectionCard>;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => save.mutate(form, {
    onSuccess: () => toast.success('Settings saved'),
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <SectionCard
      title="Work rules"
      subtitle="Defines lateness, full/half-day thresholds and how payroll counts days."
      actions={<button onClick={submit} disabled={save.isPending} className="shell-button-primary">{save.isPending ? 'Saving…' : 'Save'}</button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workday start" hint="Punch-ins after this + grace are flagged late">
          <input type="time" value={form.workdayStartTime} onChange={(e) => set('workdayStartTime', e.target.value)} className="shell-input-rect" />
        </Field>
        <Field label="Grace period (minutes)">
          <input type="number" min="0" value={form.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value) || 0)} className="shell-input-rect" />
        </Field>
        <Field label="Full day (minutes worked)">
          <input type="number" min="0" value={form.fullDayMinutes} onChange={(e) => set('fullDayMinutes', Number(e.target.value) || 0)} className="shell-input-rect" />
        </Field>
        <Field label="Half day (minutes worked)">
          <input type="number" min="0" value={form.halfDayMinutes} onChange={(e) => set('halfDayMinutes', Number(e.target.value) || 0)} className="shell-input-rect" />
        </Field>
        <Field label="Payroll days basis">
          <select value={form.payrollDaysBasis} onChange={(e) => set('payrollDaysBasis', e.target.value)} className="shell-input-rect">
            {BASIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Default weekly offs" hint="Used when an employee has no custom offs">
          <WeekdayPicker value={form.defaultWeeklyOffDays} onChange={(v) => set('defaultWeeklyOffDays', v)} />
        </Field>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={form.forcePunchIn}
          onChange={(e) => set('forcePunchIn', e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-neutral-900"
        />
        <span>
          <span className="block text-sm font-semibold text-neutral-800">Force punch-in to use the app</span>
          <span className="block text-xs text-neutral-500">When on, employees must clock in (with location) before they can use the app on a working day. Turn off to make punching optional.</span>
        </span>
      </label>
    </SectionCard>
  );
}

function LeaveTypes() {
  const { data: types, isLoading } = useLeaveTypes();
  const save = useSaveLeaveType();
  const del = useDeleteLeaveType();
  const [draft, setDraft] = useState({ name: '', code: '', isPaid: true, annualQuota: 0, color: '#6366f1' });

  const add = () => {
    if (!draft.name || !draft.code) { toast.error('Name and code required'); return; }
    save.mutate(draft, {
      onSuccess: () => { toast.success('Leave type added'); setDraft({ name: '', code: '', isPaid: true, annualQuota: 0, color: '#6366f1' }); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
    });
  };

  return (
    <SectionCard title="Leave types" subtitle="Categories staff can request. Unpaid types reduce net pay.">
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {(types || []).filter((t) => t.isActive).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{t.name} <span className="text-xs font-medium text-neutral-400">({t.code})</span></p>
                  <p className="text-xs text-neutral-500">{t.isPaid ? 'Paid' : 'Unpaid'} · {Number(t.annualQuota) > 0 ? `${Number(t.annualQuota)} days/yr` : 'No quota'}</p>
                </div>
              </div>
              <button onClick={() => del.mutate(t.id, { onSuccess: () => toast.success('Removed') })} className="shell-button-ghost text-rose-500"><TrashIcon className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Add leave type</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_1fr_auto_auto]">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name e.g. Casual" className="shell-input-rect text-sm" />
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="CL" maxLength={20} className="shell-input-rect text-sm" />
          <input type="number" min="0" value={draft.annualQuota} onChange={(e) => setDraft({ ...draft, annualQuota: Number(e.target.value) || 0 })} placeholder="Days/yr" className="shell-input-rect text-sm" />
          <label className="flex items-center gap-2 px-1 text-sm font-medium text-neutral-600">
            <input type="checkbox" checked={draft.isPaid} onChange={(e) => setDraft({ ...draft, isPaid: e.target.checked })} className="h-4 w-4 rounded accent-neutral-900" /> Paid
          </label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-10 cursor-pointer rounded-lg border border-neutral-200" />
            <button onClick={add} disabled={save.isPending} className="shell-button-primary px-3"><PlusIcon className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function Holidays() {
  const year = new Date().getFullYear();
  const { data: holidays, isLoading } = useHolidays(year);
  const save = useSaveHoliday();
  const del = useDeleteHoliday();
  const [draft, setDraft] = useState({ date: '', name: '' });

  const add = () => {
    if (!draft.date || !draft.name) { toast.error('Date and name required'); return; }
    save.mutate(draft, {
      onSuccess: () => { toast.success('Holiday added'); setDraft({ date: '', name: '' }); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
    });
  };

  return (
    <SectionCard title={`Holiday calendar · ${year}`} subtitle="Excluded from absence and payroll deductions.">
      {isLoading ? <Spinner /> : (
        <div className="flex flex-wrap gap-2">
          {(holidays || []).map((h) => (
            <span key={h.id} className="group inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1.5 pl-3 pr-2 text-sm">
              <span className="font-semibold text-neutral-900">{fmtDate(h.date)}</span>
              <span className="text-neutral-500">{h.name}</span>
              <button onClick={() => del.mutate(h.id, { onSuccess: () => toast.success('Removed') })} className="rounded-full p-0.5 text-neutral-300 transition hover:bg-rose-50 hover:text-rose-500"><TrashIcon className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          {!holidays?.length && <p className="text-sm text-neutral-400">No holidays added for {year}.</p>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="shell-input-rect w-auto text-sm" />
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Holiday name" className="shell-input-rect flex-1 text-sm" />
        <button onClick={add} disabled={save.isPending} className="shell-button-primary"><PlusIcon className="h-4 w-4" /> Add</button>
      </div>
    </SectionCard>
  );
}

export default function HrmSettings() {
  return (
    <div className="space-y-5">
      <WorkRules />
      <LeaveTypes />
      <Holidays />
    </div>
  );
}
