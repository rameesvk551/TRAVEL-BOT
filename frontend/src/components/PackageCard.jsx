// FILE: /frontend/src/components/PackageCard.jsx

import { formatCurrency } from '../utils/formatters';
import { MapPinIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function PackageCard({ pkg, onEdit, onDelete }) {
  return (
    <div className="glass-card overflow-hidden group hover:border-brand-500/30 transition-all duration-300">
      {/* Image/placeholder */}
      <div className="h-40 bg-gradient-to-br from-brand-700/30 to-surface-800 flex items-center justify-center relative overflow-hidden">
        {pkg.imageUrl ? (
          <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-brand-400/50 text-4xl">🏝️</div>
        )}
        {!pkg.isActive && (
          <div className="absolute inset-0 bg-surface-900/80 flex items-center justify-center">
            <span className="badge badge-lost">Inactive</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 bg-surface-900/80 backdrop-blur rounded-lg text-sm font-bold text-white">
            {formatCurrency(pkg.basePrice)}
            <span className="text-xs text-surface-400 font-normal">/person</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-white font-semibold mb-2 group-hover:text-brand-400 transition-colors">
          {pkg.name}
        </h3>

        <div className="space-y-1.5 mb-3">
          {pkg.duration && (
            <div className="flex items-center gap-2 text-xs text-surface-300">
              <ClockIcon className="w-3.5 h-3.5 text-surface-500" />
              <span>{pkg.duration}</span>
            </div>
          )}
          {pkg.destinations?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-surface-300">
              <MapPinIcon className="w-3.5 h-3.5 text-surface-500" />
              <span>{pkg.destinations.join(', ')}</span>
            </div>
          )}
          {pkg.inclusions?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-surface-300">
              <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
              <span>{pkg.inclusions.length} inclusions</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-surface-700/30">
          <button
            onClick={() => onEdit?.(pkg)}
            className="btn-ghost text-xs flex-1"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete?.(pkg)}
            className="btn-ghost text-xs text-red-400 hover:text-red-300 flex-1"
          >
            {pkg.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}
