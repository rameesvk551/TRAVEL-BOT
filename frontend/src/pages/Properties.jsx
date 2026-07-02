// FILE: /frontend/src/pages/Properties.jsx

import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../components/Pagination';
import { propertiesApi } from '../api/propertiesApi';
import { useAuthStore } from '../store/authStore';
import { agentHasPermission } from '../utils/permissions';
import PropertyCard from '../components/PropertyCard';
import PropertyListCard from '../components/PropertyListCard';
import BottomFiltersDrawer from '../components/BottomFiltersDrawer';

const ITEMS_PER_PAGE = 15;

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
  const agent = useAuthStore((state) => state.agent);
  const canManage = agentHasPermission(agent, 'properties.manage');

  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const effectiveViewMode = isMobile ? 'list' : viewMode;
  const listParams = useMemo(() => ({
    paginated: true,
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    search: search || undefined,
    tab: activeTab,
    type: typeFilter !== 'ALL' ? typeFilter : undefined,
    sortBy,
  }), [activeTab, currentPage, search, sortBy, typeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['properties', listParams],
    queryFn: () => propertiesApi.list(listParams),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (property) => (
      property.isActive
        ? propertiesApi.delete(property.id)
        : propertiesApi.update(property.id, { isActive: true })
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const propertiesResponse = data?.data || {};
  const paginatedProperties = propertiesResponse.data || [];
  const totalItems = Number(propertiesResponse.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setViewMode('list');
    };
    // set initial mode for mobile
    if (window.innerWidth < 768) setViewMode('list');
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full space-y-6 page-enter">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight md:text-2xl">Properties</h1>
          <p className="text-xs text-neutral-500 mt-0.5 md:text-sm">Manage and view all your property listings</p>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center md:gap-3">
          <div className="relative flex items-center w-full md:w-auto">
            <MagnifyingGlassIcon className="absolute left-3.5 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by property, location, or client"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-50 md:w-[300px]"
            />
          </div>
          {canManage && (
            <button type="button" onClick={() => navigate('/properties/new')} className="listing-add-button w-full justify-center md:w-auto">
              <PlusIcon className="h-4 w-4" /> Add Property
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile: Filter button ── */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setShowMoreFilters(true)}
          className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-95"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-neutral-500" />
          Filters
          {(activeTab !== 'ALL' || sortBy !== 'newest' || typeFilter !== 'ALL') && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-neutral-900" />
          )}
        </button>
      </div>

      {/* ── Desktop: Filter Tabs + Sort Bar ── */}
      <div className="hidden md:flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleFilterChange(setActiveTab)(tab.key)}
              className={`listing-filter-tab shrink-0 ${activeTab === tab.key ? 'listing-filter-tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 outline-none cursor-pointer focus:border-neutral-300"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-0.5 rounded-xl border border-neutral-200 p-0.5 bg-white">
            <button type="button" onClick={() => setViewMode('grid')} className={`listing-view-toggle ${viewMode === 'grid' ? 'listing-view-toggle-active' : ''}`}>
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setViewMode('list')} className={`listing-view-toggle ${viewMode === 'list' ? 'listing-view-toggle-active' : ''}`}>
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: Bottom drawer with ALL filters ── */}
      {isMobile && (
        <BottomFiltersDrawer
          open={showMoreFilters}
          onClose={() => setShowMoreFilters(false)}
          tabs={FILTER_TABS}
          activeTab={activeTab}
          onTabChange={(val) => handleFilterChange(setActiveTab)(val)}
          sortOptions={SORT_OPTIONS}
          sortBy={sortBy}
          onSortChange={setSortBy}
          extraFilters={[{
            label: 'Property Type',
            value: typeFilter,
            onChange: (val) => handleFilterChange(setTypeFilter)(val),
            options: [
              { key: 'ALL', label: 'All Types' },
              { key: 'Hotel', label: 'Hotel' },
              { key: 'Resort', label: 'Resort' },
              { key: 'Villa', label: 'Villa' },
              { key: 'Apartment', label: 'Apartment' },
            ],
          }]}
        />
      )}

      {/* ── Admin Notice ── */}
      {!canManage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account can view properties, but only ADMIN users can create, edit, or deactivate them.
        </div>
      )}

      {/* ── Grid View ── */}
      {effectiveViewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {isLoading ? (
            Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
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
      {effectiveViewMode === 'list' && (
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
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemLabel="properties"
        />
      )}
    </div>
  );
}
