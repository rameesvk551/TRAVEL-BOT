// FILE: mobile/src/features/automations/api.ts
// Backed by /api/drips (backend/src/routes/drips.ts) — DripSequence + DripStep.
//
// WHY /drips AND NOT /flows:
//   - The web app's Automations page (frontend/src/pages/Automations.jsx) is
//     built on useDrips → /drips. That is the drip sequence: a trigger plus an
//     ORDERED list of delayed message steps. It is exactly what this feature
//     models.
//   - /flows is a different thing: WhatsApp *Meta Flow* forms (jsonDefinition =
//     Meta's screen JSON). Not an automation sequence.
//   - The node-graph builder lives in agencyService.normalizeGraphData, which is
//     a whitelist that silently drops unknown node fields. We never PATCH a
//     graph from mobile, so there is no round-trip data-loss risk here.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export type AutomationTrigger =
  | 'LEAD_CREATED'
  | 'LEAD_QUOTED'
  | 'BOOKING_COMPLETED'
  | 'LEAD_COLD'
  | 'MANUAL';

export type StepMessageType = 'TEXT' | 'TEMPLATE' | 'BUTTONS' | 'IMAGE';

/** Mirrors backend/src/models/DripStep.ts. */
export interface AutomationStep {
  id: string;
  order: number;
  /** Hours to wait after the previous step. 0 = immediate. */
  delayHours: number;
  messageType: StepMessageType;
  /** Only present on the detail fetch — the list route selects a subset of columns. */
  messageBody?: string;
  templateId?: string | null;
  imageUrl?: string | null;
}

/** Mirrors backend/src/models/DripSequence.ts. */
export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  isActive: boolean;
  enrollmentCount: number;
  completedCount: number;
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationEnrollment {
  id: string;
  status: string;
  currentStep: number;
  createdAt: string;
  customer?: { name?: string; phone?: string } | null;
}

export interface AutomationDetail extends Automation {
  enrollments?: AutomationEnrollment[];
}

/** Human labels for the trigger enum. */
export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  LEAD_CREATED: 'When a lead is created',
  LEAD_QUOTED: 'When a lead is quoted',
  BOOKING_COMPLETED: 'When a booking completes',
  LEAD_COLD: 'When a lead goes cold',
  MANUAL: 'Manual enrollment',
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAutomations() {
  return useQuery({
    queryKey: ['automations', 'list'],
    queryFn: async (): Promise<Automation[]> => {
      const res = await api.get('/drips');
      return (res.data.data ?? []) as Automation[];
    },
  });
}

export function useAutomation(id?: string) {
  return useQuery({
    queryKey: ['automations', 'detail', id],
    queryFn: async (): Promise<AutomationDetail> => {
      const res = await api.get(`/drips/${id}`);
      return res.data.data as AutomationDetail;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /drips/:id/toggle — flips isActive. The only write the mobile app makes. */
export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Automation> => {
      const res = await api.post(`/drips/${id}/toggle`);
      return res.data.data as Automation;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      qc.invalidateQueries({ queryKey: ['automations', 'detail', id] });
    },
  });
}
