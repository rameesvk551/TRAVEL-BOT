import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadSourcesApi } from '../../api/leadSourcesApi';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';

function LeadSourceFormModal({ leadSource, onClose, onSuccess }) {
  const [name, setName] = useState(leadSource?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (leadSource) {
        await leadSourcesApi.update(leadSource.id, { name });
      } else {
        await leadSourcesApi.create({ name });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lead source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200">
            <FunnelIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {leadSource ? 'Edit Lead Source' : 'New Lead Source'}
            </h2>
            <p className="text-xs text-neutral-500">
              {leadSource
                ? 'Update the lead source name'
                : 'Add a new source for tracking leads'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
              Source Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Google Ads, Referral, JustDial"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:shadow-violet-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : leadSource ? 'Update Source' : 'Create Source'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function SettingsLeadSources() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: leadSources = [], isLoading } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => leadSourcesApi.list().then((res) => res.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => leadSourcesApi.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-sources'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadSourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
      setDeleteConfirm(null);
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Failed to delete lead source');
      setDeleteConfirm(null);
    },
  });

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingType(null);
    queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
  };

  const activeSources = leadSources.filter((t) => t.isActive);
  const inactiveSources = leadSources.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">Lead Sources</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage where your leads come from to track marketing performance.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingType(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:shadow-violet-300"
        >
          <PlusIcon className="h-4 w-4" />
          Add Source
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-8 w-8 animate-spin text-violet-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-neutral-500">Loading lead sources...</p>
          </div>
        </div>
      ) : leadSources.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-gradient-to-b from-neutral-50 to-white py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100">
            <QueueListIcon className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="mb-1 text-lg font-bold text-neutral-900">No lead sources</h3>
          <p className="mb-6 max-w-sm text-center text-sm text-neutral-500">
            Create sources like Facebook Ad, WhatsApp Organic, or JustDial to categorize your leads.
          </p>
          <button
            onClick={() => {
              setEditingType(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:shadow-violet-300"
          >
            <PlusIcon className="h-4 w-4" />
            Create Your First Source
          </button>
        </div>
      ) : (
        /* Type List */
        <div className="space-y-4">
          {/* Active Types */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                Active Sources ({activeSources.length})
              </h3>
            </div>

            {activeSources.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-400">
                No active lead sources
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {activeSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-neutral-50/60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100">
                        <FunnelIcon className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{source.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-3 w-3" />
                            Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingType(source);
                          setShowForm(true);
                        }}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate({ id: source.id, isActive: false })}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        title="Deactivate"
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(source)}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Types */}
          {inactiveSources.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Inactive Sources ({inactiveSources.length})
                </h3>
              </div>
              <div className="divide-y divide-neutral-100">
                {inactiveSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between px-6 py-4 opacity-60 transition-all hover:opacity-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                        <FunnelIcon className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-600">{source.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                            Inactive
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: source.id, isActive: true })}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                        title="Reactivate"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(source)}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <LeadSourceFormModal
          leadSource={editingType}
          onClose={() => {
            setShowForm(false);
            setEditingType(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Delete Lead Source</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This action cannot be undone.
              Existing leads with this source will remain unaffected.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
