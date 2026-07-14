import { useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  PencilIcon,
  PhoneIcon,
  BanknotesIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { formatDateTime, formatTime, timeAgo } from '../utils/formatters';
import { getInitials } from './uiHelpers';

// Maps an event type to its dot icon + color. Kept in sync with the lead drawer
// timeline so both surfaces read identically.
function eventMeta(event = {}) {
  const type = String(event.type || '');
  if (type === 'lead_created') return { icon: <CheckCircleIcon className="h-4 w-4" />, dot: 'bg-emerald-100 text-emerald-600 ring-emerald-200' };
  if (type === 'message') {
    const isInbound = /received/i.test(event.title || '') || event.metaInbound;
    return { icon: isInbound ? 'IN' : 'OUT', dot: isInbound ? 'bg-sky-100 text-sky-600 ring-sky-200' : 'bg-violet-100 text-violet-600 ring-violet-200' };
  }
  if (type === 'follow_up') {
    const done = event.status === 'Done';
    return { icon: done ? <CheckCircleIcon className="h-4 w-4" /> : <CalendarDaysIcon className="h-4 w-4" />, dot: done ? 'bg-emerald-100 text-emerald-600 ring-emerald-200' : 'bg-indigo-100 text-indigo-600 ring-indigo-200' };
  }
  if (type === 'audit_log') return { icon: <ClockIcon className="h-4 w-4" />, dot: 'bg-indigo-50 text-indigo-500 ring-indigo-100' };
  if (type === 'note') return { icon: <PencilIcon className="h-4 w-4" />, dot: 'bg-amber-100 text-amber-600 ring-amber-200' };
  if (type === 'call') return { icon: <PhoneIcon className="h-4 w-4" />, dot: 'bg-amber-100 text-amber-600 ring-amber-200' };
  if (type === 'payment') return { icon: <BanknotesIcon className="h-4 w-4" />, dot: 'bg-emerald-100 text-emerald-600 ring-emerald-200' };
  if (type === 'booking') return { icon: <BriefcaseIcon className="h-4 w-4" />, dot: 'bg-sky-100 text-sky-600 ring-sky-200' };
  return { icon: <ClockIcon className="h-4 w-4" />, dot: 'bg-neutral-100 text-neutral-500 ring-neutral-200' };
}

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'note', label: 'Notes', match: (e) => e.type === 'note' },
  { key: 'follow_up', label: 'Follow-ups', match: (e) => e.type === 'follow_up' },
  { key: 'call', label: 'Calls', match: (e) => e.type === 'call' },
];

/**
 * A polished vertical "activity story" feed. Renders a single connected rail of
 * events (newest first) with actor avatars, relative time, and — when `grouped`
 * is set and events carry `enquiryId`/`enquiryLabel` — subtle dividers marking
 * where each enquiry began.
 */
export default function ActivityTimeline({ events = [], grouped = false, renderFooter, emptyText = 'No activity yet.' }) {
  const [filter, setFilter] = useState('all');

  // WhatsApp messages are surfaced in their own Messages tab, not in the timeline.
  const storyEvents = useMemo(() => events.filter((e) => e.type !== 'message'), [events]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
    return storyEvents.filter((e) => active.match(e));
  }, [storyEvents, filter]);

  const counts = useMemo(() => {
    const map = {};
    FILTERS.forEach((f) => { map[f.key] = storyEvents.filter((e) => f.match(e)).length; });
    return map;
  }, [storyEvents]);

  if (!storyEvents.length) {
    return (
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white py-12 text-center shadow-sm">
        <ClockIcon className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
        <div className="text-sm text-neutral-400">{emptyText}</div>
      </div>
    );
  }

  let lastEnquiryId = null;

  return (
    <div>
      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          const count = counts[f.key] || 0;
          if (f.key !== 'all' && count === 0) return null;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isActive ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 ring-1 ring-neutral-200 hover:text-neutral-800'
              }`}
            >
              {f.label}
              {f.key !== 'all' && <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-neutral-400'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-200 bg-white py-8 text-center text-sm text-neutral-400">
          No matching activity.
        </div>
      ) : (
        <div className="relative">
          {/* The continuous rail line */}
          <div className="absolute bottom-3 left-[15px] top-3 w-px bg-neutral-200" aria-hidden="true" />
          <div className="space-y-1">
            {visible.map((event, idx) => {
              const meta = eventMeta(event);
              const showDivider = grouped && event.enquiryId && event.enquiryId !== lastEnquiryId;
              if (event.enquiryId) lastEnquiryId = event.enquiryId;
              const isLast = idx === visible.length - 1;
              return (
                <div key={`${event.type}-${event.id}`}>
                  {showDivider && (
                    <div className="relative z-10 flex items-center gap-2 py-2 pl-9">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        Enquiry · {event.enquiryLabel}
                      </span>
                      {event.enquiryStatus && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{event.enquiryStatus}</span>
                      )}
                    </div>
                  )}
                  <TimelineRow event={event} meta={meta} isLast={isLast} renderFooter={renderFooter} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ event, meta, isLast, renderFooter }) {
  return (
    <div className="relative flex gap-3 pb-4">
      {/* Dot on the rail */}
      <div className="relative z-10 shrink-0">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white ${meta.dot} outline outline-2 outline-transparent`}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full">{meta.icon}</span>
        </div>
      </div>

      {/* Card */}
      <div className={`min-w-0 flex-1 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-3.5 shadow-sm ${isLast ? '' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <h4 className="min-w-0 flex-1 text-sm font-semibold text-neutral-800">{event.title}</h4>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-neutral-400" title={formatDateTime(event.time)}>
            {timeAgo(event.time)} · {formatTime(event.time)}
          </span>
        </div>

        {event.actor && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-[8px] font-bold text-neutral-500">
              {getInitials(event.actor, '?')}
            </span>
            <span className="text-[11px] font-semibold text-neutral-400">{event.actor}</span>
          </div>
        )}

        {event.description && (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-500">{event.description}</p>
        )}

        {event.note && event.note !== event.description && (
          <div className="mt-2.5 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{event.note}</p>
          </div>
        )}

        {(event.status || (event.metadata && event.metadata.length > 0)) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {event.status && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">{event.status}</span>
            )}
            {(event.metadata || []).map((item) => (
              <span key={item} className="rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-100">{item}</span>
            ))}
          </div>
        )}

        {renderFooter ? renderFooter(event) : null}
      </div>
    </div>
  );
}
