// FILE: mobile/src/features/hrm/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface LeaveRequest {
  id: string;
  employeeName: string;
  type: string; // Sick, Casual, Earned
  status: string; // Pending, Approved, Rejected
  days: number;
  startDate: string;
}

export function useLeaveRequests(status?: string) {
  return useQuery({
    queryKey: ['leaves', status],
    queryFn: async () => {
      try {
        const response = await api.get('/leaves', { params: { status } });
        return response.data.data as LeaveRequest[];
      } catch (err: any) {
        return getMockLeaveRequests().filter(l => {
          if (!status || status === 'All') return true;
          return l.status === status;
        });
      }
    },
  });
}

function getMockLeaveRequests(): LeaveRequest[] {
  return [
    { id: '1', employeeName: 'Amit Singh', type: 'Sick Leave', status: 'Pending', days: 2, startDate: new Date().toISOString() },
    { id: '2', employeeName: 'Neha Gupta', type: 'Casual Leave', status: 'Approved', days: 1, startDate: new Date(Date.now() + 86400000 * 5).toISOString() },
  ];
}
