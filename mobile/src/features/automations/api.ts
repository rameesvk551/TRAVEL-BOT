// FILE: mobile/src/features/automations/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  status: string; // Active, Inactive
  runCount: number;
}

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      try {
        const response = await api.get('/automations');
        return response.data.data as Automation[];
      } catch (err: any) {
        return getMockAutomations();
      }
    },
  });
}

function getMockAutomations(): Automation[] {
  return [
    { id: '1', name: 'Welcome Message', trigger: 'On Lead Create', status: 'Active', runCount: 1540 },
    { id: '2', name: 'Post-Trip Review', trigger: 'On Booking Complete', status: 'Active', runCount: 850 },
    { id: '3', name: 'Abandoned Cart', trigger: '24h after Draft Quote', status: 'Inactive', runCount: 120 },
  ];
}
