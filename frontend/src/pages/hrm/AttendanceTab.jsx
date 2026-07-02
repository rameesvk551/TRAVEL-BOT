// FILE: /frontend/src/pages/hrm/AttendanceTab.jsx

import { useState } from 'react';
import { CalendarDaysIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import AttendanceBoard from './AttendanceBoard';
import AttendanceRegister from './AttendanceRegister';

const VIEWS = [
  ['day', 'Day view', CalendarDaysIcon],
  ['month', 'Month register', TableCellsIcon],
];

export default function AttendanceTab() {
  const [view, setView] = useState('day');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-[var(--radius-md)] border border-neutral-200 bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {VIEWS.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold transition ${
              view === key ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {view === 'day' ? <AttendanceBoard /> : <AttendanceRegister />}
    </div>
  );
}
