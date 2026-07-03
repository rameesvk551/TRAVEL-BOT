import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  ReceiptPercentIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { itemFinanceApi } from '../api/itemFinanceApi';
import { useAuthStore } from '../store/authStore';
import { agentHasPermission } from '../utils/permissions';
import { formatCurrency, formatDate } from '../utils/formatters';

function percent(value) {
  return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

function rupeesToPaise(value) {
  return Math.round(Number(value || 0) * 100);
}

function Metric({ label, value, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white text-neutral-900 border-neutral-200',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    blue: 'bg-sky-50 text-sky-900 border-sky-100',
    amber: 'bg-amber-50 text-amber-900 border-amber-100',
    red: 'bg-rose-50 text-rose-900 border-rose-100',
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {Icon && <Icon className="h-5 w-5 opacity-70" />}
      </div>
      <p className="mt-3 text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-neutral-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TableShell({ children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function PackageFinance() {
  const { itemType: itemTypeParam, id } = useParams();
  const itemType = (itemTypeParam || 'PACKAGE').toUpperCase();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agent = useAuthStore((state) => state.agent);
  const canManage = agentHasPermission(agent, 'packages.manage');
  const [costForm, setCostForm] = useState({
    vendorId: '',
    serviceLabel: '',
    amount: '',
    dueDate: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['item-finance', itemType, id],
    queryFn: () => itemFinanceApi.getReport(itemType, id),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-list-active'],
    queryFn: () => client.get('/vendors', { params: { isActive: true } }).then((res) => res.data),
    enabled: canManage,
  });

  const report = data?.data;
  const vendors = Array.isArray(vendorsData) ? vendorsData : [];

  const addCost = useMutation({
    mutationFn: (payload) => itemFinanceApi.createVendorCost(itemType, id, payload),
    onSuccess: () => {
      setCostForm({ vendorId: '', serviceLabel: '', amount: '', dueDate: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['item-finance', itemType, id] });
    },
  });

  const deleteCost = useMutation({
    mutationFn: (costId) => itemFinanceApi.deleteVendorCost(itemType, id, costId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item-finance', itemType, id] }),
  });

  const submitCost = (event) => {
    event.preventDefault();
    addCost.mutate({
      vendorId: costForm.vendorId,
      serviceLabel: costForm.serviceLabel,
      amount: rupeesToPaise(costForm.amount),
      dueDate: costForm.dueDate || null,
      notes: costForm.notes || null,
    });
  };

  const kpis = useMemo(() => {
    if (!report) return [];
    return [
      { label: 'Expected Revenue', value: formatCurrency(report.revenue.expectedRevenue), icon: ReceiptPercentIcon, tone: 'blue' },
      { label: 'Received Revenue', value: formatCurrency(report.revenue.receivedRevenue), icon: BanknotesIcon, tone: 'green' },
      { label: 'Pending Revenue', value: formatCurrency(report.revenue.pendingRevenue), icon: ClockIcon, tone: 'amber' },
      { label: 'Total Cost', value: formatCurrency(report.costs.totalCost), icon: ChartBarSquareIcon, tone: 'neutral' },
      { label: 'Gross Profit', value: formatCurrency(report.profitability.grossProfit), icon: ReceiptPercentIcon, tone: report.profitability.grossProfit >= 0 ? 'green' : 'red' },
      { label: 'Profit %', value: percent(report.profitability.profitPercent), icon: ChartBarSquareIcon, tone: 'blue' },
      { label: 'Cash Balance', value: formatCurrency(report.cashPosition.currentCashBalance), icon: BanknotesIcon, tone: report.cashPosition.currentCashBalance >= 0 ? 'green' : 'red' },
      { label: 'Pax', value: `${report.operations.confirmedPax}/${report.operations.paxCount}`, icon: UserGroupIcon, tone: 'neutral' },
    ];
  }, [report]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-60 animate-pulse rounded bg-neutral-200" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-neutral-700">Finance report not found.</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 page-enter">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <button type="button" onClick={() => navigate(-1)} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900">
            <ArrowLeftIcon className="h-4 w-4" /> {report.itemLabel || 'Item'} Finance
          </button>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">{report.item?.name || report.package.name}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{report.itemLabel || 'Item'} {report.item?.duration || report.item?.category || report.item?.propertyType || report.item?.visaType || ''} {report.item?.destinations?.length ? `- ${report.item.destinations.join(', ')}` : ''}</p>
        </div>
        {itemType === 'PACKAGE' && (
          <Link to={`/packages/${id}/edit`} className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Edit package
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => <Metric key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="Customer Receivables">
            <TableShell>
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">{report.itemLabel || 'Item'} Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Aging</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {report.receivables.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-neutral-500">No package bookings yet.</td></tr>
                  ) : report.receivables.map((row) => (
                    <tr key={row.bookingId}>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{row.customerName}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatCurrency(row.packageAmount)}</td>
                      <td className="px-4 py-3 text-emerald-700">{formatCurrency(row.paid)}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(row.balance)}</td>
                      <td className="px-4 py-3 text-neutral-500">{row.balance > 0 ? `${row.ageDays} days` : '-'}</td>
                      <td className="px-4 py-3 text-neutral-500">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Section>

          <Section title="Vendor Payables">
            <TableShell>
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Due</th>
                    {canManage && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {report.payables.length === 0 ? (
                    <tr><td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-neutral-500">No vendor costs recorded.</td></tr>
                  ) : report.payables.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{row.vendorName}</td>
                      <td className="px-4 py-3 text-neutral-700">{row.service}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatCurrency(row.cost)}</td>
                      <td className="px-4 py-3 text-emerald-700">{formatCurrency(row.paid)}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(row.balance)}</td>
                      <td className="px-4 py-3 text-neutral-500">{row.dueDate ? formatDate(row.dueDate) : '-'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {row.deletable && (
                            <button type="button" onClick={() => deleteCost.mutate(row.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600" title="Delete cost">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Vendor Wise Report">
              <div className="space-y-2">
                {report.vendorWise.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-500">No vendor balances.</div>
                ) : report.vendorWise.map((vendor) => (
                  <div key={vendor.vendorId} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-neutral-900">{vendor.vendorName}</p>
                        <p className="mt-1 text-xs text-neutral-500">{vendor.services.join(', ')}</p>
                      </div>
                      <p className="text-sm font-bold text-neutral-900">{formatCurrency(vendor.balance)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <span className="rounded-md bg-neutral-50 px-2 py-1 text-neutral-600">Cost {formatCurrency(vendor.totalCost)}</span>
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">Paid {formatCurrency(vendor.paid)}</span>
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">Due {formatCurrency(vendor.balance)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Aging Report">
              <div className="grid grid-cols-2 gap-3">
                {report.agingReport.map((bucket) => (
                  <div key={bucket.key} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{bucket.label}</p>
                    <p className="mt-2 text-lg font-black text-neutral-900">{formatCurrency(bucket.amount)}</p>
                    <p className="mt-1 text-xs text-neutral-500">{bucket.count} customers</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">Profit Analysis</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Revenue</span><span className="font-semibold text-neutral-900">{formatCurrency(report.revenue.expectedRevenue)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Cost</span><span className="font-semibold text-neutral-900">{formatCurrency(report.costs.totalCost)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Gross Profit</span><span className="font-semibold text-emerald-700">{formatCurrency(report.profitability.grossProfit)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Margin</span><span className="font-semibold text-neutral-900">{percent(report.profitability.profitPercent)}</span></div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">Cash Position Today</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Customer Collections</span><span className="font-semibold text-neutral-900">{formatCurrency(report.cashPosition.customerCollections)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Vendor Payments</span><span className="font-semibold text-neutral-900">{formatCurrency(report.cashPosition.vendorPayments)}</span></div>
              <div className="flex justify-between gap-3 border-t border-neutral-100 pt-3"><span className="text-neutral-500">Current Cash Balance</span><span className="font-black text-neutral-900">{formatCurrency(report.cashPosition.currentCashBalance)}</span></div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">Operations</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-neutral-50 p-3"><UserGroupIcon className="mb-2 h-5 w-5 text-neutral-500" /><p className="text-xs text-neutral-500">Pax Count</p><p className="font-black text-neutral-900">{report.operations.paxCount}</p></div>
              <div className="rounded-md bg-emerald-50 p-3"><CheckCircleIcon className="mb-2 h-5 w-5 text-emerald-600" /><p className="text-xs text-emerald-700">Confirmed</p><p className="font-black text-emerald-900">{report.operations.confirmedPax}</p></div>
              <div className="rounded-md bg-rose-50 p-3"><ClockIcon className="mb-2 h-5 w-5 text-rose-600" /><p className="text-xs text-rose-700">Cancelled</p><p className="font-black text-rose-900">{report.operations.cancelledPax}</p></div>
              <div className="rounded-md bg-sky-50 p-3"><ChartBarSquareIcon className="mb-2 h-5 w-5 text-sky-600" /><p className="text-xs text-sky-700">Occupancy</p><p className="font-black text-sky-900">{percent(report.operations.packageOccupancy)}</p></div>
            </div>
          </div>

          {canManage && (
            <form onSubmit={submitCost} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-neutral-900">Add Payable</h2>
                <PlusIcon className="h-5 w-5 text-neutral-400" />
              </div>
              <div className="mt-4 space-y-3">
                <select required value={costForm.vendorId} onChange={(e) => setCostForm({ ...costForm, vendorId: e.target.value })} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                  <option value="">Vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
                <input required value={costForm.serviceLabel} onChange={(e) => setCostForm({ ...costForm, serviceLabel: e.target.value })} placeholder="Service" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                <input required type="number" min="1" value={costForm.amount} onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })} placeholder="Amount" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                <div className="relative">
                  <CalendarDaysIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <input type="date" value={costForm.dueDate} onChange={(e) => setCostForm({ ...costForm, dueDate: e.target.value })} className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-neutral-400" />
                </div>
                <textarea value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} placeholder="Notes" rows="2" className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                <button type="submit" disabled={addCost.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60">
                  <PlusIcon className="h-4 w-4" /> {addCost.isPending ? 'Adding...' : 'Add payable'}
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
