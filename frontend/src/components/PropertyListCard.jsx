import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';

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

  const categoryLabel = property.propertyType === 'Hotel' || property.propertyType === 'Resort'
    ? 'Commercial'
    : property.propertyType === 'Villa'
      ? 'Luxury'
      : property.propertyType === 'Apartment'
        ? 'Residential'
        : 'Residential';

  return (
    <div
      className="listing-list-card group"
      onClick={onClick}
    >
      {/* Image */}
      <div className="listing-list-card-image">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-50">
            <span className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">No Image</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span className={`${statusColor} text-[10px] font-bold px-3 py-1.5 rounded-md shadow-sm`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between p-5 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[16px] font-bold text-neutral-900 leading-snug line-clamp-1">
              {property.name}
            </h3>
            <button className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-500 border border-neutral-100 transition-all hover:bg-neutral-900 hover:text-white hover:border-neutral-900">
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-1.5 flex items-center gap-1 text-neutral-500">
            <MapPinIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{property.location || 'Unknown Location'}</span>
          </div>

          {/* Feature Tags */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500 font-medium flex-wrap">
            {property.beds && (
              <span className="bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">{property.beds} Beds</span>
            )}
            {property.baths && (
              <span className="bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">{property.baths} Baths</span>
            )}
            {property.sqft && (
              <span className="bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">{Number(property.sqft).toLocaleString()} sq.ft.</span>
            )}
            {property.propertyType && (
              <span className="bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">{property.propertyType}</span>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="mt-4 flex items-end justify-between">
          <span className="text-xl font-black text-neutral-900 tracking-tight">
            {property.pricePerNight ? formatCurrency(property.pricePerNight) : '—'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-neutral-400 tracking-wide">{categoryLabel}</span>
            {canManage && (
              <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="text-[10px] font-bold py-1.5 px-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive(); }}
                  className="text-[10px] font-bold py-1.5 px-3 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition"
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
