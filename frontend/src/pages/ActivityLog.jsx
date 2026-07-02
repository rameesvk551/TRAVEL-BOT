import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { activityApi } from '../api/activityApi';
import { useAuthStore } from '../store/authStore';
import { formatDateTime } from '../utils/formatters';

const MODULE_LABELS = {
  leads: 'Leads',
  bookings: 'Bookings',
  customers: 'Customers',
  payments: 'Payments',
  accounts: 'Accounts',
};

const MODULE_BADGE = {
  leads: 'bg-sky-50 text-sky-700',
  bookings: 'bg-violet-50 text-violet-700',
  customers: 'bg-emerald-50 text-emerald-700',
  payments: 'bg-amber-50 text-amber-700',
  accounts: 'bg-rose-50 text-rose-700',
};

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const agent = useAuthStore((s) => s.agent);
  const isAdmin = agent?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ module: '', actorId: '', from: '', to: '', search: '' });

  const { data: filterData } = useQuery({
    queryKey: ['activity-filters'],
    queryFn: () => activityApi.filters().then((r) => r.data),
  });

  const modules = filterData?.modules || [];
  const actors = filterData?.actors || [];

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (filters.module) p.module = filters.module;
    if (isAdmin && filters.actorId) p.actorId = filters.actorId;
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = new Date(`${filters.to}T23:59:59`).toISOString();
    if (filters.search) p.search = filters.search;
    return p;
  }, [page, filters, isAdmin]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity-log', params],
    queryFn: () => activityApi.list(params),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const update = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400';

  return (
    <div className="w-full space-y-5">
      <section>
        <p className="eyebrow">Audit trail</p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
          Activity Log
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin
            ? 'Who did what across leads, bookings, customers, payments and accounts.'
            : 'A record of your own actions across the workspace.'}
        </p>
      </section>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Module</label>
          <select className={inputClass} value={filters.module} onChange={(e) => update('module', e.target.value)}>
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">User</label>
            <select className={inputClass} value={filters.actorId} onChange={(e) => update('actorId', e.target.value)}>
              <option value="">All users</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">From</label>
          <input type="date" className={inputClass} value={filters.from} onChange={(e) => update('from', e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">To</label>
          <input type="date" className={inputClass} value={filters.to} onChange={(e) => update('to', e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Search</label>
          <input
            type="text"
            placeholder="Search description…"
            className={inputClass}
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_22px_70px_-48px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-extrabold text-slate-950">Recent activity</h2>
          <span className="text-xs font-semibold text-slate-400">
            {isFetching ? 'Loading…' : `${pagination.total} event${pagination.total === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50/80">
              <tr>
                {['When', 'User', 'Module', 'Action'].map((heading) => (
                  <th key={heading} className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, row) => (
                  <tr key={row} className="border-t border-slate-100">
                    {Array.from({ length: 4 }).map((__, cell) => (
                      <td key={cell} className="px-6 py-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm text-slate-500">
                    <ClipboardDocumentListIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{formatDateTime(row.createdAt)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.actorName || 'System'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${MODULE_BADGE[row.module] || 'bg-slate-100 text-slate-600'}`}>
                        {MODULE_LABELS[row.module] || row.module}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.summary || row.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <span className="text-xs font-semibold text-slate-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
