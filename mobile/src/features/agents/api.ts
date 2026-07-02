// FILE: mobile/src/features/agents/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Agent {
  id: string;
  name: string;
  role: string; // Admin, Sales, Support
  status: string; // Online, Offline
  routingLimit: number;
}

export function useAgents(role?: string) {
  return useQuery({
    queryKey: ['agents', role],
    queryFn: async () => {
      try {
        const response = await api.get('/agents', { params: { role } });
        return response.data.data as Agent[];
      } catch (err: any) {
        return getMockAgents().filter(a => {
          if (!role || role === 'All') return true;
          return a.role === role;
        });
      }
    },
  });
}

function getMockAgents(): Agent[] {
  return [
    { id: '1', name: 'Ravi Kumar', role: 'Admin', status: 'Online', routingLimit: 50 },
    { id: '2', name: 'Sunita Sharma', role: 'Sales', status: 'Offline', routingLimit: 25 },
  ];
}
