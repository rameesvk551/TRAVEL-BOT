// FILE: /frontend/src/pages/hrm/AttendanceBoard.jsx

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { useAttendance, useEmployees, useMarkAttendance, useLeaves } from '../../api/hrm';
import {
  SectionCard, StatTile, Pill, Spinner, ATTENDANCE_STATUS, fmtTime, buildLeaveDateMap,
} from './hrmUi';
import AttendanceEditor from './AttendanceEditor';

const STATUS_OPTIONS = ['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AttendanceBoard() {
  const [date, setDate] = useState(todayStr());
  const { data: records, isLoading } = useAttendance({ date });
  const { data: employees } = useEmployees();
  const { data: approvedLeaves } = useLeaves('APPROVED');
  const mark = useMarkAttendance();
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    const byAgent = {};
    (records || []).forEach((r) => { byAgent[r.agentId] = r; });
    const leaveMap = buildLeaveDateMap(approvedLeaves, { byAgent: true });
    return (employees || [])
      .filter((e) => e.employeeProfile?.isActive !== false)
      .map((e) => ({ agent: e, rec: byAgent[e.id], leave: leaveMap[`${e.id}|${date}`] || null }));
  }, [records, employees, approvedLeaves, date]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, HALF_DAY: 0, ON_LEAVE: 0, notIn: 0 };
    rows.forEach(({ rec, leave }) => {
      const s = rec?.status || (leave ? 'ON_LEAVE' : null);
      if (s === 'PRESENT') c.PRESENT += 1;
      else if (s === 'HALF_DAY') c.HALF_DAY += 1;
      else if (s === 'ON_LEAVE') c.ON_LEAVE += 1;
      else c.notIn += 1; // marked absent or no punch yet
    });
    return c;
  }, [rows]);

  const setStatus = (agentId, status) => {
    mark.mutate(
      { agentId, date, status },
      { onSuccess: () => toast.success('Attendance updated'), onError: (e) => toast.error(e.response?.data?.error || 'Failed') }
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Present" value={counts.PRESENT} accent="green" />
        <StatTile label="Half day" value={counts.HALF_DAY} accent="amber" />
        <StatTile label="On leave" value={counts.ON_LEAVE} accent="indigo" />
        <StatTile label="Absent / not in" value={counts.notIn} accent="rose" />
      </div>

      <SectionCard
        title="Daily attendance"
        subtitle="Review punches and correct any day. Staff punch themselves; you can override here."
        actions={
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="shell-input-rect w-auto" />
        }
      >
        {isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  <th className="py-2.5 pr-3">Employee</th>
                  <th className="px-3 py-2.5">In</th>
                  <th className="px-3 py-2.5">Out</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Mark as</th>
                  <th className="py-2.5 pl-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map(({ agent, rec, leave }) => (
                  <tr key={agent.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-neutral-900">{agent.name}</p>
                      <p className="text-xs text-neutral-400">
                        {leave && !rec ? `On leave · ${leave.leaveType?.name || ''}` : (agent.employeeProfile?.designation || agent.email)}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-700">
                      {fmtTime(rec?.punchInAt)}
                      {rec?.isLate && <span className="ml-1 text-[10px] font-bold text-rose-500">late</span>}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-700">{fmtTime(rec?.punchOutAt)}</td>
                    <td className="px-3 py-3"><Pill map={ATTENDANCE_STATUS} status={rec?.status || (leave ? 'ON_LEAVE' : 'ABSENT')} /></td>
                    <td className="px-3 py-3 text-right">
                      <select
                        value={rec?.status || ''}
                        onChange={(e) => setStatus(agent.id, e.target.value)}
                        className="shell-input-rect w-auto py-1.5 text-xs"
                      >
                        <option value="" disabled>Set…</option>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS[s].label}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button onClick={() => setEditing({ agent, rec })} className="shell-button-ghost" title="Edit times & details">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400">No active employees. Add HR profiles under People.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <AttendanceEditor
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        agent={editing?.agent}
        date={date}
        record={editing?.rec}
      />
    </div>
  );
}
