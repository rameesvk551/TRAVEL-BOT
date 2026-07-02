import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/formatters';

// ---- formatting helpers -------------------------------------------------

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function unwrap(response, fallback) {
  return response?.data ?? fallback;
}

export function toPaise(value) {
  const numeric = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function money(value) {
  return formatCurrency(Number(value || 0));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function humanize(value) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

// ---- primitives ---------------------------------------------------------

export function Card({ children, className = '' }) {
  return <section className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm font-semibold text-neutral-500">
      {text}
    </div>
  );
}

export function Stat({ label, value, note, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-neutral-950 text-white',
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-sky-600 text-white',
    rose: 'bg-rose-600 text-white',
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-neutral-950">{value}</p>
          {note && <p className="mt-1 truncate text-xs text-neutral-500">{note}</p>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.neutral}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

// Dr/Cr balance badge. `paise` is signed natural balance (positive = on its native side).
export function DrCrBadge({ paise, type, bold = false, dim = false }) {
  const value = Number(paise || 0);
  if (!value) {
    return <span className={`tabular-nums text-sm ${dim ? 'text-neutral-300' : 'text-neutral-400'}`}>—</span>;
  }
  // Natural side: ASSET/EXPENSE positive = Dr; LIABILITY/EQUITY/REVENUE positive = Cr.
  const debitSide = ['ASSET', 'EXPENSE'].includes(type);
  const isDr = value > 0 ? debitSide : !debitSide;
  return (
    <span className={`tabular-nums text-sm ${bold ? 'font-extrabold' : 'font-semibold'} ${isDr ? 'text-sky-700' : 'text-emerald-700'}`}>
      {money(Math.abs(value))} <span className="text-[10px] font-bold uppercase opacity-60">{isDr ? 'Dr' : 'Cr'}</span>
    </span>
  );
}

// ---- tabs ---------------------------------------------------------------

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              isActive ? 'bg-neutral-950 text-white shadow-sm' : 'text-neutral-500 hover:bg-white hover:text-neutral-900'
            }`}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- slide-over panel ---------------------------------------------------

export function SlideOver({ open, title, subtitle, onClose, children, width = 'max-w-xl' }) {
  if (!open) return null;
  return (
    <Fragment>
      <div className="fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-sm" onClick={onClose} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full ${width} flex-col bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-neutral-950">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-neutral-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </Fragment>
  );
}

// ---- modal --------------------------------------------------------------

export function Modal({ open, title, onClose, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`mt-12 w-full ${width} rounded-2xl bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h3 className="text-lg font-extrabold text-neutral-950">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---- period picker ------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Resolve a period descriptor into { dateFrom, dateTo } ISO date strings (FY = Apr–Mar, India).
export function resolveRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (date) => date.toISOString().slice(0, 10);
  if (period.preset === 'today') {
    const d = iso(now);
    return { dateFrom: d, dateTo: d };
  }
  if (period.preset === 'month') {
    const yy = period.year ?? y;
    const mm = period.month ?? m;
    return { dateFrom: iso(new Date(yy, mm, 1)), dateTo: iso(new Date(yy, mm + 1, 0)) };
  }
  if (period.preset === 'fy') {
    const fyStartYear = m >= 3 ? y : y - 1;
    return { dateFrom: `${fyStartYear}-04-01`, dateTo: `${fyStartYear + 1}-03-31` };
  }
  return { dateFrom: period.dateFrom || undefined, dateTo: period.dateTo || undefined };
}

export function PeriodPicker({ value, onChange }) {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const presets = [
    { key: 'today', label: 'Today' },
    { key: 'month', label: 'Month' },
    { key: 'fy', label: 'FY' },
    { key: 'custom', label: 'Custom' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ ...value, preset: p.key })}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              value.preset === p.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'month' && (
        <Fragment>
          <select
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-semibold"
            value={value.month ?? now.getMonth()}
            onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
          >
            {MONTHS.map((label, idx) => <option key={label} value={idx}>{label}</option>)}
          </select>
          <select
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-semibold"
            value={value.year ?? now.getFullYear()}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          >
            {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </Fragment>
      )}
      {value.preset === 'custom' && (
        <Fragment>
          <input
            type="date"
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
            value={value.dateFrom || ''}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          />
          <span className="text-xs text-neutral-400">to</span>
          <input
            type="date"
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
            value={value.dateTo || ''}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          />
        </Fragment>
      )}
    </div>
  );
}

export const inputClass = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950';
export const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400';
export const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300';
export const ghostBtn = 'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50';
