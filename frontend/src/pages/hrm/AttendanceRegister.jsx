// FILE: /frontend/src/pages/hrm/AttendanceRegister.jsx

import { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useAttendance, useEmployees, useHolidays, useHrmSettings, useLeaves } from '../../api/hrm';
import { SectionCard, Spinner, WEEKDAYS, fmtMonthLabel, currentMonthStr, buildLeaveDateMap } from './hrmUi';
import AttendanceEditor from './AttendanceEditor';

const LEGEND = [
  ['P', 'Present', 'bg-emerald-100 text-emerald-700'],
  ['½', 'Half day', 'bg-amber-100 text-amber-700'],
  ['A', 'Absent', 'bg-rose-100 text-rose-700'],
  ['L', 'Leave', 'bg-indigo-100 text-indigo-700'],
  ['W', 'Weekly off', 'bg-neutral-100 text-neutral-400'],
  ['H', 'Holiday', 'bg-sky-100 text-sky-700'],
];

const STATUS_GLYPH = {
  PRESENT: ['P', 'bg-emerald-100 text-emerald-700'],
  HALF_DAY: ['½', 'bg-amber-100 text-amber-700'],
  ABSENT: ['A', 'bg-rose-100 text-rose-700'],
  ON_LEAVE: ['L', 'bg-indigo-100 text-indigo-700'],
  WEEKLY_OFF: ['W', 'bg-neutral-100 text-neutral-400'],
  HOLIDAY: ['H', 'bg-sky-100 text-sky-700'],
};

export default function AttendanceRegister() {
  const [month, setMonth] = useState(currentMonthStr());
  const year = parseInt(month.split('-')[0], 10);
  const { data: employees, isLoading: loadingEmp } = useEmployees();
  const { data: monthRecords, isLoading: loadingAtt } = useAttendance({ month });
  const { data: holidays } = useHolidays(year);
  const { data: settings } = useHrmSettings();
  const { data: approvedLeaves } = useLeaves('APPROVED');
  const [editing, setEditing] = useState(null);

  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = currentMonthStr() === month
    ? `${month}-${String(new Date().getDate()).padStart(2, '0')}` : `${month}-99`;

  const recByKey = useMemo(() => {
    const map = {};
    (monthRecords || []).forEach((r) => { map[`${r.agentId}|${r.date}`] = r; });
    return map;
  }, [monthRecords]);
  const leaveByKey = useMemo(() => buildLeaveDateMap(approvedLeaves, { byAgent: true }), [approvedLeaves]);
  const holidaySet = useMemo(() => new Set((holidays || []).map((h) => h.date)), [holidays]);
  const defaultOffs = settings?.defaultWeeklyOffDays || [0];

  const shiftMonth = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const activeEmployees = (employees || []).filter((e) => e.employeeProfile?.isActive !== false);

  const cellFor = (agentId, weeklyOff, day) => {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const rec = recByKey[`${agentId}|${dateStr}`];
    if (rec) return { dateStr, rec, ...glyph(STATUS_GLYPH[rec.status]) };
    if (leaveByKey[`${agentId}|${dateStr}`]) return { dateStr, rec: null, glyphChar: 'L', cls: 'bg-indigo-100 text-indigo-700' };
    if (holidaySet.has(dateStr)) return { dateStr, rec: null, glyphChar: 'H', cls: 'bg-sky-100 text-sky-700' };
    const weekday = new Date(y, m - 1, day).getDay();
    if (weeklyOff.has(weekday)) return { dateStr, rec: null, glyphChar: 'W', cls: 'bg-neutral-50 text-neutral-300' };
    if (dateStr > todayStr) return { dateStr, rec: null, glyphChar: '', cls: 'text-neutral-200' };
    return { dateStr, rec: null, glyphChar: '·', cls: 'text-neutral-300' }; // past working day, unmarked
  };

  const isLoading = loadingEmp || loadingAtt;

  return (
    <>
      <SectionCard
        title="Monthly register"
        subtitle="All staff, every day. Click any cell to edit."
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-semibold text-neutral-600 sm:inline">{fmtMonthLabel(month)}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftMonth(-1)} className="shell-button-ghost h-9 w-9 p-0"><ChevronLeftIcon className="h-4 w-4" /></button>
              <button onClick={() => shiftMonth(1)} disabled={month >= currentMonthStr()} className="shell-button-ghost h-9 w-9 p-0 disabled:opacity-30"><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
          </div>
        }
      >
        {isLoading ? <Spinner /> : !activeEmployees.length ? (
          <p className="py-10 text-center text-sm text-neutral-400">No active employees. Add HR profiles under People.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">Employee</th>
                    {days.map((d) => {
                      const weekday = new Date(y, m - 1, d).getDay();
                      const weekend = weekday === 0 || weekday === 6;
                      return (
                        <th key={d} className={`w-8 px-0 py-1 text-center font-semibold ${weekend ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          <div className="tabular-nums">{d}</div>
                          <div className="text-[9px] font-medium text-neutral-300">{WEEKDAYS[weekday][0]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map((emp) => {
                    const weeklyOff = new Set(
                      emp.employeeProfile?.weeklyOffDays?.length ? emp.employeeProfile.weeklyOffDays : defaultOffs
                    );
                    return (
                      <tr key={emp.id} className="group">
                        <td className="sticky left-0 z-10 max-w-[160px] truncate bg-white px-2 py-1.5 pr-3 font-semibold text-neutral-800 group-hover:bg-neutral-50">
                          <span className="block truncate">{emp.name}</span>
                        </td>
                        {days.map((d) => {
                          const cell = cellFor(emp.id, weeklyOff, d);
                          return (
                            <td key={d} className="p-0.5 text-center">
                              <button
                                onClick={() => setEditing({ agent: emp, date: cell.dateStr, rec: cell.rec })}
                                className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition hover:ring-2 hover:ring-neutral-900/10 ${cell.cls}`}
                                title={cell.dateStr}
                              >
                                {cell.glyphChar}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {LEGEND.map(([g, label, cls]) => (
                <span key={g} className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                  <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${cls}`}>{g}</span>
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <AttendanceEditor
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        agent={editing?.agent}
        date={editing?.date}
        record={editing?.rec}
      />
    </>
  );
}

function glyph(pair) {
  return { glyphChar: pair?.[0] || '·', cls: pair?.[1] || 'text-neutral-300' };
}
