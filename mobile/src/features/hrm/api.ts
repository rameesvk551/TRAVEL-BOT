// FILE: mobile/src/features/hrm/api.ts
// Real HRM wiring. Source of truth: backend/src/routes/hrm.ts + hrmService.
// Envelope is { success: true, data }. No mocks — errors propagate so react-query
// sets isError and screens render the real ErrorState.

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Types — mirror what the backend actually returns
// ---------------------------------------------------------------------------

/** Sequelize DECIMAL columns come back as strings over JSON. */
type Decimal = string | number;

export type AttendanceStatus =
  | 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Attendance {
  id: string;
  agentId: string;
  date: string;                 // YYYY-MM-DD
  punchInAt: string | null;
  punchOutAt: string | null;
  punchInLat: Decimal | null;
  punchInLng: Decimal | null;
  punchInAccuracy: number | null;
  punchOutLat: Decimal | null;
  punchOutLng: Decimal | null;
  punchOutAccuracy: number | null;
  status: AttendanceStatus;
  isLate: boolean;
  workedMinutes: number | null;
}

export interface EmployeeProfile {
  id: string;
  agentId: string;
  employeeCode: string | null;
  department: string | null;
  designation: string | null;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  joiningDate: string | null;
  monthlySalary: Decimal | null;
  weeklyOffDays: number[] | null;
  isActive: boolean;
}

export interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  code: string;
  color: string | null;
  isPaid: boolean;
  quota: number;
  used: number;
  /** null = unlimited (no annual quota configured). */
  balance: number | null;
}

export interface MySpace {
  profile: EmployeeProfile | null;
  today: Attendance | null;
  balances: LeaveBalance[];
  pendingLeaves: number;
  date: string;
  /** Server has the final say on the force-punch-in gate. */
  requiresPunchIn: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  annualQuota: Decimal;
  color: string | null;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  agentId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  dayCount: Decimal;
  reason: string | null;
  status: LeaveStatus;
  reviewNote: string | null;
  createdAt: string;
  leaveType?: LeaveType | null;
  /** Only present on the manager list (GET /hrm/leaves). */
  agent?: { id: string; name: string; email: string } | null;
}

export interface Timesheet {
  month: string;
  attendance: Attendance[];
  leaves: LeaveRequest[];
  holidays: Array<{ id: string; date: string; name: string }>;
  weeklyOffDays: number[];
}

export interface NewLeaveRequest {
  leaveTypeId: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  isHalfDay?: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the server's error message out of an axios error. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { data?: { error?: string; message?: string } } })?.response;
  return res?.data?.error || res?.data?.message || (err as Error)?.message || fallback;
}

// ---------------------------------------------------------------------------
// Location — REQUIRED for a punch. We never send null or fabricated coordinates.
// The backend punch schema is { lat, lng, accuracy? } and lat/lng are mandatory.
// ---------------------------------------------------------------------------

export interface PunchLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export type PunchLocationStatus = 'resolving' | 'ready' | 'denied' | 'unavailable';

export class PunchLocationError extends Error {
  kind: 'denied' | 'unavailable';
  constructor(message: string, kind: 'denied' | 'unavailable') {
    super(message);
    this.name = 'PunchLocationError';
    this.kind = kind;
  }
}

/**
 * Resolve a fresh GPS fix for a punch. Throws a PunchLocationError when the user
 * denied permission or no fix could be obtained — callers surface the message and
 * block the punch rather than sending a location-less request.
 */
export async function getPunchLocation(): Promise<PunchLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new PunchLocationError(
      'Allow location access to punch in or out. Your workplace records where each punch happened.',
      'denied',
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new PunchLocationError('Turn on location (GPS) to punch in or out.', 'unavailable');
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new PunchLocationError('Could not read your location. Move somewhere with a clearer signal and try again.', 'unavailable');
  }

  const { latitude, longitude, accuracy } = position.coords;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new PunchLocationError('Could not read your location. Try again.', 'unavailable');
  }

  return {
    lat: latitude,
    lng: longitude,
    accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
  };
}

