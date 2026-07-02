// FILE: /frontend/src/pages/Visas.jsx

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../components/Pagination';
import { visasApi } from '../api/visasApi';
import { useAuthStore } from '../store/authStore';
import { agentHasPermission } from '../utils/permissions';
import VisaCard from '../components/VisaCard';
import { formatCurrency } from '../utils/formatters';

const ITEMS_PER_PAGE = 15;

const FILTER_TABS = [
  { key: 'ALL', label: 'All Visas' },
  { key: 'Tourist', label: 'Tourist' },
  { key: 'Business', label: 'Business' },
  { key: 'Student', label: 'Student' },
  { key: 'Work', label: 'Work' },
  { key: 'INACTIVE', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'country', label: 'Country A-Z' },
];

function normalizeVisaPage(response) {
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

export default function Visas() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agent = useAuthStore((state) => state.agent);
  const canManage = agentHasPermission(agent, 'visas.manage');

  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch visas
  const { data, isLoading } = useQuery({
    queryKey: ['visas', { tab: activeTab, search, sortBy, page: currentPage, pageSize: ITEMS_PER_PAGE }],
    queryFn: () =>
      visasApi.list({
        tab: activeTab,
        search,
        sortBy,
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        paginated: 'true',
      }),
  });

  const { items: visasList, total: totalItems } = normalizeVisaPage(data);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (visa) => visasApi.update(visa.id, { isActive: !visa.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visas'] });
    },
  });

  // Handle Tab change
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Visas</h1>
          <p className="text-sm text-neutral-500">Manage visa services, pricing, processing times, and document requirements</p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/visas/new')}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-neutral-800"
          >
            <PlusIcon className="h-4 w-4" />
            New Visa
          </button>
        )}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-100 pb-2">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                activeTab === tab.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sort & View Mode */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search visas..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-9 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-1 transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'}`}
              title="Grid View"
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-1 transition ${viewMode === 'list' ? 'bg-white shadow-sm text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'}`}
              title="List View"
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Listings */}
      {viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          ) : visasList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
              <DocumentDuplicateIcon className="h-10 w-10 text-neutral-300 mb-3 animate-pulse" />
              <p className="text-sm font-medium text-neutral-600">No visas found</p>
            </div>
          ) : (
            visasList.map((visa) => (
              <VisaCard
                key={visa.id}
                visa={visa}
                canManage={canManage}
                onEdit={() => navigate(`/visas/${visa.id}/edit`)}
                onToggleActive={(v) => toggleActiveMutation.mutate(v)}
                onClick={() => navigate(`/visas/${visa.id}/edit`)}
              />
            ))
          )}
        </div>
      ) : (
        /* List View */
        <div className="flex flex-col gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-neutral-100 animate-pulse">
                <div className="h-16 w-16 bg-neutral-100 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-1/4 rounded bg-neutral-100" />
                  <div className="h-5 w-1/2 rounded bg-neutral-100" />
                </div>
              </div>
            ))
          ) : visasList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
              <DocumentDuplicateIcon className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-sm font-medium text-neutral-600">No visas found</p>
            </div>
          ) : (
            visasList.map((visa) => (
              <div
                key={visa.id}
                onClick={() => navigate(`/visas/${visa.id}/edit`)}
                className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white rounded-xl border border-neutral-100 hover:border-indigo-100 hover:shadow-sm transition cursor-pointer group relative"
              >
                {/* Flag emoji or custom image */}
                <div className="h-16 w-16 shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 border border-neutral-100 text-3xl">
                  {visa.imageUrl ? (
                    <img src={visa.imageUrl} alt={visa.country} className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <span>🌐</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                      {visa.visaType || 'Tourist'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${visa.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {visa.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 truncate group-hover:text-indigo-600 transition-colors">
                    {visa.country}
                  </h3>
                  <div className="text-xs text-neutral-500 flex items-center justify-center sm:justify-start gap-2">
                    <span>Processing: {visa.processingTime || '-'}</span>
                    {visa.validityPeriod && (
                      <>
                        <span>·</span>
                        <span>Validity: {visa.validityPeriod}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-right flex flex-col items-center sm:items-end justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
                  <span className="text-base font-black text-neutral-900">
                    {visa.price ? `Rs ${(visa.price / 100).toLocaleString('en-IN')}` : 'Price on request'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">fees & service charge</span>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="absolute right-4 top-4 sm:relative sm:right-0 sm:top-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/visas/${visa.id}/edit`)}
                      className="rounded bg-neutral-900 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActiveMutation.mutate(visa)}
                      className="rounded bg-neutral-100 px-2.5 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                    >
                      {visa.isActive ? 'Hide' : 'Show'}
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
          itemLabel="visas"
        />
      )}
    </div>
  );
}
