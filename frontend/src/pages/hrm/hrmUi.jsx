// FILE: /frontend/src/pages/hrm/hrmUi.jsx
// Shared formatting helpers + UI primitives for the HRM module.

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/authStore';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function fmtMoney(value) {
  const n = Number(value || 0);
  return inrFmt.format(n);
}

export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Clickable "View on map" link for a captured punch location. Renders nothing
 * when no coordinates were recorded.
 */
export function PunchLocationLink({ lat, lng, accuracy, label = 'View on map' }) {
  if (lat == null || lng == null) return null;
  const href = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A884] hover:underline"
      title={accuracy != null ? `Accurate to ~${accuracy} m` : undefined}
    >
      <MapPinIcon className="h-3.5 w-3.5" />
      {label}
      {accuracy != null && <span className="font-normal text-neutral-400">±{accuracy}m</span>}
    </a>
  );
}

export function fmtDate(dateStr, opts = { day: 'numeric', month: 'short' }) {
  if (!dateStr) return '—';
  const d = dateStr.length === 10 ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
  return d.toLocaleDateString('en-IN', opts);
}

export function fmtMonthLabel(month) {
  if (!month) return '';
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Expand a list of leave requests into a { dateKey: leave } map.
 * Only APPROVED leaves are included. Optionally keys by `${agentId}|${date}`.
 */
export function buildLeaveDateMap(leaves, { byAgent = false } = {}) {
  const map = {};
  (leaves || []).forEach((lr) => {
    if (lr.status && lr.status !== 'APPROVED') return;
    let d = new Date(`${lr.startDate}T00:00:00`);
    const end = new Date(`${lr.endDate}T00:00:00`);
    while (d <= end) {
      const dateKey = toDateKey(d);
      map[byAgent ? `${lr.agentId}|${dateKey}` : dateKey] = lr;
      d = new Date(d.getTime() + 86400000);
    }
  });
  return map;
}

/**
 * Trigger a client-side CSV download. `columns` = [{ key, label }], `rows` = objects.
 */
export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function minutesToHours(min) {
  if (!min) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Present', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  HALF_DAY: { label: 'Half day', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ABSENT: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  ON_LEAVE: { label: 'On leave', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  WEEKLY_OFF: { label: 'Weekly off', cls: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
  HOLIDAY: { label: 'Holiday', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export const LEAVE_STATUS = {
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
};

export const PAYSLIP_STATUS = {
  DRAFT: { label: 'Draft', cls: 'bg-neutral-100 text-neutral-600 ring-neutral-200' },
  FINALIZED: { label: 'Finalized', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  PAID: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

export function Pill({ map, status, children }) {
  const meta = map?.[status] || { label: status, cls: 'bg-neutral-100 text-neutral-600 ring-neutral-200' };
  return (
    <span className={`badge ring-1 ${meta.cls}`} style={{ letterSpacing: '0.06em' }}>
      {children || meta.label}
    </span>
  );
}

/** Whether the current agent can manage HRM (admin functions). */
export function useHrmManage() {
  const agent = useAuthStore((s) => s.agent);
  if (!agent) return false;
  if (agent.role === 'ADMIN') return true;
  return Array.isArray(agent.permissions) && agent.permissions.includes('hrm.manage');
}

export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`shell-panel p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-bold tracking-tight text-neutral-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, accent = 'neutral', icon: Icon }) {
  const accents = {
    neutral: 'text-neutral-900',
    green: 'text-emerald-600',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="shell-panel flex items-center gap-3 p-4">
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="eyebrow truncate">{label}</p>
        <p className={`mt-1 text-xl font-extrabold tabular-nums leading-none ${accents[accent]}`}>{value}</p>
        {sub && <p className="mt-1 truncate text-xs text-neutral-400">{sub}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-neutral-300" />}
      <p className="mt-3 text-sm font-semibold text-neutral-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-neutral-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-neutral-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      {label}
    </div>
  );
}

/** Right-side slide-over panel (Headless UI). Full-width on mobile. */
export function SlideOver({ open, onClose, title, subtitle, children, footer, widthClass = 'max-w-md' }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-900/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-300" enterFrom="translate-x-full" enterTo="translate-x-0"
              leave="transform transition ease-in duration-200" leaveFrom="translate-x-0" leaveTo="translate-x-full"
            >
              <Dialog.Panel className={`flex h-full w-screen ${widthClass} flex-col bg-[#f8fafc] shadow-2xl`}>
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-white px-5 py-4">
                  <div>
                    <Dialog.Title className="text-base font-bold tracking-tight text-neutral-900">{title}</Dialog.Title>
                    {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
                  </div>
                  <button onClick={onClose} className="shell-button-ghost -mr-2 -mt-1 h-9 w-9 p-0">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
                {footer && <div className="border-t border-neutral-200 bg-white px-5 py-4">{footer}</div>}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
      {hint && <p className="mt-1.5 text-xs text-neutral-400">{hint}</p>}
    </label>
  );
}

export function WeekdayPicker({ value = [], onChange }) {
  const toggle = (d) => {
    const set = new Set(value);
    set.has(d) ? set.delete(d) : set.add(d);
    onChange([...set].sort((a, b) => a - b));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((label, idx) => {
        const active = value.includes(idx);
        return (
          <button
            type="button"
            key={idx}
            onClick={() => toggle(idx)}
            className={`h-9 w-11 rounded-lg text-xs font-bold transition ${
              active ? 'bg-neutral-900 text-white shadow-sm' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
