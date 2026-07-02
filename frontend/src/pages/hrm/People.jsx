// FILE: /frontend/src/pages/hrm/People.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UsersIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useEmployees, useSaveEmployee } from '../../api/hrm';
import {
  SectionCard, EmptyState, Spinner, SlideOver, Field, WeekdayPicker,
  fmtMoney, fmtDate,
} from './hrmUi';

const EMPLOYMENT_TYPES = [
  ['FULL_TIME', 'Full time'], ['PART_TIME', 'Part time'], ['CONTRACT', 'Contract'], ['INTERN', 'Intern'],
];

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function EditEmployee({ employee, onClose }) {
  const save = useSaveEmployee();
  const p = employee?.employeeProfile;
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({
      employeeCode: p?.employeeCode || '',
      department: p?.department || '',
      designation: p?.designation || '',
      employmentType: p?.employmentType || 'FULL_TIME',
      joiningDate: p?.joiningDate || '',
      monthlySalary: p?.monthlySalary != null ? Number(p.monthlySalary) : 0,
      weeklyOffDays: Array.isArray(p?.weeklyOffDays) ? p.weeklyOffDays : [0],
      isActive: p?.isActive ?? true,
    });
  }, [employee]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    save.mutate(
      { id: employee.id, ...form, monthlySalary: Number(form.monthlySalary) || 0 },
      {
        onSuccess: () => { toast.success('Employee saved'); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error || 'Could not save'),
      }
    );
  };

  return (
    <SlideOver
      open={Boolean(employee)}
      onClose={onClose}
      title={employee?.name}
      subtitle={employee?.email}
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="shell-button-secondary">Cancel</button>
          <button onClick={submit} disabled={save.isPending} className="shell-button-primary">
            {save.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee code"><input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} placeholder="EMP-001" className="shell-input-rect" /></Field>
          <Field label="Joining date"><input type="date" value={form.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} className="shell-input-rect" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department"><input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Operations" className="shell-input-rect" /></Field>
          <Field label="Designation"><input value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Travel consultant" className="shell-input-rect" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employment type">
            <select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} className="shell-input-rect">
              {EMPLOYMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Monthly salary (₹)"><input type="number" min="0" value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)} className="shell-input-rect" /></Field>
        </div>
        <Field label="Weekly offs" hint="Days excluded from attendance & payroll deductions">
          <WeekdayPicker value={form.weeklyOffDays || []} onChange={(v) => set('weeklyOffDays', v)} />
        </Field>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-3">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded accent-neutral-900" />
          <span className="text-sm font-medium text-neutral-700">Active employee (included in payroll)</span>
        </label>
      </div>
    </SlideOver>
  );
}

export default function People() {
  const { data: employees, isLoading } = useEmployees();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <SectionCard title="People" subtitle="Set HR details for each staff member. Add new logins under Users.">
        {isLoading ? <Spinner /> : !employees?.length ? (
          <EmptyState icon={UsersIcon} title="No staff yet" hint="Create staff logins under the Users page first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  <th className="py-2.5 pr-3">Employee</th>
                  <th className="px-3 py-2.5">Designation</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5 text-right">Salary</th>
                  <th className="py-2.5 pl-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {employees.map((emp) => {
                  const p = emp.employeeProfile;
                  return (
                    <tr key={emp.id} className="group transition hover:bg-neutral-50">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{initials(emp.name)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-neutral-900">{emp.name}</p>
                            <p className="truncate text-xs text-neutral-400">{p?.employeeCode || emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-neutral-600">{p?.designation || '—'}</td>
                      <td className="px-3 py-3 text-neutral-600">{p?.department || '—'}</td>
                      <td className="px-3 py-3 text-neutral-600">{p?.joiningDate ? fmtDate(p.joiningDate, { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-900">{p ? fmtMoney(p.monthlySalary) : '—'}</td>
                      <td className="py-3 pl-3 text-right">
                        <button onClick={() => setEditing(emp)} className="shell-button-ghost opacity-0 transition group-hover:opacity-100">
                          <PencilSquareIcon className="h-4 w-4" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <EditEmployee employee={editing} onClose={() => setEditing(null)} />
    </>
  );
}
