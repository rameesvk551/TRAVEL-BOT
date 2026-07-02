// FILE: /frontend/src/pages/hrm/AttendanceEditor.jsx

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMarkAttendance } from '../../api/hrm';
import { SlideOver, Field, ATTENDANCE_STATUS, fmtDate, PunchLocationLink } from './hrmUi';

const STATUS_OPTIONS = ['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'];

function timeFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isoFromTime(date, time) {
  if (!time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * Edit one employee's attendance for one date: status, punch in/out, notes.
 * @param {{ open, onClose, agent, date, record }} props
 */
export default function AttendanceEditor({ open, onClose, agent, date, record }) {
  const mark = useMarkAttendance();
  const [form, setForm] = useState({ status: 'PRESENT', punchIn: '', punchOut: '', notes: '' });

  useEffect(() => {
    if (open) {
      setForm({
        status: record?.status || 'PRESENT',
        punchIn: timeFromIso(record?.punchInAt),
        punchOut: timeFromIso(record?.punchOutAt),
        notes: record?.notes || '',
      });
    }
  }, [open, record]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (form.punchIn && form.punchOut && form.punchOut <= form.punchIn) {
      toast.error('Punch-out must be after punch-in');
      return;
    }
    mark.mutate(
      {
        agentId: agent.id,
        date,
        status: form.status,
        punchInAt: isoFromTime(date, form.punchIn),
        punchOutAt: isoFromTime(date, form.punchOut),
        notes: form.notes || null,
      },
      {
        onSuccess: () => { toast.success('Attendance saved'); onClose(); },
        onError: (e) => toast.error(e.response?.data?.error || 'Could not save'),
      }
    );
  };

  if (!agent) return null;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={agent.name}
      subtitle={`Attendance · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="shell-button-secondary">Cancel</button>
          <button onClick={submit} disabled={mark.isPending} className="shell-button-primary">
            {mark.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Status">
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="shell-input-rect">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS[s].label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Punch in"><input type="time" value={form.punchIn} onChange={(e) => set('punchIn', e.target.value)} className="shell-input-rect" /></Field>
          <Field label="Punch out"><input type="time" value={form.punchOut} onChange={(e) => set('punchOut', e.target.value)} className="shell-input-rect" /></Field>
        </div>
        <Field label="Notes" hint="Optional — reason for correction, remarks, etc.">
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className="shell-input-rect resize-none" placeholder="e.g. Forgot to punch out" />
        </Field>
        {(record?.punchInLat != null || record?.punchOutLat != null) && (
          <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="eyebrow mb-2">Punch location</p>
            <div className="flex flex-col gap-1.5">
              {record?.punchInLat != null && (
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>In</span>
                  <PunchLocationLink lat={record.punchInLat} lng={record.punchInLng} accuracy={record.punchInAccuracy} />
                </div>
              )}
              {record?.punchOutLat != null && (
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>Out</span>
                  <PunchLocationLink lat={record.punchOutLat} lng={record.punchOutLng} accuracy={record.punchOutAccuracy} />
                </div>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-neutral-400">Manual edits are recorded as admin corrections.</p>
      </div>
    </SlideOver>
  );
}
