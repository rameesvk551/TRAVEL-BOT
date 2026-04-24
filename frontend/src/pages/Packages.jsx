import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MapPinIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import { packagesApi } from '../api/packagesApi';
import { formatCurrency } from '../utils/formatters';
import { useAuthStore } from '../store/authStore';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';
import PackageCard from '../components/PackageCard';

export default function Packages() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agentRole = useAuthStore((state) => state.agent?.role);
  const canManagePackages = agentRole === 'ADMIN';
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const { data, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => packagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  const packages = data?.data || [];

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="eyebrow">Workspace</p>
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Inventory</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">Packages</h1>
          <p className="text-sm text-neutral-500 mt-1">Maintain the itinerary catalog used for quoting and chat flows.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-neutral-200 p-1 bg-white">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center rounded-lg px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Squares2X2Icon className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-bold">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center justify-center rounded-lg px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <ListBulletIcon className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-bold">Table</span>
            </button>
          </div>

          {canManagePackages && (
            <button type="button" onClick={() => navigate('/packages/new')} className="shell-button-primary">
              <PlusIcon className="h-4 w-4" />
              New Package
            </button>
          )}
        </div>
      </section>

      {!canManagePackages && (
        <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account can view packages, but only ADMIN users can create, edit, or deactivate them.
        </div>
      )}

      {/* ── Mobile Cards ── */}
      <div className="mobile-card-list">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mobile-record-card animate-pulse">
              <div className="h-5 w-2/3 rounded bg-neutral-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, j) => <div key={j} className="h-10 rounded bg-neutral-100" />)}
              </div>
            </div>
          ))
        ) : packages.length === 0 ? (
          <div className="mobile-record-card text-center text-sm text-neutral-500 py-12">No packages created yet.</div>
        ) : (
          packages.map((pkg) => (
            <MobileRecordCard
              key={pkg.id}
              title={pkg.name}
              subtitle={pkg.summary || pkg.destinations?.join(', ') || 'Travel package'}
              avatar={pkg.imageUrl ? (
                <img src={pkg.imageUrl} alt={pkg.name} className="h-12 w-12 rounded-xl border border-neutral-200 object-cover shadow-sm" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
                  <MapPinIcon className="h-5 w-5 text-neutral-300" />
                </div>
              )}
              badge={<span className={`badge ${pkg.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{pkg.isActive ? 'Active' : 'Inactive'}</span>}
              actions={canManagePackages ? (
                <>
                  <button type="button" onClick={() => navigate(`/packages/${pkg.id}/edit`)} className="shell-button-secondary flex-1 py-2 text-xs">Edit</button>
                  <button type="button" onClick={() => deleteMutation.mutate(pkg.id)} className="shell-button-secondary flex-1 py-2 text-xs">{pkg.isActive ? 'Deactivate' : 'Activate'}</button>
                </>
              ) : null}
            >
              <MobileField label="Category" value={pkg.category || '-'} />
              <MobileField label="Duration" value={pkg.duration || '-'} />
              <MobileField label="Price" value={formatCurrency(pkg.basePrice)} />
              <MobileField label="Catalog" value={pkg.catalogSyncStatus || 'Not synced'} />
            </MobileRecordCard>
          ))
        )}
      </div>

      {/* ── Desktop Grid View ── */}
      {viewMode === 'grid' && (
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[32px] p-4 border border-neutral-100 animate-pulse">
                <div className="aspect-[4/3] rounded-[24px] bg-neutral-50" />
                <div className="mt-5 space-y-3 px-1">
                  <div className="h-6 w-3/4 rounded bg-neutral-50" />
                  <div className="h-4 w-1/2 rounded bg-neutral-50" />
                  <div className="pt-4 border-t border-neutral-50 flex justify-between">
                    <div className="h-8 w-24 rounded bg-neutral-50" />
                    <div className="h-8 w-16 rounded bg-neutral-50" />
                  </div>
                </div>
              </div>
            ))
          ) : packages.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-neutral-200">
              <MapPinIcon className="h-12 w-12 text-neutral-200 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No packages found.</p>
              <button onClick={() => navigate('/packages/new')} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">Create your first package</button>
            </div>
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                canManage={canManagePackages}
                onEdit={() => navigate(`/packages/${pkg.id}/edit`)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onClick={() => navigate(`/packages/${pkg.id}/edit`)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Desktop Table View ── */}
      {viewMode === 'table' && (
        <div className="data-table-wrapper hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="data-table-head">
                <tr>
                  {['Package', 'Category', 'Destinations', 'Duration', 'Price', 'Status', 'Catalog Status', 'Actions'].map((heading) => (
                    <th key={heading} className="data-table-th">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="data-table-td"><div className="h-4 animate-pulse rounded bg-neutral-50" /></td>
                      ))}
                    </tr>
                  ))
                ) : packages.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-neutral-400 text-sm">No packages created yet.</td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr key={pkg.id} className="data-table-row" onClick={() => navigate(`/packages/${pkg.id}/edit`)}>
                      <td className="data-table-td">
                        <div className="flex items-center gap-3">
                          {pkg.imageUrl ? (
                            <img
                              src={pkg.imageUrl}
                              alt={pkg.name}
                              className="h-12 w-12 flex-shrink-0 rounded-xl object-cover border border-neutral-200 shadow-sm"
                            />
                          ) : (
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-300">
                              <MapPinIcon className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-neutral-900 truncate">{pkg.name}</p>
                            {pkg.summary && <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">{pkg.summary}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="data-table-td">
                        <span className="badge bg-neutral-50 text-neutral-600">{pkg.category || '—'}</span>
                      </td>
                      <td className="data-table-td text-neutral-600 text-xs font-medium">
                        {pkg.destinations?.join(', ') || '—'}
                      </td>
                      <td className="data-table-td text-neutral-600 text-xs font-medium">
                        {pkg.duration || '—'}
                      </td>
                      <td className="data-table-td font-bold text-neutral-900">
                        {formatCurrency(pkg.basePrice)}
                      </td>
                      <td className="data-table-td">
                        <span className={`badge ${pkg.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {pkg.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="data-table-td">
                        {pkg.catalogSyncStatus === 'synced' ? (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synced
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" /> Not Synced
                          </span>
                        )}
                      </td>
                      <td className="data-table-td text-right">
                        {canManagePackages ? (
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => navigate(`/packages/${pkg.id}/edit`)} className="shell-button-ghost p-2">Edit</button>
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(pkg.id)}
                              className="shell-button-ghost p-2 text-neutral-400 hover:text-rose-600"
                            >
                              {pkg.isActive ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">View only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