/**
 * Screen-level location state: resolves a fix on mount so the user can SEE where
 * the punch will be recorded before confirming, and exposes a manual retry.
 */
export function usePunchLocation() {
  const [location, setLocation] = useState<PunchLocation | null>(null);
  const [status, setStatus] = useState<PunchLocationStatus>('resolving');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('resolving');
    setError(null);
    try {
      const fix = await getPunchLocation();
      setLocation(fix);
      setStatus('ready');
    } catch (err) {
      setLocation(null);
      setStatus(err instanceof PunchLocationError ? err.kind : 'unavailable');
      setError(err instanceof Error ? err.message : 'Could not read your location.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { location, status, error, refresh, isResolving: status === 'resolving' };
}

// ---------------------------------------------------------------------------
// Self-service queries
// ---------------------------------------------------------------------------

export function useMySpace({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['hrm', 'me'],
    queryFn: async (): Promise<MySpace> => {
      const res = await api.get('/hrm/me');
      return res.data.data;
    },
    staleTime: 15 * 1000,
    enabled,
  });
}

export function useMyTimesheet(month?: string) {
  return useQuery({
    queryKey: ['hrm', 'timesheet', month ?? 'current'],
    queryFn: async (): Promise<Timesheet> => {
      const res = await api.get('/hrm/attendance/me', { params: month ? { month } : {} });
      return res.data.data;
    },
  });
}

export function useMyLeaves() {
  return useQuery({
    queryKey: ['hrm', 'my-leaves'],
    queryFn: async (): Promise<LeaveRequest[]> => {
      const res = await api.get('/hrm/leaves/me');
      return res.data.data;
    },
  });
}

export function useLeaveTypes({ activeOnly = false }: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['hrm', 'leave-types', activeOnly],
    queryFn: async (): Promise<LeaveType[]> => {
      const res = await api.get('/hrm/leave-types', { params: activeOnly ? { active: 'true' } : {} });
      return res.data.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Punch in / out — location is mandatory
// ---------------------------------------------------------------------------

export function usePunch() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hrm', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['hrm', 'timesheet'] });
  };

  const punchIn = useMutation({
    mutationFn: async (): Promise<Attendance> => {
      // Fresh fix at the moment of the punch. Throws (and sends nothing) when
      // permission is denied or no fix is available.
      const location = await getPunchLocation();
      const res = await api.post('/hrm/attendance/punch-in', location);
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  const punchOut = useMutation({
    mutationFn: async (): Promise<Attendance> => {
      const location = await getPunchLocation();
      const res = await api.post('/hrm/attendance/punch-out', location);
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  return { punchIn, punchOut };
}

// ---------------------------------------------------------------------------
// Leave requests (self)
// ---------------------------------------------------------------------------

export function useRequestLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: NewLeaveRequest): Promise<LeaveRequest> => {
      const res = await api.post('/hrm/leaves', body);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm', 'my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hrm', 'me'] });
    },
  });
}

export function useCancelMyLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<LeaveRequest> => {
      const res = await api.delete(`/hrm/leaves/me/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm', 'my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hrm', 'me'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Manager: leave approvals (requires the hrm.manage permission server-side)
// ---------------------------------------------------------------------------

export function useTeamLeaves(status?: LeaveStatus, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['hrm', 'leaves', status ?? 'ALL'],
    queryFn: async (): Promise<LeaveRequest[]> => {
      const res = await api.get('/hrm/leaves', { params: status ? { status } : {} });
      return res.data.data;
    },
    enabled,
  });
}

export function useReviewLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string },
    ): Promise<LeaveRequest> => {
      const res = await api.patch(`/hrm/leaves/${id}/${decision}`, note ? { note } : {});
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrm', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hrm', 'me'] });
    },
  });
}
