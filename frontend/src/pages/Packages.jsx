import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { packagesApi } from '../api/packagesApi';
import { formatCurrency } from '../utils/formatters';

export default function Packages() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => packagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  const packages = data?.data || [];

  return (
    <div className="w-full space-y-4">
      <section className="flex items-end justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Packages</h1>
          <p className="text-sm text-slate-500">Maintain the itinerary catalog used for quoting and chat flows.</p>
        </div>
        <button type="button" onClick={() => navigate('/packages/new')} className="shell-button-primary">
          <PlusIcon className="h-4 w-4" />
          New Package
        </button>
      </section>

      <div className="rounded-[12px] border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Package', 'Category', 'Destinations', 'Duration', 'Price', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((_, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-slate-500">No packages created yet.</td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-900">{pkg.name}</p>
                      {pkg.summary ? <p className="mt-1 text-sm text-slate-500">{pkg.summary}</p> : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{pkg.category || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{pkg.destinations?.join(', ') || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{pkg.duration || '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">{formatCurrency(pkg.basePrice)}</td>
                    <td className="px-4 py-4">
                      <span className={`badge ${pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => navigate(`/packages/${pkg.id}/edit`)} className="shell-button-secondary">Edit</button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(pkg.id)}
                          className="rounded-[10px] bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                        >
                          {pkg.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
