import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';

export default function PropertyCard({ property, onEdit, toggleActive, canManage, onClick }) {
  const isActive = property.isActive;

  // Derive badge label
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

  // Category label
  const categoryLabel = property.propertyType === 'Hotel' || property.propertyType === 'Resort'
    ? 'Commercial'
    : property.propertyType === 'Villa'
      ? 'Luxury'
      : property.propertyType === 'Apartment'
        ? 'Residential'
        : property.category || 'Residential';

  return (
    <div
      className="property-listing-card group"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="property-card-image-wrapper">
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

        {/* Arrow Button */}
        <div className="absolute top-3 right-3">
          <button className="h-8 w-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-neutral-700 shadow-sm border border-white/50 transition-all hover:bg-white hover:scale-110 hover:shadow-md">
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-4">
        <h3 className="text-[15px] font-bold text-neutral-900 leading-snug line-clamp-1">
          {property.name}
        </h3>

        <div className="mt-1 flex items-center gap-1 text-neutral-500">
          <MapPinIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
          <span className="text-xs font-medium truncate">{property.location || 'Unknown Location'}</span>
        </div>

        {/* Feature Tags Row */}
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-neutral-500 font-medium flex-wrap">
          {property.beds && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {property.beds} Beds
            </span>
          )}
          {property.baths && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {property.baths} Baths
            </span>
          )}
          {property.sqft && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {Number(property.sqft).toLocaleString()} sq.ft.
            </span>
          )}
          {!property.beds && !property.baths && !property.sqft && property.propertyType && (
            <span className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {property.propertyType}
            </span>
          )}
          {!property.beds && !property.baths && !property.sqft && property.amenities?.slice(0, 2).map((a, i) => (
            <span key={i} className="flex items-center gap-1 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
              {a}
            </span>
          ))}
        </div>

        {/* Price Row */}
        <div className="mt-3 flex items-end justify-between">
          <span className="text-xl font-black text-neutral-900 tracking-tight">
            {property.pricePerNight ? formatCurrency(property.pricePerNight) : '—'}
          </span>
          <span className="text-[10px] font-semibold text-neutral-400 tracking-wide">
            {categoryLabel}
          </span>
        </div>

        {/* Management Actions */}
        {canManage && (
          <div className="mt-2.5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex-1 text-[11px] font-bold py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleActive(); }}
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
