// FILE: /frontend/src/pages/Cruises.jsx

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  GlobeAmericasIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../components/Pagination';
import { cruisesApi } from '../api/cruisesApi';
import { useAuthStore } from '../store/authStore';
import { agentHasPermission } from '../utils/permissions';
import CruiseCard from '../components/CruiseCard';
import BottomFiltersDrawer from '../components/BottomFiltersDrawer';
import { formatCurrency } from '../utils/formatters';

const ITEMS_PER_PAGE = 15;

const FILTER_TABS = [
  { key: 'ALL', label: 'All Cruises' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'name', label: 'Name A-Z' },
];

function normalizeCruisePage(response) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return {
    items,
    total: Number(payload?.total ?? items.length) || 0,
  };
}

export default function Cruises() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agent = useAuthStore((state) => state.agent);
  const canManage = agentHasPermission(agent, 'cruises.manage');

  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const effectiveViewMode = isMobile ? 'list' : viewMode;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setViewMode('list');
    };
    if (window.innerWidth < 768) setViewMode('list');
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch cruises
  const { data, isLoading } = useQuery({
    queryKey: ['cruises', { tab: activeTab, search, sortBy, page: currentPage, pageSize: ITEMS_PER_PAGE }],
    queryFn: () =>
      cruisesApi.list({
        tab: activeTab,
        search,
        sortBy,
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        paginated: 'true',
      }),
  });

  const { items: cruisesList, total: totalItems } = normalizeCruisePage(data);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (cruise) => cruisesApi.update(cruise.id, { isActive: !cruise.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cruises'] });
    },
  });

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  const filtersActive = activeTab !== 'ALL' || sortBy !== 'newest';

  return (
    <div className="w-full space-y-6 page-enter">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight md:text-2xl">Cruises</h1>
          <p className="text-xs text-neutral-500 mt-0.5 md:text-sm">Manage cruise itineraries and booking options for customers</p>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center md:gap-3">
          <div className="relative flex items-center w-full md:w-auto">
            <MagnifyingGlassIcon className="absolute left-3.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search cruises..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-50 md:w-[280px]"
            />
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => navigate('/cruises/new')}
              className="listing-add-button w-full justify-center md:w-auto"
            >
              <PlusIcon className="h-4 w-4" /> New Cruise
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
          {filtersActive && (
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
        />
      )}

      {/* ── Grid View (desktop only) ── */}
      {effectiveViewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="package-listing-card animate-pulse">
                <div className="package-card-image-wrapper bg-neutral-100 min-h-[140px]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-1/3 rounded bg-neutral-100" />
                  <div className="h-5 w-2/3 rounded bg-neutral-100" />
                  <div className="h-4 w-1/2 rounded bg-neutral-100" />
                  <div className="h-6 w-1/4 rounded bg-neutral-100 mt-4" />
                </div>
              </div>
            ))
          ) : cruisesList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
              <GlobeAmericasIcon className="h-10 w-10 text-neutral-300 mb-3 animate-bounce" />
              <p className="text-sm font-medium text-neutral-600">No cruises found</p>
            </div>
          ) : (
            cruisesList.map((cruise) => (
              <CruiseCard
                key={cruise.id}
                cruise={cruise}
                canManage={canManage}
                onEdit={() => navigate(`/cruises/${cruise.id}/edit`)}
                onToggleActive={(c) => toggleActiveMutation.mutate(c)}
                onClick={() => navigate(`/cruises/${cruise.id}/edit`)}
              />
            ))
          )}
        </div>
      )}

      {/* ── List View (default on mobile) ── */}
      {effectiveViewMode === 'list' && (
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100 animate-pulse">
                <div className="h-16 w-16 bg-neutral-100 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/4 rounded bg-neutral-100" />
                  <div className="h-4 w-2/3 rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100" />
                </div>
              </div>
            ))
          ) : cruisesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
              <GlobeAmericasIcon className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-sm font-medium text-neutral-600">No cruises found</p>
            </div>
          ) : (
            cruisesList.map((cruise) => (
              <div
                key={cruise.id}
                onClick={() => navigate(`/cruises/${cruise.id}/edit`)}
                className="listing-list-card group"
              >
                {/* Thumbnail */}
                <div className="listing-list-card-image">
                  {cruise.imageUrl ? (
                    <img src={cruise.imageUrl} alt={cruise.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-neutral-50">
                      <GlobeAmericasIcon className="h-6 w-6 text-indigo-300" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 truncate">
                      {cruise.cruiseLine || 'Cruise'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cruise.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {cruise.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 truncate group-hover:text-indigo-600 transition-colors">
                    {cruise.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    {cruise.departurePort && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPinIcon className="h-3 w-3 shrink-0 text-neutral-400" />
                        {cruise.departurePort}
                      </span>
                    )}
                    {cruise.duration && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <ClockIcon className="h-3 w-3 shrink-0 text-neutral-400" />
                        {cruise.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + Actions */}
                <div className="shrink-0 flex flex-col items-end justify-center pr-3 sm:pr-4 gap-1">
                  <span className="text-sm font-black text-neutral-900 whitespace-nowrap">
                    {cruise.basePrice ? formatCurrency(cruise.basePrice) : '—'}
                  </span>
                  <span className="text-[9px] font-medium text-neutral-400">base price</span>
                </div>

                {/* Hover Actions (desktop) */}
                {canManage && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden gap-1.5 opacity-0 group-hover:opacity-100 group-hover:flex transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/cruises/${cruise.id}/edit`)}
                      className="rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActiveMutation.mutate(cruise)}
                      className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-200"
                    >
                      {cruise.isActive ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemLabel="cruises"
        />
      )}
    </div>
  );
}
