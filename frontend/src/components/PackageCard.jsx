import { formatCurrency } from '../utils/formatters';
import { CheckCircleIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function PackageCard({ pkg, onEdit, onDelete }) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_-46px_rgba(15,23,42,0.45)] transition hover:-translate-y-1">
      <div className="relative h-52 overflow-hidden bg-[linear-gradient(135deg,#f4c98d,#0d6a5f)]">
        {pkg.imageUrl ? (
          <img src={pkg.imageUrl} alt={pkg.name} className="h-full w-full object-cover" />
        ) : null}
        <div className={`absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${pkg.isActive ? 'bg-white/90 text-slate-700' : 'bg-rose-100 text-rose-700'}`}>
          {pkg.isActive ? 'Active' : 'Inactive'}
        </div>
        <div className="absolute bottom-4 left-4 rounded-[18px] bg-white/90 px-3 py-2 text-sm font-bold text-slate-900 shadow-sm">
          {formatCurrency(pkg.basePrice)}
          <span className="ml-1 text-xs font-medium text-slate-500">/person</span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {pkg.category ? <span className="badge bg-emerald-50 text-emerald-700">{pkg.category}</span> : null}
          {pkg.brochureUrl ? <span className="badge bg-slate-100 text-slate-600">Brochure</span> : null}
        </div>

        <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">{pkg.name}</h3>
        {pkg.summary ? <p className="mt-2 text-sm leading-6 text-slate-500">{pkg.summary}</p> : null}

        <div className="mt-5 space-y-2 text-sm text-slate-600">
          {pkg.duration ? (
            <p className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-slate-400" />
              {pkg.duration}
            </p>
          ) : null}
          {pkg.destinations?.length ? (
            <p className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-slate-400" />
              {pkg.destinations.join(', ')}
            </p>
          ) : null}
          {pkg.inclusions?.length ? (
            <p className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              {pkg.inclusions.length} inclusions
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => onEdit?.(pkg)} className="shell-button-secondary flex-1">
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(pkg)}
            className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            {pkg.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </article>
  );
}
