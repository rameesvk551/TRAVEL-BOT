// FILE: mobile/src/features/home/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface DashboardSummary {
  newLeads: { value: number; delta: number };
  conversion: { value: number; delta: number };
  bookings: { value: number; delta: number };
  revenue: { value: number; delta: number };
  revenueTrend: { date: string; amount: number }[];
  pipeline: { status: string; count: number }[];
  departures: { id: string; customerName: string; itemName: string; travelDate: string }[];
  needsAttention: { id: string; title: string; type: 'followup' | 'payment'; date: string }[];
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      try {
        const response = await api.get('/analytics/summary');
        return response.data.data as DashboardSummary;
      } catch (err: any) {
        // Since we are mocking/building frontend without backend guarantees for Phase 1,
        // if it fails (e.g. 404), return fallback dummy data.
        if (err.response?.status === 404) {
          console.warn('Dashboard endpoint not found, using mock data.');
          return getMockDashboardData();
        }
        throw err;
      }
    },
  });
}

function getMockDashboardData(): DashboardSummary {
  return {
    newLeads: { value: 24, delta: 12 },
    conversion: { value: 18.5, delta: -2 },
    bookings: { value: 8, delta: 4 },
    revenue: { value: 125000, delta: 15 },
    revenueTrend: [
      { date: 'Mon', amount: 12000 },
      { date: 'Tue', amount: 25000 },
      { date: 'Wed', amount: 18000 },
      { date: 'Thu', amount: 32000 },
      { date: 'Fri', amount: 15000 },
      { date: 'Sat', amount: 45000 },
      { date: 'Sun', amount: 8000 },
    ],
    pipeline: [
      { status: 'New', count: 12 },
      { status: 'Follow Up', count: 8 },
      { status: 'Negotiation', count: 4 },
      { status: 'Won', count: 5 },
    ],
    departures: [
      { id: '1', customerName: 'Rahul Kumar', itemName: 'Bali Escape', travelDate: new Date().toISOString() },
      { id: '2', customerName: 'Priya Sharma', itemName: 'Maldives Resort', travelDate: new Date().toISOString() },
    ],
    needsAttention: [
      { id: '1', title: 'Overdue follow-up for Group Tour', type: 'followup', date: new Date().toISOString() },
      { id: '2', title: 'Balance pending: BKG-4829', type: 'payment', date: new Date().toISOString() },
    ],
  };
}
