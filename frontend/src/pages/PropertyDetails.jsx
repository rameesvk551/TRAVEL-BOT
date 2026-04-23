import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CurrencyRupeeIcon,
  HomeModernIcon,
  MapPinIcon,
  PencilSquareIcon,
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { propertiesApi } from '../api/propertiesApi';
import { useAuthStore } from '../store/authStore';
import { formatCurrency } from '../utils/formatters';

const TYPE_ICONS = {
  Hotel: BuildingOffice2Icon,
  Resort: SparklesIcon,
  Villa: HomeModernIcon,
  Apartment: HomeModernIcon,
};

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agentRole = useAuthStore((state) => state.agent?.role);
  const canManage = agentRole === 'ADMIN';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
  });

  const property = data?.data;
  const TypeIcon = TYPE_ICONS[property?.propertyType] || HomeModernIcon;

  const toggleActiveMutation = useMutation({
    mutationFn: () => (
      property?.isActive
        ? propertiesApi.delete(id)
        : propertiesApi.update(id, { isActive: true })
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['property', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="w-full animate-pulse space-y-6">
        <div className="h-10 w-48 rounded bg-neutral-100" />
        <div className="h-72 rounded-[var(--radius-md)] bg-neutral-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-36 rounded-[var(--radius-md)] bg-neutral-100 lg:col-span-2" />
          <div className="h-36 rounded-[var(--radius-md)] bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="shell-panel flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <XCircleIcon className="h-12 w-12 text-neutral-300" />
        <h1 className="mt-4 text-lg font-semibold text-neutral-900">Property not found</h1>
        <p className="mt-1 text-sm text-neutral-500">It may have been removed or you may not have access.</p>
        <button type="button" onClick={() => navigate('/properties')} className="shell-button-secondary mt-5">
          Back to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate('/properties')} className="shell-button-ghost p-1.5">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow">Property Details</p>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${property.isActive ? 'text-emerald-600' : 'text-neutral-500'}`}>
                {property.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{property.name}</h1>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate(`/properties/${property.id}/edit`)} className="shell-button-secondary">
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => toggleActiveMutation.mutate()}
              disabled={toggleActiveMutation.isPending}
              className="shell-button-secondary"
            >
              {property.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}
      </section>

      <section className="shell-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="min-h-[260px] bg-neutral-100 lg:min-h-[420px]">
            {property.imageUrl ? (
              <img src={property.imageUrl} alt={property.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center bg-neutral-50">
                <HomeModernIcon className="h-16 w-16 text-neutral-200" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between border-t border-neutral-100 p-6 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-indigo-50 text-indigo-600">
                  <TypeIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Type</p>
                  <p className="text-sm font-semibold text-neutral-900">{property.propertyType}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPinIcon className="mt-0.5 h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Location</p>
                  <p className="text-sm font-semibold text-neutral-900">{property.location || '-'}</p>
                  {property.address && <p className="mt-1 text-sm leading-relaxed text-neutral-500">{property.address}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <CurrencyRupeeIcon className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">Price / Night</p>
                  <p className="text-xl font-bold text-neutral-900">
                    {property.pricePerNight ? formatCurrency(property.pricePerNight) : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="shell-panel p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Description</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-neutral-600">
            {property.description || 'No description added yet.'}
          </p>
        </div>

        <div className="shell-panel p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Amenities</h2>
          {property.amenities?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <span key={amenity} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {amenity}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No amenities added yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
