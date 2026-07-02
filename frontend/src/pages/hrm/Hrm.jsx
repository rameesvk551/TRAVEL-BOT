// FILE: /frontend/src/pages/hrm/Hrm.jsx

import { useState } from 'react';
import {
  UserIcon, UsersIcon, CalendarDaysIcon, InboxStackIcon, BanknotesIcon, Cog6ToothIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useHrmManage } from './hrmUi';
import { useLeaves } from '../../api/hrm';
import MySpace from './MySpace';
import People from './People';
import AttendanceTab from './AttendanceTab';
import LeaveApprovals from './LeaveApprovals';
import Payroll from './Payroll';
import Reports from './Reports';
import HrmSettings from './HrmSettings';

function PendingBadge() {
  const { data } = useLeaves('PENDING');
  const n = data?.length || 0;
  if (!n) return null;
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{n}</span>;
}

export default function Hrm() {
  const canManage = useHrmManage();
  const [tab, setTab] = useState('me');

  const tabs = [
    { key: 'me', label: 'My Space', icon: UserIcon, el: <MySpace /> },
    ...(canManage ? [
      { key: 'people', label: 'People', icon: UsersIcon, el: <People /> },
      { key: 'attendance', label: 'Attendance', icon: CalendarDaysIcon, el: <AttendanceTab /> },
      { key: 'leaves', label: 'Leaves', icon: InboxStackIcon, el: <LeaveApprovals />, badge: <PendingBadge /> },
      { key: 'payroll', label: 'Payroll', icon: BanknotesIcon, el: <Payroll /> },
      { key: 'reports', label: 'Reports', icon: ChartBarIcon, el: <Reports /> },
      { key: 'settings', label: 'Settings', icon: Cog6ToothIcon, el: <HrmSettings /> },
    ] : []),
  ];

  const active = tabs.find((t) => t.key === tab) || tabs[0];

  return (
    <div className="w-full">
      <header className="mb-5">
        <p className="eyebrow">Human Resources</p>
        <h1 className="page-heading mt-1">HRM</h1>
        <p className="page-subtext mt-1">
          {canManage ? 'Attendance, leave, payroll and your team in one place.' : 'Punch in, track your hours and request leave.'}
        </p>
      </header>

      <nav className="mb-5 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-1 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:min-w-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = t.key === active.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold transition-all sm:flex-none ${
                  on ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
                {t.badge}
              </button>
            );
          })}
        </div>
      </nav>

      <div key={active.key} className="page-enter">{active.el}</div>
    </div>
  );
}
