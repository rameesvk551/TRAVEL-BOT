import { useLeads } from '../hooks/useLeads';
import { formatCurrency } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';

const PIPELINE_COLUMNS = [
  { key: 'NEW', label: 'New Inquiry' },
  { key: 'CONTACTED', label: 'Qualification' },
  { key: 'QUOTED', label: 'Proposal' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'BOOKED', label: 'Booked' },
];

export default function Bookings() {
  const { data, isLoading } = useLeads({ pageSize: 100 });
  const leads = data?.data?.data || [];

  return (
    <div className="w-full space-y-4">
      <section className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Pipeline</h1>
        <p className="text-sm text-slate-500">A simple stage-by-stage view of the sales queue.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {PIPELINE_COLUMNS.map((column) => {
          const items = leads.filter((lead) => lead.status === column.key);

          return (
            <div key={column.key} className="min-h-[420px] rounded-[12px] border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{column.label}</p>
                <span className={`badge ${getStatusTone(column.key)}`}>{items.length}</span>
              </div>

              <div className="space-y-2 p-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-[10px] bg-slate-100" />
                  ))
                ) : items.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">No leads here.</div>
                ) : (
                  items.map((lead) => (
                    <div key={lead.id} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">{lead.customer?.name || 'Guest lead'}</p>
                      <p className="mt-1 text-sm text-slate-600">{lead.destination || lead.package?.name || 'Trip brief pending'}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-400">{lead.travelDates || 'Dates pending'}</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : 'Budget TBD'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
