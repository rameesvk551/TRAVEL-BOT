// FILE: /frontend/src/components/VisaCard.jsx

import { formatCurrency } from '../utils/formatters';
import { DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function VisaCard({ visa, onEdit, onToggleActive, canManage, onClick }) {
  const isActive = visa.isActive;
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const statusColor = isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-400 text-white';

  // Extract flag emoji if possible, or use a default passport placeholder
  const getCountryFlag = (countryName) => {
    // Basic mapping for common countries
    const flags = {
      'united arab emirates': '🇦🇪', 'uae': '🇦🇪',
      'saudi arabia': '🇸🇦', 'saudi': '🇸🇦',
      'oman': '🇴🇲', 'qatar': '🇶🇦', 'kuwait': '🇰🇼', 'bahrain': '🇧🇭',
      'singapore': '🇸🇬', 'malaysia': '🇲🇾', 'thailand': '🇹🇭',
      'indonesia': '🇮🇩', 'vietnam': '🇻🇳', 'maldives': '🇲🇻',
      'united kingdom': '🇬🇧', 'uk': '🇬🇧', 'united states': '🇺🇸', 'usa': '🇺🇸',
      'canada': '🇨🇦', 'australia': '🇦🇺', 'new zealand': '🇳🇿',
      'schengen': '🇪🇺', 'france': '🇫🇷', 'germany': '🇩🇪', 'italy': '🇮🇹', 'spain': '🇪🇸',
      'turkey': '🇹🇷', 'russia': '🇷🇺', 'china': '🇨🇳', 'japan': '🇯🇵', 'south korea': '🇰🇷',
      'india': '🇮🇳', 'sri lanka': '🇱🇰', 'nepal': '🇳🇵', 'bangladesh': '🇧🇩',
    };
    const normalized = (countryName || '').toLowerCase().trim();
    return flags[normalized] || '🌐';
  };

  return (
    <div
      className="package-listing-card group cursor-pointer"
      onClick={onClick}
    >
      {/* Image / Header Container */}
      <div className="package-card-image-wrapper relative flex items-center justify-center bg-gradient-to-br from-indigo-100 to-indigo-50 min-h-[140px]">
        {visa.imageUrl ? (
          <img
            src={visa.imageUrl}
            alt={visa.country}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <span className="text-4xl filter drop-shadow">{getCountryFlag(visa.country)}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 mt-1">
              {visa.visaType || 'Tourist'}
            </span>
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
          <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
            Visa Service
          </div>
          <h3 className="mt-1 line-clamp-1 text-sm font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">
            {visa.country}
          </h3>
        </div>

        {/* Attributes */}
        <div className="mt-2.5 flex flex-wrap gap-1 text-[10px] font-semibold text-neutral-500">
          {visa.processingTime && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              <ClockIcon className="h-3 w-3 shrink-0 text-neutral-400" />
              {visa.processingTime}
            </span>
          )}
          {visa.validityPeriod && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              Validity: {visa.validityPeriod}
            </span>
          )}
          {visa.requiredDocuments?.length > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-100 bg-neutral-50 px-1.5 py-0.5">
              <DocumentTextIcon className="h-3 w-3 shrink-0 text-neutral-400" />
              {visa.requiredDocuments.length} Document{visa.requiredDocuments.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Price Row */}
        <div className="mt-2.5 flex items-end justify-between border-t border-neutral-50 pt-2">
          <span className="text-[17px] font-black tracking-tight text-neutral-900">
            {visa.price ? formatCurrency(visa.price) : 'Price on Request'}
          </span>
          <span className="text-[9px] font-semibold tracking-wide text-neutral-400 uppercase">
            {visa.visaType || 'visa'}
          </span>
        </div>

        {/* Management Actions */}
        {canManage && (
          <div className="absolute inset-x-2.5 bottom-2.5 hidden gap-1.5 rounded-lg bg-white/95 p-1.5 shadow-lg ring-1 ring-neutral-100 backdrop-blur-sm group-hover:flex" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(visa)}
              className="flex-1 rounded-md bg-neutral-900 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800"
            >
              Edit
            </button>
            <button
              onClick={() => onToggleActive(visa)}
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
