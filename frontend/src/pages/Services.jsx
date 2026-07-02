import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { servicesApi } from '../api/servicesApi';

/* ── Icon mapping ── */
const ICON_MAP = {
  plane: '✈️',
  train: '🚂',
  document: '📄',
  globe: '🌍',
  shield: '🛡️',
  car: '🚗',
  hotel: '🏨',
  stamp: '📝',
  file: '📁',
  default: '⚙️',
};

/* ── Category filter tabs ── */
const CATEGORY_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'TICKETING', label: 'Ticketing' },
  { key: 'DOCUMENTATION', label: 'Documentation' },
  { key: 'VISA', label: 'Visa' },
  { key: 'INSURANCE', label: 'Insurance' },
  { key: 'OTHER', label: 'Other' },
];

/* ── Category badge colors ── */
const CATEGORY_COLORS = {
  TICKETING: 'bg-blue-50 text-blue-700 border-blue-200',
  DOCUMENTATION: 'bg-amber-50 text-amber-700 border-amber-200',
  VISA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INSURANCE: 'bg-purple-50 text-purple-700 border-purple-200',
  OTHER: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

/* ── Price formatting helper ── */
function formatPrice(paise) {
  if (!paise && paise !== 0) return null;
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function Services() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  const listParams = useMemo(() => ({
    search: search || undefined,
    category: activeTab !== 'ALL' ? activeTab : undefined,
  }), [search, activeTab]);

  const { data, isLoading } = useQuery({
    queryKey: ['services', listParams],
    queryFn: () => servicesApi.list(listParams),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => servicesApi.update(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => servicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });

  const services = data?.data || [];

  const renderPricing = (service) => {
    if (service.pricingType === 'VARIABLE') {
      return <span className="text-sm font-semibold text-neutral-500 italic">Contact for pricing</span>;
    }
    if (service.pricingType === 'STARTING_FROM') {
      const price = formatPrice(service.basePrice);
      return price ? <span className="text-sm font-semibold text-neutral-900">From {price}</span> : null;
    }
    // FIXED
    const price = formatPrice(service.basePrice);
    return price ? <span className="text-sm font-semibold text-neutral-900">{price}</span> : null;
  };

  return (
    <div className="w-full space-y-6 page-enter">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight md:text-2xl">Services</h1>
          <p className="text-xs text-neutral-500 mt-0.5 md:text-sm">Manage the services your agency offers</p>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center md:gap-3">
          <div className="relative flex items-center w-full md:w-auto">
            <MagnifyingGlassIcon className="absolute left-3.5 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-50 md:w-[300px]"
            />
          </div>
          <Link to="/services/new" className="listing-add-button w-full justify-center md:w-auto">
            <PlusIcon className="h-4 w-4" /> Add Service
          </Link>
        </div>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`listing-filter-tab shrink-0 ${activeTab === tab.key ? 'listing-filter-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Card Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-neutral-100 mb-2" />
              <div className="h-3 w-2/3 rounded bg-neutral-100 mb-4" />
              <div className="h-5 w-1/3 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        /* ── Empty State ── */
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-50 mb-5">
            <span className="text-4xl">⚙️</span>
          </div>
          <p className="text-lg font-semibold text-neutral-700">No services found</p>
          <p className="text-sm text-neutral-400 mt-1 mb-5">Get started by adding the first service your agency offers.</p>
          <Link to="/services/new" className="listing-add-button">
            <PlusIcon className="h-4 w-4" /> Add First Service
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {services.map((service) => (
            <div
              key={service.id}
              className={`group relative rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md ${
                service.isActive === false ? 'opacity-60' : ''
              }`}
            >
              {service.imageUrl && (
                <div className="h-20 overflow-hidden rounded-t-xl bg-neutral-100">
                  <img
                    src={service.imageUrl}
                    alt={service.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-3">
                {/* Header: icon + name + badge */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-50 text-base shrink-0">
                    {ICON_MAP[service.icon] || ICON_MAP.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-neutral-900 truncate">{service.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold leading-4 ${CATEGORY_COLORS[service.category] || CATEGORY_COLORS.OTHER}`}>
                        {service.category}
                      </span>
                      {service.isActive === false && (
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0 text-[9px] font-semibold leading-4 text-red-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {service.description && (
                  <p className="text-[10px] text-neutral-500 leading-tight mb-2 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {/* Pricing */}
                <div className="mb-2">
                  {renderPricing(service)}
                </div>

                {/* Features pills */}
                {service.features && service.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {service.features.slice(0, 2).map((feature, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0 text-[9px] font-medium text-neutral-600 leading-4"
                      >
                        {feature}
                      </span>
                    ))}
                    {service.features.length > 2 && (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0 text-[9px] font-medium text-neutral-400 leading-4">
                        +{service.features.length - 2} more
                      </span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 pt-2 border-t border-neutral-100">
                  <Link
                    to={`/services/${service.id}/edit`}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <PencilSquareIcon className="h-3 w-3" /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: service.id, isActive: service.isActive })}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                      service.isActive === false
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-amber-600 hover:bg-amber-50'
                    }`}
                  >
                    {service.isActive === false ? 'Activate' : 'Deactivate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this service?')) deleteMutation.mutate(service.id);
                    }}
                    className="ml-auto flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
