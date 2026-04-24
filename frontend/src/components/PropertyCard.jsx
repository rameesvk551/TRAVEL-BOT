import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';

export default function PropertyCard({ property, onEdit, toggleActive, canManage, onClick }) {
  const isActive = property.isActive;

  return (
    <div 
      className="group bg-white rounded-[32px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-neutral-100 transition-all duration-300 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-neutral-100">
        {property.imageUrl ? (
          <img 
            src={property.imageUrl} 
            alt={property.name} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-50">
            <span className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">No Image</span>
          </div>
        )}
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="bg-white/90 backdrop-blur-md text-neutral-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
            {isActive ? 'For Sale' : 'Inactive'}
          </span>
        </div>

        {/* Action Button */}
        <div className="absolute top-3 right-3">
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white border border-white/30 transition-all hover:bg-black/40">
            <ArrowUpRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-5 px-1">
        <div className="flex justify-between items-start">
          <h3 className="text-[17px] font-bold text-neutral-900 leading-snug line-clamp-1">
            {property.name}
          </h3>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-neutral-500">
          <MapPinIcon className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-xs font-medium truncate">{property.location || 'Unknown Location'}</span>
        </div>

        {/* Feature Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {property.propertyType && (
            <span className="bg-neutral-50 text-neutral-500 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-neutral-100">
              {property.propertyType}
            </span>
          )}
          {property.amenities?.slice(0, 2).map((amenity, idx) => (
            <span key={idx} className="bg-neutral-50 text-neutral-500 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-neutral-100">
              {amenity}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-neutral-50 pt-4">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-neutral-900">
              {property.pricePerNight ? formatCurrency(property.pricePerNight) : '—'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="bg-neutral-50 text-neutral-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-neutral-100">
              {property.propertyType === 'Hotel' ? 'COMMERCIAL' : 'RESIDENTIAL'}
            </span>
          </div>
        </div>

        {/* Management Actions (Visible on Hover) */}
        {canManage && (
          <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex-1 text-[11px] font-bold py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition"
            >
              Edit
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleActive(); }}
              className="flex-1 text-[11px] font-bold py-2 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition"
            >
              {isActive ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
