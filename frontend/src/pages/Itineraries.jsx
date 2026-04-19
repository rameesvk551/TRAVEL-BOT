import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { itinerariesApi } from '../api/itinerariesApi';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function Itineraries() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['itineraries'],
    queryFn: () => itinerariesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => itinerariesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id) => {
      const it = data?.data?.find(i => i.id === id);
      if (!it) return;
      const copy = { ...it, name: `${it.name} (Copy)` };
      delete copy.id;
      return itinerariesApi.create(copy);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries'] }),
  });

  const itineraries = data?.data || [];

  return (
    <div className="w-full space-y-4">
      <section className="flex items-end justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="page-heading">Itineraries</h1>
          <p className="page-subtext">Create, send, and track stunning day-by-day itineraries.</p>
        </div>
        <button type="button" onClick={() => navigate('/itineraries/new')} className="shell-button-primary">
          <PlusIcon className="h-4 w-4" />
          New Itinerary
        </button>
      </section>

      <div className="data-table-wrapper">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="data-table-head">
                {['Name & Client', 'Destination', 'Dates', 'Cost', 'Margin', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="data-table-th">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((_, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : itineraries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    <DocumentDuplicateIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    No itineraries created yet.
                  </td>
                </tr>
              ) : (
                itineraries.map((it) => {
                  const marginPct = it.totalCost > 0 ? Math.round(((it.totalPrice - it.totalCost) / it.totalPrice) * 100) : 0;
                  
                  return (
                    <tr key={it.id}>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{it.name}</p>
                          {it.customer?.name ? <p className="mt-0.5 text-xs text-slate-500">Client: {it.customer.name}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{it.destination || '—'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {it.travelStartDate ? `${formatDate(it.travelStartDate)}` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-900">{formatCurrency(it.totalPrice)}</div>
                        <div className="text-xs text-slate-500">Cost: {formatCurrency(it.totalCost)}</div>
                      </td>
                      <td className="data-table-td text-sm text-neutral-900 font-semibold">{marginPct}%</td>
                      <td className="data-table-td">
                        <span className={`badge ${it.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : it.status === 'SENT' ? 'bg-sky-50 text-sky-700' : 'bg-neutral-100 text-neutral-600'}`}>
                          {it.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => navigate(`/itineraries/${it.id}/edit`)} className="shell-button-secondary py-1.5 px-3 text-xs">Edit</button>
                          <button type="button" onClick={() => duplicateMutation.mutate(it.id)} className="shell-button-ghost py-1.5 px-3 text-xs tracking-wide">Duplicate</button>
                          <button
                            type="button"
                            onClick={() => {
                              if(window.confirm('Delete itinerary?')) deleteMutation.mutate(it.id)
                            }}
                            className="rounded-[8px] px-2 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
