// FILE: /frontend/src/pages/reports/reportKit.jsx
//
// "The Founder's Brief" — shared editorial design system for Wayon reports.
// A calm, money-first, private-banking-statement aesthetic: warm paper canvas,
// hairline-ruled white cards, a Fraunces display serif for headlines and the
// figures that matter, Manrope for everything else. One confident accent
// (Wayon emerald) plus ink. No gradients, no rainbow KPI tiles.

import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ArrowUpRightIcon, ArrowDownRightIcon } from '@heroicons/react/20/solid';
import { formatCurrency } from '../../utils/formatters';
import { displayText } from '../../utils/displayText';

/* ───────────────────────── Palette ───────────────────────── */

export const INK = '#1c1916';
export const INK_SOFT = '#6b655c';
export const INK_FAINT = '#a8a299';
export const RULE = '#ece8e0';
export const EMERALD = '#0f8a6b';
export const EMERALD_BRAND = '#00a884';
export const CLAY = '#b4533a';
export const GOLD = '#b8862f';
export const SLATE = '#5b7c99';
export const PLUM = '#7c5a83';

// Sophisticated, muted chart series — deliberately not neon.
export const SERIES = [EMERALD, INK, GOLD, SLATE, CLAY, PLUM, '#3f9d82', '#9c8b6e'];

// Per-channel identity colors (used by the Channels / Instagram report).
export const CHANNEL_META = {
  instagram_ad: { label: 'Instagram', color: '#c1558b' },
  instagram: { label: 'Instagram', color: '#c1558b' },
  facebook_ad: { label: 'Facebook', color: '#3b5b92' },
  facebook: { label: 'Facebook', color: '#3b5b92' },
  whatsapp_organic: { label: 'WhatsApp', color: EMERALD },
  whatsapp: { label: 'WhatsApp', color: EMERALD },
  referral: { label: 'Referral', color: GOLD },
  qr_code: { label: 'QR Code', color: SLATE },
  website: { label: 'Website', color: PLUM },
  google: { label: 'Google', color: '#c0703a' },
  manual: { label: 'Manual', color: '#8a8278' },
  unknown: { label: 'Direct', color: '#8a8278' },
};

export function channelMeta(source) {
  const key = String(source || 'unknown').toLowerCase();
  return CHANNEL_META[key] || {
    label: displayText(source, 'Direct').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    color: '#8a8278',
  };
}

/* ───────────────────────── Formatters ───────────────────────── */

export { formatCurrency };

// Compact Indian-numbering currency for axes & dense figures (paise in).
export function fmtMoneyCompact(paise) {
  const r = Math.round((Number(paise) || 0) / 100);
  return `Rs ${compactNum(r)}`;
}

export function compactNum(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${(v / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${(v / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${v}`;
}

export function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('en-IN');
}

export function fmtPct(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0%';
  return `${v.toFixed(digits)}%`;
}

export function text(value, fallback = '—') {
  return displayText(value, fallback);
}

/* ───────────────────────── Primitives ───────────────────────── */

export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#a8a299] ${className}`}>
      {children}
    </p>
  );
}

// Change indicator — editorial, restrained (emerald up / clay down).
export function Delta({ value, suffix = '%', invert = false, className = '' }) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  const positive = invert ? v < 0 : v > 0;
  const negative = invert ? v > 0 : v < 0;
  const Icon = v > 0 ? ArrowUpRightIcon : v < 0 ? ArrowDownRightIcon : null;
  const color = positive ? 'text-[#0f8a6b]' : negative ? 'text-[#b4533a]' : 'text-[#a8a299]';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold nums ${color} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {Math.abs(v)}{suffix}
    </span>
  );
}

/**
 * Stat — the atom of the brief. A labelled figure set in Fraunces.
 * variant: 'default' | 'hero' | 'plain'
 */
