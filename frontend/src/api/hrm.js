// FILE: /frontend/src/api/hrm.js
// React Query hooks for the HRM module.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';

const unwrap = (res) => res.data.data;

/**
 * Resolve the device's current GPS position for a punch. Rejects with a
 * user-friendly message when location is unavailable or the user denies it —
 * callers surface this and block the punch.
 */
export function getPunchLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : undefined,
      }),
      (err) => {
        const msg = err && err.code === err.PERMISSION_DENIED
          ? 'Allow location access to punch in or out.'
          : 'Could not read your location. Check GPS and try again.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ---------------------------------------------------------------------------
// Self-service
// ---------------------------------------------------------------------------

export function useMySpace({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['hrm', 'me'],
    queryFn: () => client.get('/hrm/me').then(unwrap),
    staleTime: 15 * 1000,
    enabled,
  });
}

export function useMyTimesheet(month) {
  return useQuery({
    queryKey: ['hrm', 'timesheet', month],
    queryFn: () => client.get('/hrm/attendance/me', { params: { month } }).then(unwrap),
  });
}

export function useMyLeaves() {
  return useQuery({
    queryKey: ['hrm', 'my-leaves'],
    queryFn: () => client.get('/hrm/leaves/me').then(unwrap),
  });
}

export function useLeaveTypes({ activeOnly = false } = {}) {
  return useQuery({
    queryKey: ['hrm', 'leave-types', activeOnly],
    queryFn: () => client.get('/hrm/leave-types', { params: activeOnly ? { active: 'true' } : {} }).then(unwrap),
  });
}

export function usePunch() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hrm', 'me'] });
    qc.invalidateQueries({ queryKey: ['hrm', 'timesheet'] });
  };
  const punchIn = useMutation({
    mutationFn: async () => {
      const loc = await getPunchLocation();
      return client.post('/hrm/attendance/punch-in', loc).then(unwrap);
    },
    onSuccess: invalidate,
  });
  const punchOut = useMutation({
    mutationFn: async () => {
      const loc = await getPunchLocation();
      return client.post('/hrm/attendance/punch-out', loc).then(unwrap);
    },
    onSuccess: invalidate,
  });
  return { punchIn, punchOut };
}

export function useRequestLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => client.post('/hrm/leaves', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hrm', 'my-leaves'] });
      qc.invalidateQueries({ queryKey: ['hrm', 'me'] });
    },
  });
}

export function useCancelMyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => client.delete(`/hrm/leaves/me/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'my-leaves'] }),
  });
}

// ---------------------------------------------------------------------------
// Management: employees
// ---------------------------------------------------------------------------

export function useEmployees() {
  return useQuery({ queryKey: ['hrm', 'employees'], queryFn: () => client.get('/hrm/employees').then(unwrap) });
}

export function useSaveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => client.patch(`/hrm/employees/${id}`, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'employees'] }),
  });
}

// ---------------------------------------------------------------------------
// Management: attendance
// ---------------------------------------------------------------------------

export function useAttendance(params) {
  return useQuery({
    queryKey: ['hrm', 'attendance', params],
    queryFn: () => client.get('/hrm/attendance', { params }).then(unwrap),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => client.post('/hrm/attendance', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'attendance'] }),
  });
}

// ---------------------------------------------------------------------------
// Management: leave approvals
// ---------------------------------------------------------------------------

export function useLeaves(status) {
  return useQuery({
    queryKey: ['hrm', 'leaves', status],
    queryFn: () => client.get('/hrm/leaves', { params: status ? { status } : {} }).then(unwrap),
  });
}

export function useReviewLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }) =>
      client.patch(`/hrm/leaves/${id}/${decision}`, { note }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hrm', 'leaves'] });
      qc.invalidateQueries({ queryKey: ['hrm', 'attendance'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Management: leave types & holidays
// ---------------------------------------------------------------------------

export function useSaveLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      (id ? client.patch(`/hrm/leave-types/${id}`, body) : client.post('/hrm/leave-types', body)).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'leave-types'] }),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => client.delete(`/hrm/leave-types/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'leave-types'] }),
  });
}

export function useHolidays(year) {
  return useQuery({
    queryKey: ['hrm', 'holidays', year],
    queryFn: () => client.get('/hrm/holidays', { params: year ? { year } : {} }).then(unwrap),
  });
}

export function useSaveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => client.post('/hrm/holidays', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => client.delete(`/hrm/holidays/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'holidays'] }),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function useHrmSettings() {
  return useQuery({ queryKey: ['hrm', 'settings'], queryFn: () => client.get('/hrm/settings').then(unwrap) });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => client.patch('/hrm/settings', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'settings'] }),
  });
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export function usePayroll(month) {
  return useQuery({
    queryKey: ['hrm', 'payroll', month],
    queryFn: () => client.get('/hrm/payroll', { params: { month } }).then(unwrap),
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month) => client.post('/hrm/payroll/generate', { month }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'payroll'] }),
  });
}

export function useUpdatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => client.patch(`/hrm/payslips/${id}`, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'payroll'] }),
  });
}

export function usePayslipStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }) => client.post(`/hrm/payslips/${id}/${action}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrm', 'payroll'] }),
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function useAttendanceReport(month) {
  return useQuery({
    queryKey: ['hrm', 'report', 'attendance', month],
    queryFn: () => client.get('/hrm/reports/attendance', { params: { month } }).then(unwrap),
  });
}
