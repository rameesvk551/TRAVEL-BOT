// FILE: /frontend/src/pages/Properties.jsx

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CurrencyRupeeIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  BuildingOffice2Icon,
  SparklesIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { propertiesApi } from '../api/propertiesApi';
import { formatCurrency } from '../utils/formatters';
import { useAuthStore } from '../store/authStore';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';
import PropertyCard from '../components/PropertyCard';


const PROPERTY_TYPE_ICONS = {
  Hotel: BuildingOffice2Icon,
  Resort: SparklesIcon,
  Villa: HomeModernIcon,
  Apartment: Squares2X2Icon,
};

const PROPERTY_TYPE_COLORS = {
  Hotel: 'bg-blue-50 text-blue-600',
  Resort: 'bg-amber-50 text-amber-600',
  Villa: 'bg-emerald-50 text-emerald-600',
  Apartment: 'bg-violet-50 text-violet-600',
};

export default function Properties() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agentRole = useAuthStore((state) => state.agent?.role);
  const canManage = agentRole === 'ADMIN';

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openMenuId, setOpenMenuId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.list(),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (property) => (
      property.isActive
        ? propertiesApi.delete(property.id)
        : propertiesApi.update(property.id, { isActive: true })
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const allProperties = data?.data || [];

  // Filtering
  const properties = allProperties.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.location?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && p.propertyType !== typeFilter) return false;
    if (statusFilter === 'ACTIVE' && !p.isActive) return false;
    if (statusFilter === 'INACTIVE' && p.isActive) return false;
    return true;
  });

  // Stats
  const totalProperties = allProperties.length;
  const activeProperties = allProperties.filter((p) => p.isActive).length;
  const propertyTypes = [...new Set(allProperties.map((p) => p.propertyType).filter(Boolean))];

  return (
    <div className="w-full space-y-6">
      {/* ── Page Header ── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="eyebrow">Workspace</p>
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Inventory</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">Properties</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage your portfolio of hotels, resorts, villas, and apartments.</p>
        </div>
        {canManage && (
          <button type="button" onClick={() => navigate('/properties/new')} className="shell-button-primary">
            <PlusIcon className="h-4 w-4" />
            Add Property
          </button>
        )}
      </section>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Properties', value: totalProperties, icon: HomeModernIcon, color: 'bg-neutral-100 text-neutral-700' },
          { label: 'Active', value: activeProperties, icon: SparklesIcon, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Inactive', value: totalProperties - activeProperties, icon: EyeIcon, color: 'bg-slate-50 text-slate-500' },
          { label: 'Types', value: propertyTypes.length, icon: Squares2X2Icon, color: 'bg-indigo-50 text-indigo-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex items-center gap-3">
              <div className={`kpi-icon ${kpi.color} rounded-[var(--radius-md)]`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">{kpi.label}</p>
                <p className="text-xl font-bold text-neutral-900 leading-tight">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="shell-panel px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            {/* Search */}
            <div className="input-icon-wrapper flex-1 max-w-xs">
              <MagnifyingGlassIcon className="icon-left" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search properties..."
                className="shell-input input-with-icon"
              />
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="shell-input-rect w-auto min-w-[120px]"
            >
              <option value="ALL">All Types</option>
              <option value="Hotel">Hotel</option>
              <option value="Resort">Resort</option>
              <option value="Villa">Villa</option>
              <option value="Apartment">Apartment</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="shell-input-rect w-auto min-w-[120px] hidden sm:block"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="hidden md:flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center rounded-md p-2 transition ${viewMode === 'grid' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center justify-center rounded-md p-2 transition ${viewMode === 'table' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account can view properties, but only ADMIN users can create, edit, or deactivate them.
        </div>
      )}

      {/* ── Mobile Cards ── */}
      <div className="mobile-card-list">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mobile-record-card">
              <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, j) => <div key={j} className="h-10 animate-pulse rounded bg-neutral-100" />)}
              </div>
            </div>
          ))
        ) : properties.length === 0 ? (
          <div className="mobile-record-card flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mb-4">
              <HomeModernIcon className="h-8 w-8 text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-600">No properties found</p>
            <p className="text-xs text-neutral-400 mt-1">Add your first property to get started.</p>
          </div>
        ) : (
          properties.map((property) => {
            const TypeIcon = PROPERTY_TYPE_ICONS[property.propertyType] || HomeModernIcon;
            const typeColor = PROPERTY_TYPE_COLORS[property.propertyType] || 'bg-neutral-100 text-neutral-600';
            return (
              <MobileRecordCard
                key={property.id}
                title={property.name}
                subtitle={property.location || property.propertyType || 'Property'}
                avatar={property.imageUrl ? (
                  <img src={property.imageUrl} alt={property.name} className="h-12 w-12 rounded-xl border border-neutral-200 object-cover shadow-sm" />
                ) : (
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${typeColor}`}>
                    <TypeIcon className="h-5 w-5" />
                  </div>
                )}
                badge={
                  <span className={`badge ${property.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {property.isActive ? 'Active' : 'Inactive'}
                  </span>
                }
                actions={(
                  <>
                    <button type="button" onClick={() => navigate(`/properties/${property.id}`)} className="shell-button-secondary flex-1 py-2 text-xs">
                      <EyeIcon className="h-3.5 w-3.5" /> Details
                    </button>
                    {canManage && (
                      <>
                        <button type="button" onClick={() => navigate(`/properties/${property.id}/edit`)} className="shell-button-secondary flex-1 py-2 text-xs">
                          <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => toggleActiveMutation.mutate(property)} className="shell-button-secondary flex-1 py-2 text-xs">
                          {property.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </>
                )}
              >
                <MobileField label="Type" value={property.propertyType || '-'} />
                <MobileField label="Location" value={property.location || '-'} />
                <MobileField label="Price/Night" value={property.pricePerNight ? formatCurrency(property.pricePerNight) : '-'} />
                <MobileField label="Address" value={property.address ? property.address.slice(0, 40) : '-'} />
              </MobileRecordCard>
            );
          })
        )}
      </div>

      {/* ── Desktop Grid View ── */}
      {viewMode === 'grid' && (
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shell-panel overflow-hidden">
                <div className="h-48 animate-pulse bg-neutral-100" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>
            ))
          ) : properties.length === 0 ? (
            <div className="col-span-full">
              <div className="shell-panel flex flex-col items-center justify-center py-20">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-50 mb-5">
                  <HomeModernIcon className="h-10 w-10 text-neutral-300" />
                </div>
                <p className="text-lg font-semibold text-neutral-700">No properties yet</p>
                <p className="text-sm text-neutral-400 mt-1 mb-5">Start by adding your first property to the portfolio.</p>
                {canManage && (
                  <button type="button" onClick={() => navigate('/properties/new')} className="shell-button-primary">
                    <PlusIcon className="h-4 w-4" /> Add First Property
                  </button>
                )}
              </div>
            </div>
          ) : (
            properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                canManage={canManage}
                onEdit={() => navigate(`/properties/${property.id}/edit`)}
                toggleActive={() => toggleActiveMutation.mutate(property)}
                onClick={() => navigate(`/properties/${property.id}`)}
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
                  {['Property', 'Type', 'Location', 'Price / Night', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="data-table-th">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="data-table-td"><div className="h-4 animate-pulse rounded bg-neutral-100" /></td>
                      ))}
                    </tr>
                  ))
                ) : properties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <HomeModernIcon className="h-10 w-10 text-neutral-200 mb-3" />
                        <p className="text-sm font-medium text-neutral-600">No properties found</p>
                        <p className="text-xs text-neutral-400 mt-1">Try adjusting your filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  properties.map((property) => {
                    const TypeIcon = PROPERTY_TYPE_ICONS[property.propertyType] || HomeModernIcon;
                    const typeColor = PROPERTY_TYPE_COLORS[property.propertyType] || 'bg-neutral-100 text-neutral-600';
                    return (
                      <tr
                        key={property.id}
                        className="data-table-row"
                        onClick={() => navigate(`/properties/${property.id}`)}
                      >
                        <td className="data-table-td">
                          <div className="flex items-center gap-3">
                            {property.imageUrl ? (
                              <img src={property.imageUrl} alt={property.name} className="h-12 w-12 flex-shrink-0 rounded-xl object-cover border border-neutral-200 shadow-sm" />
                            ) : (
                              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${typeColor}`}>
                                <TypeIcon className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">{property.name}</p>
                              {property.description && <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">{property.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="data-table-td">
                          <span className={`badge ${typeColor}`}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {property.propertyType}
                          </span>
                        </td>
                        <td className="data-table-td">
                          {property.location ? (
                            <div className="flex items-center gap-1.5 text-neutral-600">
                              <MapPinIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                              <span className="text-sm">{property.location}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="data-table-td">
                          <span className="text-sm font-semibold text-neutral-900">
                            {property.pricePerNight ? formatCurrency(property.pricePerNight) : <span className="text-neutral-300">—</span>}
                          </span>
                        </td>
                        <td className="data-table-td">
                          <span className={`badge ${property.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {property.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="data-table-td text-right">
                          {canManage ? (
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => navigate(`/properties/${property.id}`)} className="shell-button-ghost p-2" title="View details">
                                <EyeIcon className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => navigate(`/properties/${property.id}/edit`)} className="shell-button-ghost p-2" title="Edit">
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActiveMutation.mutate(property)}
                                className="shell-button-ghost p-2 text-neutral-400 hover:text-rose-600"
                                title={property.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }} className="shell-button-secondary py-1.5 px-3 text-xs">
                              Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
