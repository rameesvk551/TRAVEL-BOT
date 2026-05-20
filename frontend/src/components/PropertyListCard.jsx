import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon, PencilSquareIcon, EyeSlashIcon, EyeIcon } from '@heroicons/react/24/outline';

export default function PropertyListCard({ property, onEdit, toggleActive, canManage, onClick }) {
  const isActive = property.isActive;

  const statusLabel = property.listingStatus === 'For Rent'
    ? 'For Rent'
    : property.listingStatus === 'Sold'
      ? 'Sold'
      : isActive ? 'For Sale' : 'Inactive';

  const statusColor = statusLabel === 'For Rent'
    ? 'bg-teal-500 text-white'
    : statusLabel === 'Sold'
      ? 'bg-neutral-700 text-white'
      : statusLabel === 'Inactive'
        ? 'bg-neutral-400 text-white'
        : 'bg-emerald-500 text-white';

  return (
    <div
      className="listing-list-card group"
      onClick={onClick}
    >
      {/* Compact image thumbnail */}
      <div className="listing-list-card-image">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-50">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">No Image</span>
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 md:left-2.5 md:top-2.5">
          <span className={`${statusColor} rounded-md px-2 py-0.5 text-[9px] font-bold shadow-sm`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Content — tight layout */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 px-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="line-clamp-1 text-[13px] font-bold leading-tight text-neutral-900 md:text-[15px]">
            {property.name}
          </h3>
          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white transition hover:bg-neutral-800"
                title="Edit"
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200"
                title={isActive ? 'Hide' : 'Show'}
              >
                {isActive ? <EyeSlashIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-neutral-500">
          <MapPinIcon className="h-3 w-3 flex-shrink-0 text-neutral-400" />
          <span className="truncate text-[11px] font-medium">{property.location || 'Unknown'}</span>
          {property.propertyType && (
            <>
              <span className="mx-1 text-neutral-200">·</span>
              <span className="text-[11px] font-medium text-neutral-400 flex-shrink-0">{property.propertyType}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-black tracking-tight text-neutral-900 md:text-base">
            {property.pricePerNight ? formatCurrency(property.pricePerNight) : '-'}
          </span>
          <ArrowUpRightIcon className="h-3.5 w-3.5 text-neutral-300 md:hidden" />
        </div>
      </div>
    </div>
  );
}
