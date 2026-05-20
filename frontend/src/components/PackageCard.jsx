import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function PackageCard({ pkg, onEdit, onToggleActive, canManage, onClick }) {
  const isActive = pkg.isActive;

  const statusLabel = isActive ? 'Available' : 'Inactive';
  const statusColor = isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-400 text-white';

  // Category label
  const categoryLabel = pkg.category || 'Package';

  return (
    <div
      className="package-listing-card group"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="package-card-image-wrapper">
        {pkg.imageUrl ? (
          <img
            src={pkg.imageUrl}
            alt={pkg.name}
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

        {/* Arrow Button */}
        <div className="absolute right-2.5 top-2.5">
          <button className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/80 text-neutral-700 shadow-sm backdrop-blur-sm transition-all hover:scale-110 hover:bg-white hover:shadow-md">
            <ArrowUpRightIcon className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="line-clamp-1 text-[13px] font-bold leading-snug text-neutral-900">
          {pkg.name}
        </h3>

        <div className="mt-1 flex items-center gap-1 text-neutral-500">
          <MapPinIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
          <span className="truncate text-[11px] font-medium">{pkg.destinations?.join(', ') || 'Various Locations'}</span>
        </div>

        {/* Feature Tags Row */}
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden text-[10px] font-medium text-neutral-500">
          {pkg.duration && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              <ClockIcon className="h-3 w-3" />
              {pkg.duration}
            </span>
          )}
          {pkg.category && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              {pkg.category}
            </span>
          )}
          {pkg.inclusions?.slice(0, 1).map((inc, idx) => (
            <span key={idx} className="truncate rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              {inc}
            </span>
          ))}
        </div>

        {/* Price Row */}
        <div className="mt-2.5 flex items-end justify-between">
          <span className="text-[17px] font-black tracking-tight text-neutral-900">
            {formatCurrency(pkg.basePrice)}
          </span>
          <span className="text-[9px] font-semibold tracking-wide text-neutral-400">
            {categoryLabel}
          </span>
        </div>

        {/* Management Actions */}
        {canManage && (
          <div className="absolute inset-x-2.5 bottom-2.5 hidden gap-2 rounded-lg bg-white/95 p-1.5 shadow-lg ring-1 ring-neutral-100 backdrop-blur-sm group-hover:flex">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(pkg); }}
              className="flex-1 rounded-md bg-neutral-900 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleActive(pkg); }}
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
