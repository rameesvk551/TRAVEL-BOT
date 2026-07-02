// FILE: /frontend/src/pages/hrm/Reports.jsx

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, UsersIcon,
  ChartBarIcon, ClockIcon, CalendarDaysIcon, ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { useAttendanceReport } from '../../api/hrm';
import {
  SectionCard, StatTile, Spinner, EmptyState, downloadCsv, fmtMonthLabel, currentMonthStr,
} from './hrmUi';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function pctColor(p) {
  if (p >= 90) return '#10b981';
  if (p >= 75) return '#f59e0b';
  return '#ef4444';
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-neutral-900">{row.name}</p>
      <p className="mt-1 font-semibold text-neutral-600">Attendance: {row.attendancePct}%</p>
      <p className="text-neutral-500">{row.workedDays} / {row.workingDays} days · {row.lateCount} late</p>
    </div>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonthStr());
  const { data, isLoading } = useAttendanceReport(month);

  const rows = data?.rows || [];
  const totals = data?.totals;

  const exportCsv = () => {
    const columns = [
      { key: 'name', label: 'Employee' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'workingDays', label: 'Working days' },
      { key: 'workedDays', label: 'Worked days' },
      { key: 'present', label: 'Present' },
      { key: 'half', label: 'Half days' },
      { key: 'leaveDays', label: 'Leave days' },
      { key: 'unpaidDays', label: 'Unpaid (LOP) days' },
      { key: 'paidDays', label: 'Paid days' },
      { key: 'lateCount', label: 'Late arrivals' },
      { key: 'totalHours', label: 'Total hours' },
      { key: 'attendancePct', label: 'Attendance %' },
    ];
    downloadCsv(`attendance-report-${month}.csv`, columns, rows);
  };

  const chartData = rows.map((r) => ({
    name: r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name,
    attendancePct: r.attendancePct,
    workedDays: r.workedDays,
    workingDays: r.workingDays,
    lateCount: r.lateCount,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Staff" value={data?.count ?? 0} icon={UsersIcon} />
        <StatTile label="Avg attendance" value={`${totals?.avgAttendancePct ?? 0}%`} accent="green" icon={ChartBarIcon} />
        <StatTile label="Late arrivals" value={totals?.lateCount ?? 0} accent="amber" icon={ClockIcon} />
        <StatTile label="Leave days" value={totals?.leaveDays ?? 0} accent="indigo" icon={CalendarDaysIcon} />
        <StatTile label="Unpaid (LOP) days" value={totals?.unpaidDays ?? 0} accent="rose" icon={ArrowTrendingDownIcon} />
      </div>

      <SectionCard
        title="Attendance report"
        subtitle={fmtMonthLabel(month)}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(shiftMonth(month, -1))} className="shell-button-ghost h-9 w-9 p-0"><ChevronLeftIcon className="h-4 w-4" /></button>
              <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonthStr()} className="shell-button-ghost h-9 w-9 p-0 disabled:opacity-30"><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
            <button onClick={exportCsv} disabled={!rows.length} className="shell-button-secondary"><ArrowDownTrayIcon className="h-4 w-4" /> Export CSV</button>
          </div>
        }
      >
        {isLoading ? <Spinner /> : !rows.length ? (
          <EmptyState icon={ChartBarIcon} title="No data for this month" hint="Add employee HR profiles and record attendance to see reports." />
        ) : (
          <>
            <div className="mb-6 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#737373' }} interval={0} angle={-25} textAnchor="end" height={56} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737373' }} unit="%" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="attendancePct" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {chartData.map((d, i) => <Cell key={i} fill={pctColor(d.attendancePct)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    <th className="py-2.5 pr-3">Employee</th>
                    <th className="px-3 py-2.5 text-center">Working</th>
                    <th className="px-3 py-2.5 text-center">Worked</th>
                    <th className="px-3 py-2.5 text-center">Leave</th>
                    <th className="px-3 py-2.5 text-center">LOP</th>
                    <th className="px-3 py-2.5 text-center">Late</th>
                    <th className="px-3 py-2.5 text-center">Hours</th>
                    <th className="px-3 py-2.5 text-right">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.agentId} className="hover:bg-neutral-50">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-neutral-900">{r.name}</p>
                        <p className="text-xs text-neutral-400">{r.designation || r.department || r.email}</p>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600">{r.workingDays}</td>
                      <td className="px-3 py-3 text-center tabular-nums font-semibold text-neutral-900">{r.workedDays}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-indigo-600">{r.leaveDays}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-rose-600">{r.unpaidDays}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-amber-600">{r.lateCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600">{r.totalHours}h</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100 sm:block">
                            <div className="h-full rounded-full" style={{ width: `${r.attendancePct}%`, background: pctColor(r.attendancePct) }} />
                          </div>
                          <span className="w-10 text-right font-bold tabular-nums" style={{ color: pctColor(r.attendancePct) }}>{r.attendancePct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