export function Stat({ label, value, delta, deltaSuffix = '%', deltaInvert = false, sub, accent, variant = 'default', className = '' }) {
  const size = variant === 'hero'
    ? 'text-[44px] sm:text-[54px] leading-[0.95]'
    : variant === 'plain'
    ? 'text-[24px] leading-tight'
    : 'text-[28px] leading-[1.05]';
  return (
    <div className={className}>
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`font-brief nums mt-2.5 font-semibold tracking-[-0.01em] ${size}`}
        style={{ color: accent || INK }}
      >
        {value}
      </p>
      {(delta !== undefined || sub) && (
        <div className="mt-2 flex items-center gap-2">
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} />}
          {sub && <span className="text-[12px] font-medium text-[#a8a299]">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * StatCards — the KPI band. One cohesive statement strip divided by hairlines,
 * not a row of generic boxes. Stacks with horizontal rules on mobile.
 * items: [{ label, value, delta, deltaSuffix, deltaInvert, sub, accent }]
 */
export function StatCards({ items, className = '' }) {
  return (
    <div className={`brief-card flex flex-col divide-y divide-[#ece8e0] overflow-hidden rounded-[18px] sm:flex-row sm:divide-x sm:divide-y-0 ${className}`}>
      {items.map((it, i) => (
        <div key={i} className="brief-rise flex-1 p-5 sm:p-6" style={{ animationDelay: `${i * 50}ms` }}>
          <Stat
            label={it.label}
            value={it.value}
            delta={it.delta}
            deltaSuffix={it.deltaSuffix}
            deltaInvert={it.deltaInvert}
            sub={it.sub}
            accent={it.accent}
          />
        </div>
      ))}
    </div>
  );
}

// Generic card on paper.
export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`brief-card rounded-[18px] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * SectionCard — a titled panel. Title is set in the display serif.
 */
export function SectionCard({ title, eyebrow, description, action, children, className = '', bodyClassName = 'p-5 sm:p-6' }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-2.5 border-b border-[#ece8e0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
            {title && <h3 className="font-brief text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[#1c1916]">{title}</h3>}
            {description && <p className="mt-1 text-[13px] font-medium text-[#8a8278]">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </Card>
  );
}

// Subtle text "Export" action for section headers.
export function ExportButton({ onClick, label = 'Export' }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ece8e0] bg-[#fbfaf7] px-3.5 py-1.5 text-[12px] font-semibold text-[#6b655c] transition hover:border-[#d9d4c8] hover:text-[#1c1916]"
    >
      {label}
    </button>
  );
}

/* ───────────────────────── Editorial note ───────────────────────── */

const TONES = {
  positive: { dot: EMERALD, text: 'text-[#0f6a52]', bg: 'bg-[#f3f8f5]', ring: 'border-[#d6e8e0]' },
  warning: { dot: GOLD, text: 'text-[#8a6418]', bg: 'bg-[#fbf7ec]', ring: 'border-[#ece2c8]' },
  critical: { dot: CLAY, text: 'text-[#93412d]', bg: 'bg-[#fbf2ee]', ring: 'border-[#eccfc4]' },
  neutral: { dot: SLATE, text: 'text-[#46586a]', bg: 'bg-[#f4f6f8]', ring: 'border-[#d8e0e8]' },
};

export function Note({ tone = 'neutral', title, children, className = '' }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div className={`rounded-[14px] border ${t.ring} ${t.bg} px-4 py-3.5 ${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: t.dot }} />
        <div className="min-w-0">
          {title && <p className={`text-[13px] font-bold ${t.text}`}>{title}</p>}
          <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[#6b655c]">{children}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Distribution / funnel rows ───────────────────────── */

/**
 * BarRow — a label, a value, and a thin proportional bar. The workhorse for
 * pipelines, funnels, channel splits and rating distributions.
 */
export function BarRow({ label, value, pct, color = INK, meta, trailing }) {
  const width = Math.max(2, Math.min(100, pct ?? 0));
  return (
    <div className="group py-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 truncate text-[13px] font-semibold text-[#3a352e]">
          {meta?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />}
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="nums text-[13px] font-bold text-[#1c1916]">{value}</span>
          {trailing}
        </span>
      </div>
      <div className="h-[7px] w-full overflow-hidden rounded-full bg-[#f1ede4]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

// Numbered rank chip used in leaderboards.
export function Rank({ n }) {
  const top = n <= 3;
  const tone = n === 1 ? GOLD : n === 2 ? '#9b9489' : n === 3 ? '#b08a5a' : null;
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold nums ${top ? 'text-white' : 'bg-[#f1ede4] text-[#8a8278]'}`}
      style={top ? { background: tone } : undefined}
    >
      {n}
    </span>
  );
}

/* ───────────────────────── Charts ───────────────────────── */

export function ChartDefs() {
  return (
    <defs>
      <linearGradient id="briefArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={EMERALD} stopOpacity={0.18} />
        <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
      </linearGradient>
      <linearGradient id="briefAreaInk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={INK} stopOpacity={0.1} />
        <stop offset="100%" stopColor={INK} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

export const axisTick = { fontSize: 11, fill: '#a8a299', fontWeight: 600 };
export const gridProps = { strokeDasharray: '2 6', stroke: '#ece8e0', vertical: false };

export function BriefTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-[#ece8e0] bg-white/96 px-4 py-3 shadow-[0_12px_40px_-12px_rgba(28,25,20,0.25)] backdrop-blur" style={{ minWidth: 170 }}>
      {label !== undefined && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a8a299]">{text(label)}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
            <span className="text-[12.5px] text-[#8a8278]">{text(p.name)}</span>
            <span className="nums ml-auto text-[12.5px] font-bold text-[#1c1916]">
              {formatter ? formatter(p.value, p) : fmtNum(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Spark — a compact area/line trend for stat cards. data: [{ x, y }]
 */
export function Spark({ data, height = 44, color = EMERALD, type = 'area' }) {
  const id = useMemo(() => `sp_${Math.round((data?.[0]?.y || 0) + (data?.length || 0) * 7)}`, [data]);
  if (!data?.length) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'area' ? (
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

/* ───────────────────────── States ───────────────────────── */

export function Skeleton({ lines = 1, height = 320 }) {
  return (
    <div className="flex animate-[pulseSoft_2s_ease-in-out_infinite] items-center justify-center rounded-[14px] bg-[#f6f3ec]" style={{ height }}>
      <span className="text-[13px] font-medium text-[#bdb7ac]">Loading…</span>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="space-y-5">
      <div className="brief-card h-[132px] rounded-[18px]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="brief-card h-[300px] rounded-[18px]" />
        <div className="brief-card h-[300px] rounded-[18px]" />
      </div>
    </div>
  );
}

export function Empty({ message = 'No data for this period yet.', height = 200 }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-center" style={{ minHeight: height }}>
      <p className="font-brief text-[15px] text-[#bdb7ac]">{message}</p>
    </div>
  );
}

/* ───────────────────────── CSV ───────────────────────── */

export async function downloadCsv(analyticsApi, type, params) {
  try {
    const blob = await analyticsApi.exportCsv(type, params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wayon-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
  }
}
