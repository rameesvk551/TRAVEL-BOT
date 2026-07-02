// FILE: /frontend/src/pages/hrm/MySpace.jsx

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  ClockIcon,
  CalendarDaysIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  useMySpace, useMyTimesheet, useMyLeaves, useLeaveTypes,
  usePunch, useRequestLeave, useCancelMyLeave,
} from '../../api/hrm';
import {
  SectionCard, StatTile, Pill, EmptyState, Spinner, SlideOver, Field, PunchLocationLink,
  ATTENDANCE_STATUS, LEAVE_STATUS, WEEKDAYS,
  fmtMoney, fmtTime, fmtDate, fmtMonthLabel, currentMonthStr, minutesToHours, buildLeaveDateMap,
} from './hrmUi';

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center sm:text-left">
      <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-neutral-900 sm:text-5xl">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-500">
        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  );
}

function PunchCard({ today }) {
  const { punchIn, punchOut } = usePunch();
  const hasIn = Boolean(today?.punchInAt);
  const hasOut = Boolean(today?.punchOutAt);
  const busy = punchIn.isPending || punchOut.isPending;

  const doPunch = (which) => {
    const m = which === 'in' ? punchIn : punchOut;
    m.mutate(undefined, {
      onSuccess: () => toast.success(which === 'in' ? 'Punched in — have a great day!' : 'Punched out. See you tomorrow!'),
      onError: (e) => toast.error(e.response?.data?.error || e.message || 'Could not record punch'),
    });
  };

  return (
    <div className="shell-panel relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-100/70 to-transparent blur-2xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <LiveClock />
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {!hasIn && (
            <button
              onClick={() => doPunch('in')}
              disabled={busy}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00A884] px-7 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-[#019174] active:scale-[0.97] disabled:opacity-60"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              {busy ? 'Recording…' : 'Punch In'}
            </button>
          )}
          {hasIn && !hasOut && (
            <button
              onClick={() => doPunch('out')}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-7 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-neutral-800 active:scale-[0.97] disabled:opacity-60"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              {busy ? 'Recording…' : 'Punch Out'}
            </button>
          )}
          {hasIn && hasOut && (
            <div className="rounded-2xl bg-emerald-50 px-6 py-4 text-center ring-1 ring-emerald-200">
              <p className="text-sm font-bold text-emerald-700">Day complete ✓</p>
              <p className="mt-0.5 text-xs text-emerald-600">{minutesToHours(today.workedMinutes)} worked</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-5">
        <div>
          <p className="eyebrow">Punch In</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-neutral-900">
            {fmtTime(today?.punchInAt)}
            {today?.isLate && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                <ExclamationTriangleIcon className="h-3 w-3" /> Late
              </span>
            )}
          </p>
          <PunchLocationLink lat={today?.punchInLat} lng={today?.punchInLng} accuracy={today?.punchInAccuracy} />
        </div>
        <div>
          <p className="eyebrow">Punch Out</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{fmtTime(today?.punchOutAt)}</p>
          <PunchLocationLink lat={today?.punchOutLat} lng={today?.punchOutLng} accuracy={today?.punchOutAccuracy} />
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p className="mt-1">
            <Pill map={ATTENDANCE_STATUS} status={today?.status || 'ABSENT'} />
          </p>
        </div>
      </div>
    </div>
  );
}

function TimesheetCalendar() {
  const [month, setMonth] = useState(currentMonthStr());
  const { data, isLoading } = useMyTimesheet(month);

  const byDate = useMemo(() => {
    const map = {};
    (data?.attendance || []).forEach((a) => { map[a.date] = a; });
    return map;
  }, [data]);

  const leaveByDate = useMemo(() => buildLeaveDateMap(data?.leaves), [data]);
  const holidaySet = useMemo(() => new Set((data?.holidays || []).map((h) => h.date)), [data]);
  const weeklyOffSet = useMemo(() => new Set(data?.weeklyOffDays || []), [data]);

  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = currentMonthStr() === month
    ? `${month}-${String(new Date().getDate()).padStart(2, '0')}` : null;

  const shiftMonth = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const dotFor = (status) => ({
    PRESENT: 'bg-emerald-500', HALF_DAY: 'bg-amber-500', ABSENT: 'bg-rose-400',
    ON_LEAVE: 'bg-indigo-500', WEEKLY_OFF: 'bg-neutral-300', HOLIDAY: 'bg-sky-400',
  }[status] || 'bg-transparent');

  return (
    <SectionCard
      title="My timesheet"
      subtitle={fmtMonthLabel(month)}
      actions={
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="shell-button-ghost h-9 w-9 p-0"><ChevronLeftIcon className="h-4 w-4" /></button>
          <button onClick={() => shiftMonth(1)} className="shell-button-ghost h-9 w-9 p-0"><ChevronRightIcon className="h-4 w-4" /></button>
        </div>
      }
    >
      {isLoading ? <Spinner /> : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-neutral-400">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const dateStr = `${month}-${String(d).padStart(2, '0')}`;
              const weekday = new Date(y, m - 1, d).getDay();
              const rec = byDate[dateStr];
              const leave = !rec ? leaveByDate[dateStr] : null;
              const status = rec?.status
                || (leave ? 'ON_LEAVE' : null)
                || (holidaySet.has(dateStr) ? 'HOLIDAY' : null)
                || (weeklyOffSet.has(weekday) ? 'WEEKLY_OFF' : null);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={dateStr}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                    isToday ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                  title={leave ? `On leave · ${leave.leaveType?.name || ''}` : (status ? ATTENDANCE_STATUS[status]?.label : '')}
                >
                  <span className="font-semibold tabular-nums">{d}</span>
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${status ? dotFor(status) : 'bg-transparent'}`} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${dotFor(k)}`} /> {v.label}
              </span>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

function RequestLeaveForm({ open, onClose }) {
  const { data: types } = useLeaveTypes({ activeOnly: true });
  const requestLeave = useRequestLeave();
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', isHalfDay: false, reason: '' });

  useEffect(() => {
    if (open) setForm({ leaveTypeId: types?.[0]?.id || '', startDate: '', endDate: '', isHalfDay: false, reason: '' });
  }, [open, types]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      toast.error('Pick a leave type and dates');
      return;
    }
    const payload = { ...form, endDate: form.isHalfDay ? form.startDate : form.endDate };
    requestLeave.mutate(payload, {
      onSuccess: () => { toast.success('Leave request submitted'); onClose(); },
      onError: (e) => toast.error(e.response?.data?.error || 'Could not submit request'),
    });
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Request leave"
      subtitle="Your manager will be notified to approve"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="shell-button-secondary">Cancel</button>
          <button onClick={submit} disabled={requestLeave.isPending} className="shell-button-primary">
            {requestLeave.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Leave type">
          <select value={form.leaveTypeId} onChange={(e) => set('leaveTypeId', e.target.value)} className="shell-input-rect">
            {(types || []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.isPaid ? '' : ' (unpaid)'}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-3">
          <input type="checkbox" checked={form.isHalfDay} onChange={(e) => set('isHalfDay', e.target.checked)} className="h-4 w-4 rounded accent-neutral-900" />
          <span className="text-sm font-medium text-neutral-700">Half day</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="shell-input-rect" />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={form.isHalfDay ? form.startDate : form.endDate}
              min={form.startDate}
              disabled={form.isHalfDay}
              onChange={(e) => set('endDate', e.target.value)}
              className="shell-input-rect disabled:opacity-50"
            />
          </Field>
        </div>
        <Field label="Reason" hint="Optional, but helps your manager decide faster">
          <textarea rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} className="shell-input-rect resize-none" placeholder="e.g. Family function" />
        </Field>
      </div>
    </SlideOver>
  );
}

function LeaveBalances({ balances }) {
  if (!balances?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {balances.map((b) => (
        <div key={b.leaveTypeId} className="shell-panel p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
            <p className="truncate text-xs font-bold uppercase tracking-wide text-neutral-500">{b.code}</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-neutral-900">
            {b.balance === null ? '∞' : b.balance}
            {b.balance !== null && <span className="text-sm font-semibold text-neutral-400"> / {b.quota}</span>}
          </p>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{b.name}</p>
        </div>
      ))}
    </div>
  );
}

function MyLeaves({ onRequest }) {
  const { data: leaves, isLoading } = useMyLeaves();
  const cancel = useCancelMyLeave();

  return (
    <SectionCard
      title="My leave requests"
      actions={<button onClick={onRequest} className="shell-button-primary"><PlusIcon className="h-4 w-4" /> Request leave</button>}
    >
      {isLoading ? <Spinner /> : !leaves?.length ? (
        <EmptyState icon={CalendarDaysIcon} title="No leave requests yet" hint="Request time off and track approvals here." />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {leaves.map((lr) => (
            <li key={lr.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lr.leaveType?.color || '#999' }} />
                  <p className="truncate text-sm font-semibold text-neutral-900">{lr.leaveType?.name || 'Leave'}</p>
                  <Pill map={LEAVE_STATUS} status={lr.status} />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {fmtDate(lr.startDate)} → {fmtDate(lr.endDate)} · {Number(lr.dayCount)} day{Number(lr.dayCount) === 1 ? '' : 's'}
                  {lr.reason ? ` · ${lr.reason}` : ''}
                </p>
              </div>
              {lr.status === 'PENDING' && (
                <button
                  onClick={() => cancel.mutate(lr.id, { onSuccess: () => toast.success('Request cancelled') })}
                  className="shell-button-ghost text-rose-600"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export default function MySpace() {
  const { data, isLoading } = useMySpace();
  const [requestOpen, setRequestOpen] = useState(false);

  if (isLoading) return <Spinner label="Loading your space…" />;

  return (
    <div className="space-y-5">
      <PunchCard today={data?.today} />

      {data?.profile?.monthlySalary != null && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Designation" value={data.profile.designation || '—'} icon={ClockIcon} />
          <StatTile label="Department" value={data.profile.department || '—'} />
          <StatTile label="Monthly CTC" value={fmtMoney(data.profile.monthlySalary)} accent="green" />
          <StatTile label="Pending leaves" value={data.pendingLeaves} accent={data.pendingLeaves ? 'amber' : 'neutral'} />
        </div>
      )}

      <LeaveBalances balances={data?.balances} />

      <div className="grid gap-5 lg:grid-cols-2">
        <TimesheetCalendar />
        <MyLeaves onRequest={() => setRequestOpen(true)} />
      </div>

      <RequestLeaveForm open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
