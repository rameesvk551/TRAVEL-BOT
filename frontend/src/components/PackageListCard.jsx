import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function PackageListCard({ pkg, onEdit, onDelete, canManage, onClick }) {
  const isActive = pkg.isActive;
  const statusLabel = isActive ? 'Available' : 'Inactive';
  const statusColor = isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-400 text-white';
  const categoryLabel = pkg.category || 'Package';

  return (
    <div
      className="listing-list-card group"
      onClick={onClick}
    >
      <div className="listing-list-card-image">
        {pkg.imageUrl ? (
          <img
            src={pkg.imageUrl}
            alt={pkg.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-neutral-50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">No Image</span>
          </div>
        )}

        <div className="absolute left-2.5 top-2.5">
          <span className={`${statusColor} rounded-md px-2.5 py-1 text-[10px] font-bold shadow-sm`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2.5">
            <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-neutral-900">
              {pkg.name}
            </h3>
            <button className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50 text-neutral-500 transition-all hover:border-neutral-900 hover:bg-neutral-900 hover:text-white">
              <ArrowUpRightIcon className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1 text-neutral-500">
            <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
            <span className="truncate text-xs font-medium">{pkg.destinations?.join(', ') || 'Various Locations'}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-neutral-500">
            {pkg.duration && (
              <span className="flex items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-2 py-1">
                <ClockIcon className="h-3 w-3" />
                {pkg.duration}
              </span>
            )}
            {pkg.category && (
              <span className="rounded-md border border-neutral-100 bg-neutral-50 px-2 py-1">{pkg.category}</span>
            )}
            {pkg.inclusions?.slice(0, 1).map((inc, idx) => (
              <span key={idx} className="line-clamp-1 rounded-md border border-neutral-100 bg-neutral-50 px-2 py-1">
                {inc}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-lg font-black tracking-tight text-neutral-900">
            {formatCurrency(pkg.basePrice)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-neutral-400">{categoryLabel}</span>
            {canManage && (
              <div className="ml-2 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(pkg); }}
                  className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-neutral-800"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(pkg.id); }}
                  className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-600 transition hover:bg-neutral-200"
                >
                  {isActive ? 'Hide' : 'Show'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
