// FILE: mobile/src/features/templates/api.ts
// Backed by /api/templates (backend/src/routes/templates.ts).
// Templates are WhatsApp-only (Meta message templates) — there is no channel
// dimension on the model, so the UI filters by approval status instead.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export interface TemplateButton {
  type?: string;
  text?: string;
  url?: string;
  payload?: string;
}

/** Mirrors backend/src/models/MessageTemplate.ts. */
export interface Template {
  id: string;
  /** Meta-safe slug, auto-derived from displayName on create. */
  name: string;
  displayName: string;
  category: TemplateCategory;
  templateType: 'STANDARD' | 'CAROUSEL';
  language: string;
  status: TemplateStatus;
  headerType: 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  headerContent: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  variableCount: number;
  sampleVariables: string[];
  tags: string[];
  icon: string | null;
  isPrebuilt: boolean;
  rejectionReason: string | null;
  metaTemplateId: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  displayName: string;
  body: string;
  category: TemplateCategory;
  footer?: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** `status` is the backend enum, or undefined for all. */
export function useTemplates(status?: TemplateStatus) {
  return useQuery({
    queryKey: ['templates', 'list', status ?? 'ALL'],
    queryFn: async (): Promise<Template[]> => {
      const res = await api.get('/templates', { params: { status } });
      return (res.data.data ?? []) as Template[];
    },
  });
}

export function useTemplate(id?: string) {
  return useQuery({
    queryKey: ['templates', 'detail', id],
    queryFn: async (): Promise<Template> => {
      const res = await api.get(`/templates/${id}`);
      return res.data.data as Template;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateInput): Promise<Template> => {
      const res = await api.post('/templates', input);
      return res.data.data as Template;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<TemplateInput> & { id: string }): Promise<Template> => {
      const res = await api.patch(`/templates/${id}`, input);
      return res.data.data as Template;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['templates', 'detail', vars.id] });
    },
  });
}

/** POST /templates/:id/submit — sends the template to Meta for approval (DRAFT → PENDING). */
export function useSubmitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Template> => {
      const res = await api.post(`/templates/${id}/submit`);
      return res.data.data as Template;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['templates', 'detail', id] });
    },
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Template> => {
      const res = await api.post(`/templates/${id}/duplicate`);
      return res.data.data as Template;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/** POST /templates/sync — pulls approval status back from Meta. */
export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/templates/sync', {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
