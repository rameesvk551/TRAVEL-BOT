import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function PackageCard({ pkg, onEdit, onDelete, canManage, onClick }) {
  const isActive = pkg.isActive;

  const statusLabel = isActive ? 'Available' : 'Inactive';
  const statusColor = isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-400 text-white';

  // Category label
  const categoryLabel = pkg.category || 'Package';

  return (
    <div
      className="property-listing-card group"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="property-card-image-wrapper">
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
        <div className="absolute top-3 left-3">
          <span className={`${statusColor} text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm`}>
            {statusLabel}
          </span>
        </div>

        {/* Arrow Button */}
        <div className="absolute top-3 right-3">
          <button className="h-8 w-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-neutral-700 shadow-sm border border-white/50 transition-all hover:bg-white hover:scale-110 hover:shadow-md">
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-5">
        <h3 className="text-[15px] font-bold text-neutral-900 leading-snug line-clamp-1">
          {pkg.name}
        </h3>

        <div className="mt-1.5 flex items-center gap-1 text-neutral-500">
          <MapPinIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
          <span className="text-xs font-medium truncate">{pkg.destinations?.join(', ') || 'Various Locations'}</span>
        </div>

        {/* Feature Tags Row */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500 font-medium">
          {pkg.duration && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              <ClockIcon className="h-3 w-3" />
              {pkg.duration}
            </span>
          )}
          {pkg.category && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {pkg.category}
            </span>
          )}
          {pkg.inclusions?.slice(0, 1).map((inc, idx) => (
            <span key={idx} className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {inc}
            </span>
          ))}
        </div>

        {/* Price Row */}
        <div className="mt-4 flex items-end justify-between">
          <span className="text-xl font-black text-neutral-900 tracking-tight">
            {formatCurrency(pkg.basePrice)}
          </span>
          <span className="text-[10px] font-semibold text-neutral-400 tracking-wide">
            {categoryLabel}
          </span>
        </div>

        {/* Management Actions */}
        {canManage && (
          <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(pkg); }}
              className="flex-1 text-[11px] font-bold py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(pkg.id); }}
              className="flex-1 text-[11px] font-bold py-2 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition"
            >
              {isActive ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
