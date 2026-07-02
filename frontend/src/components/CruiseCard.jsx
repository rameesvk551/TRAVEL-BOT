// FILE: /frontend/src/components/CruiseCard.jsx

import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function CruiseCard({ cruise, onEdit, onToggleActive, canManage, onClick }) {
  const isActive = cruise.isActive;
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const statusColor = isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-400 text-white';

  return (
    <div
      className="package-listing-card group cursor-pointer"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="package-card-image-wrapper relative">
        {cruise.imageUrl ? (
          <img
            src={cruise.imageUrl}
            alt={cruise.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-neutral-50">
            <span className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">No Image</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute left-2.5 top-2.5">
          <span className={`${statusColor} rounded-md px-2 py-0.5 text-[9px] font-bold shadow-sm`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col justify-between flex-1 min-h-[160px]">
        <div>
          <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
            <span>{cruise.cruiseLine || 'Cruise'}</span>
          </div>
          <h3 className="mt-1 line-clamp-1 text-sm font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">
            {cruise.name}
          </h3>
        </div>

        {/* Attributes */}
        <div className="mt-2.5 flex flex-wrap gap-1 text-[10px] font-semibold text-neutral-500">
          {cruise.departurePort && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              <MapPinIcon className="h-3 w-3 shrink-0 text-neutral-400" />
              {cruise.departurePort}
            </span>
          )}
          {cruise.duration && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              <ClockIcon className="h-3 w-3 shrink-0 text-neutral-400" />
              {cruise.duration}
            </span>
          )}
          {cruise.destinations?.length > 0 && (
            <span className="truncate rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              {cruise.destinations.slice(0, 1).join(', ')}
              {cruise.destinations.length > 1 ? ` +${cruise.destinations.length - 1}` : ''}
            </span>
          )}
        </div>

        {/* Price Row */}
        <div className="mt-2.5 flex items-end justify-between border-t border-neutral-50 pt-2">
          <span className="text-[17px] font-black tracking-tight text-neutral-900">
            {cruise.basePrice ? formatCurrency(cruise.basePrice) : 'Price on request'}
          </span>
          <span className="text-[9px] font-semibold tracking-wide text-neutral-400">
            Cruise
          </span>
        </div>

        {/* Management Actions */}
        {canManage && (
          <div className="absolute inset-x-2.5 bottom-2.5 hidden gap-1.5 rounded-lg bg-white/95 p-1.5 shadow-lg ring-1 ring-neutral-100 backdrop-blur-sm group-hover:flex" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(cruise)}
              className="flex-1 rounded-md bg-neutral-900 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800"
            >
              Edit
            </button>
            <button
              onClick={() => onToggleActive(cruise)}
              className="flex-1 rounded-md bg-neutral-100 py-1.5 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-200"
            >
              {isActive ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
