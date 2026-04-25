// FILE: /frontend/src/pages/Properties.jsx

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { propertiesApi } from '../api/propertiesApi';
import { useAuthStore } from '../store/authStore';
import PropertyCard from '../components/PropertyCard';
import PropertyListCard from '../components/PropertyListCard';

const ITEMS_PER_PAGE = 8;

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'FOR_SALE', label: 'For Sale' },
  { key: 'FOR_RENT', label: 'For Rent' },
  { key: 'INACTIVE', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'name', label: 'Name A-Z' },
];

export default function Properties() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agentRole = useAuthStore((state) => state.agent?.role);
  const canManage = agentRole === 'ADMIN';

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');

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
  const filtered = useMemo(() => {
    let result = [...allProperties];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.propertyType?.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (activeTab === 'FOR_SALE') result = result.filter((p) => p.isActive && p.listingStatus !== 'For Rent');
    else if (activeTab === 'FOR_RENT') result = result.filter((p) => p.listingStatus === 'For Rent');
    else if (activeTab === 'INACTIVE') result = result.filter((p) => !p.isActive);

    // Type filter
    if (typeFilter !== 'ALL') result = result.filter((p) => p.propertyType === typeFilter);

    // Sort
    if (sortBy === 'price_asc') result.sort((a, b) => (a.pricePerNight || 0) - (b.pricePerNight || 0));
    else if (sortBy === 'price_desc') result.sort((a, b) => (b.pricePerNight || 0) - (a.pricePerNight || 0));
    else if (sortBy === 'name') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return result;
  }, [allProperties, search, activeTab, typeFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedProperties = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <div className="w-full space-y-6 page-enter">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Properties</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Manage and view all your property listings</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute left-3.5 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by property, location, or client"
              className="w-[300px] rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50"
            />
          </div>

          {/* Add Property Button */}
          {canManage && (
            <button
              type="button"
              onClick={() => navigate('/properties/new')}
              className="listing-add-button"
            >
              <PlusIcon className="h-4 w-4" />
              Add Property
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Tabs + Sort Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab Buttons */}
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleFilterChange(setActiveTab)(tab.key)}
              className={`listing-filter-tab ${activeTab === tab.key ? 'listing-filter-tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}

          {/* More Filters */}
          <button
            type="button"
            onClick={() => setShowMoreFilters((prev) => !prev)}
            className="listing-filter-tab flex items-center gap-1.5"
          >
            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
            More Filters
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Short by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 outline-none cursor-pointer focus:border-emerald-300"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="hidden md:flex items-center gap-0.5 rounded-xl border border-neutral-200 p-0.5 bg-white">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`listing-view-toggle ${viewMode === 'grid' ? 'listing-view-toggle-active' : ''}`}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`listing-view-toggle ${viewMode === 'list' ? 'listing-view-toggle-active' : ''}`}
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── More Filters Panel ── */}
      {showMoreFilters && (
        <div className="flex items-center gap-3 flex-wrap animate-wizard-in">
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter)(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 outline-none cursor-pointer focus:border-emerald-300"
          >
            <option value="ALL">All Types</option>
            <option value="Hotel">Hotel</option>
            <option value="Resort">Resort</option>
            <option value="Villa">Villa</option>
            <option value="Apartment">Apartment</option>
          </select>
        </div>
      )}

      {/* ── Admin Notice ── */}
      {!canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account can view properties, but only ADMIN users can create, edit, or deactivate them.
        </div>
      )}

      {/* ── Grid View ── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="property-listing-card animate-pulse">
                <div className="property-card-image-wrapper bg-neutral-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-neutral-100" />
                  <div className="h-3 w-1/2 rounded bg-neutral-100" />
                  <div className="h-6 w-1/3 rounded bg-neutral-100 mt-4" />
                </div>
              </div>
            ))
          ) : paginatedProperties.length === 0 ? (
            <div className="col-span-full">
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-50 mb-5">
                  <HomeModernIcon className="h-10 w-10 text-neutral-300" />
                </div>
                <p className="text-lg font-semibold text-neutral-700">No properties found</p>
                <p className="text-sm text-neutral-400 mt-1 mb-5">Try adjusting your filters or add your first property.</p>
                {canManage && (
                  <button type="button" onClick={() => navigate('/properties/new')} className="listing-add-button">
                    <PlusIcon className="h-4 w-4" /> Add First Property
                  </button>
                )}
              </div>
            </div>
          ) : (
            paginatedProperties.map((property) => (
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

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="listing-list-card animate-pulse">
                <div className="listing-list-card-image bg-neutral-100" />
                <div className="flex-1 p-5 space-y-3">
                  <div className="h-5 w-1/2 rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100" />
                  <div className="h-6 w-1/4 rounded bg-neutral-100 mt-4" />
                </div>
              </div>
            ))
          ) : paginatedProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
              <HomeModernIcon className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-sm font-medium text-neutral-600">No properties found</p>
            </div>
          ) : (
            paginatedProperties.map((property) => (
              <PropertyListCard
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

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs text-neutral-500 font-medium">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} properties
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="listing-pagination-btn"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`listing-pagination-btn ${currentPage === page ? 'listing-pagination-btn-active' : ''}`}
                >
                  {page}
                </button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="px-1 text-neutral-400 text-xs">…</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className="listing-pagination-btn"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="listing-pagination-btn"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
