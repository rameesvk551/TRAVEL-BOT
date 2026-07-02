import { useMemo, useState } from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  QueueListIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { usePipelineStages, usePipelineStageMutations } from '../../hooks/useLeads';

const KIND_OPTIONS = [
  { value: 'OPEN', label: 'In progress', hint: 'Still working the lead' },
  { value: 'WON', label: 'Won', hint: 'Closed — converted' },
  { value: 'LOST', label: 'Lost', hint: 'Closed — lost/cancelled' },
];

const PRESET_COLORS = [
  '#5b7c99', '#7c5a83', '#b8862f', '#c0703a', '#0f8a6b', '#b4533a',
  '#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e',
];

function kindBadge(kind) {
  if (kind === 'WON') return 'bg-emerald-50 text-emerald-700';
  if (kind === 'LOST') return 'bg-rose-50 text-rose-700';
  return 'bg-sky-50 text-sky-700';
}

function StageFormModal({ stage, isSaving, onClose, onSubmit }) {
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || PRESET_COLORS[0]);
  const [kind, setKind] = useState(stage?.kind || 'OPEN');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color, kind });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{stage ? 'Edit Status' : 'New Status'}</h2>
            <p className="mt-1 text-xs text-neutral-500">A pipeline stage your team can move leads into.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quoted, Site Visit, Negotiating"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-neutral-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  style={{ backgroundColor: preset }}
                  className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${color === preset ? 'ring-neutral-900' : 'ring-transparent'}`}
                  aria-label={`Use ${preset}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
                title="Custom color"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${kind === option.value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <span className="block text-sm font-bold text-neutral-800">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-neutral-400">{option.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">Won/Lost mark a lead as closed — used for conversion metrics.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : stage ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsPipelineStatuses() {
  const stagesQuery = usePipelineStages();
  const { create, update, remove, reorder } = usePipelineStageMutations();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const stages = useMemo(
    () => [...(stagesQuery.data?.data || [])].sort((a, b) => a.position - b.position),
    [stagesQuery.data]
  );

  const isSaving = create.isPending || update.isPending;

  const handleSubmit = (body) => {
    if (editing) {
      update.mutate({ id: editing.id, body }, { onSuccess: closeForm });
    } else {
      create.mutate(body, { onSuccess: closeForm });
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const orderedIds = stages.map((s) => s.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    reorder.mutate(orderedIds);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">Pipeline Statuses</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Create the statuses your team moves leads through. The order here is the order shown in the pipeline and lead tabs.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
        >
          <PlusIcon className="h-4 w-4" />
          Add Status
        </button>
      </div>

      {stagesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-16">
          <QueueListIcon className="mb-3 h-10 w-10 text-neutral-300" />
          <h3 className="text-lg font-bold text-neutral-900">No statuses yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-neutral-500">Create your first pipeline status to start organizing leads.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
          {stages.map((stage, index) => (
            <div key={stage.id} className={`flex items-center gap-4 px-4 py-3.5 sm:px-6 ${stage.isActive ? '' : 'opacity-55'}`}>
              <div className="flex flex-col">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || reorder.isPending}
                  className="rounded p-0.5 text-neutral-300 hover:text-neutral-700 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === stages.length - 1 || reorder.isPending}
                  className="rounded p-0.5 text-neutral-300 hover:text-neutral-700 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
              </div>

              <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-neutral-900">{stage.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kindBadge(stage.kind)}`}>
                    {KIND_OPTIONS.find((k) => k.value === stage.kind)?.label || stage.kind}
                  </span>
                  {!stage.isActive && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">Hidden</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => update.mutate({ id: stage.id, body: { isActive: !stage.isActive } })}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-100"
                  title={stage.isActive ? 'Hide from pickers' : 'Show in pickers'}
                >
                  {stage.isActive ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => { setEditing(stage); setShowForm(true); }}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  title="Edit"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(stage)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <StageFormModal
          stage={editing}
          isSaving={isSaving}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Delete Status</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Delete <strong>"{deleteConfirm.name}"</strong>? Leads currently in this status will become status-less until moved.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
              <button
                onClick={() => remove.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) })}
                disabled={remove.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {remove.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
