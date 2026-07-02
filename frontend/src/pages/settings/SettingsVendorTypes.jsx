import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

function VendorTypeFormModal({ vendorType, onClose, onSuccess }) {
  const [name, setName] = useState(vendorType?.name || '');
  const [description, setDescription] = useState(vendorType?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (vendorType) {
        await api.put(`/vendor-types/${vendorType.id}`, { name, description });
      } else {
        await api.post('/vendor-types', { name, description });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vendor type');
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
            <TagIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {vendorType ? 'Edit Vendor Type' : 'New Vendor Type'}
            </h2>
            <p className="text-xs text-neutral-500">
              {vendorType
                ? 'Update the vendor type details'
                : 'A ledger group will be auto-created for this type'}
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
              Type Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Resort, Houseboat, Local Transport"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
              Description
            </label>
            <input
              type="text"
              placeholder="Optional description"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {!vendorType && (
            <div className="rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 p-3">
              <p className="text-xs text-violet-700 leading-relaxed">
                <strong>Auto Ledger:</strong> A ledger group "<em>{name || '...'} Vendors</em>" will be
                created under Supplier Payables in your Chart of Accounts.
              </p>
            </div>
          )}

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
              ) : vendorType ? 'Update Type' : 'Create Type'}
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

export default function SettingsVendorTypes() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: vendorTypes = [], isLoading } = useQuery({
    queryKey: ['vendor-types'],
    queryFn: () => api.get('/vendor-types').then((res) => res.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/vendor-types/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-types'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/vendor-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-types'] });
      setDeleteConfirm(null);
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Failed to delete vendor type');
      setDeleteConfirm(null);
    },
  });

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingType(null);
    queryClient.invalidateQueries({ queryKey: ['vendor-types'] });
  };

  const activeTypes = vendorTypes.filter((t) => t.isActive);
  const inactiveTypes = vendorTypes.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">Vendor Types</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Create and manage vendor categories. Each type auto-creates a ledger group for accounting.
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
          Add Vendor Type
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
            <p className="text-sm text-neutral-500">Loading vendor types...</p>
          </div>
        </div>
      ) : vendorTypes.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-gradient-to-b from-neutral-50 to-white py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100">
            <BuildingStorefrontIcon className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="mb-1 text-lg font-bold text-neutral-900">No vendor types yet</h3>
          <p className="mb-6 max-w-sm text-center text-sm text-neutral-500">
            Create vendor types like Resort, Flight, Bus, etc. Each type will get its own ledger group for clean accounting.
          </p>
          <button
            onClick={() => {
              setEditingType(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:shadow-xl hover:shadow-violet-300"
          >
            <PlusIcon className="h-4 w-4" />
            Create Your First Type
          </button>
        </div>
      ) : (
        /* Type List */
        <div className="space-y-4">
          {/* Active Types */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                Active Types ({activeTypes.length})
              </h3>
            </div>

            {activeTypes.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-400">
                No active vendor types
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {activeTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-neutral-50/60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100">
                        <TagIcon className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{type.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-3 w-3" />
                            Active
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-neutral-500">
                          {type.description && <span>{type.description}</span>}
                          <span className="font-medium text-violet-600">
                            {type.vendorCount || 0} vendor{(type.vendorCount || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingType(type);
                          setShowForm(true);
                        }}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate({ id: type.id, isActive: false })}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        title="Deactivate"
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(type)}
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
          {inactiveTypes.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Inactive Types ({inactiveTypes.length})
                </h3>
              </div>
              <div className="divide-y divide-neutral-100">
                {inactiveTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between px-6 py-4 opacity-60 transition-all hover:opacity-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                        <TagIcon className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-600">{type.name}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                            Inactive
                          </span>
                        </div>
                        {type.description && (
                          <p className="mt-0.5 text-xs text-neutral-400">{type.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: type.id, isActive: true })}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                        title="Reactivate"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(type)}
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
        <VendorTypeFormModal
          vendorType={editingType}
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
            <h3 className="text-lg font-bold text-neutral-900">Delete Vendor Type</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This action cannot be undone.
              The associated ledger group will remain in your chart of accounts.
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
