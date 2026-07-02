// FILE: /frontend/src/pages/hrm/LeaveApprovals.jsx

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckIcon, XMarkIcon, InboxIcon } from '@heroicons/react/24/outline';
import { useLeaves, useReviewLeave } from '../../api/hrm';
import { SectionCard, Pill, EmptyState, Spinner, LEAVE_STATUS, fmtDate } from './hrmUi';

const FILTERS = [['PENDING', 'Pending'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected'], ['', 'All']];

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export default function LeaveApprovals() {
  const [filter, setFilter] = useState('PENDING');
  const { data: leaves, isLoading } = useLeaves(filter);
  const review = useReviewLeave();

  const act = (lr, decision) => {
    review.mutate(
      { id: lr.id, decision: decision === 'APPROVED' ? 'approve' : 'reject' },
      {
        onSuccess: () => toast.success(decision === 'APPROVED' ? 'Leave approved' : 'Leave rejected'),
        onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
      }
    );
  };

  return (
    <SectionCard
      title="Leave approvals"
      subtitle="Approve or reject time-off requests from your team."
      actions={
        <div className="inline-flex rounded-[var(--radius-md)] bg-neutral-100 p-1">
          {FILTERS.map(([v, l]) => (
            <button
              key={v || 'all'}
              onClick={() => setFilter(v)}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${filter === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? <Spinner /> : !leaves?.length ? (
        <EmptyState icon={InboxIcon} title="Nothing here" hint={filter === 'PENDING' ? 'No pending requests — you’re all caught up.' : 'No requests in this view.'} />
      ) : (
        <ul className="space-y-3">
          {leaves.map((lr) => (
            <li key={lr.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{initials(lr.agent?.name)}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-900">{lr.agent?.name}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: lr.leaveType?.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: lr.leaveType?.color }} />
                      {lr.leaveType?.name}
                    </span>
                    <Pill map={LEAVE_STATUS} status={lr.status} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {fmtDate(lr.startDate)} → {fmtDate(lr.endDate)} · {Number(lr.dayCount)} day{Number(lr.dayCount) === 1 ? '' : 's'}
                    {lr.reason ? ` · “${lr.reason}”` : ''}
                  </p>
                </div>
              </div>
              {lr.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => act(lr, 'REJECTED')} disabled={review.isPending} className="shell-button-secondary text-rose-600">
                    <XMarkIcon className="h-4 w-4" /> Reject
                  </button>
                  <button onClick={() => act(lr, 'APPROVED')} disabled={review.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#00A884] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#019174] active:scale-[0.98]">
                    <CheckIcon className="h-4 w-4" /> Approve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
