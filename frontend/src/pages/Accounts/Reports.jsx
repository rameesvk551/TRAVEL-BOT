import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '../../api/accountsApi';
import { formatDate } from '../../utils/formatters';
import { Card, EmptyState, PeriodPicker, resolveRange, money, asArray, unwrap } from './ui';

const REPORTS = [
  { key: 'trial-balance', label: 'Trial Balance' },
  { key: 'profit-loss', label: 'Profit & Loss' },
  { key: 'item-profitability', label: 'Item Profitability' },
  { key: 'balance-sheet', label: 'Balance Sheet' },
  { key: 'aging', label: 'AR Aging' },
  { key: 'cash-flow', label: 'Cash Flow' },
];

const ITEM_TYPES = [
  { value: '', label: 'All items' },
  { value: 'PACKAGE', label: 'Packages' },
  { value: 'PROPERTY', label: 'Properties' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'CRUISE', label: 'Cruises' },
  { value: 'VISA', label: 'Visas' },
  { value: 'CUSTOM', label: 'Custom' },
];

function Row({ label, value, bold, indent, tone }) {
  const toneClass = tone === 'pos' ? 'text-emerald-700' : tone === 'neg' ? 'text-rose-700' : 'text-neutral-900';
  return (
    <div className={`flex items-center justify-between border-b border-neutral-50 py-2 ${bold ? 'font-extrabold' : ''}`} style={indent ? { paddingLeft: 16 } : undefined}>
      <span className={bold ? 'text-neutral-900' : 'text-neutral-600'}>{label}</span>
      <span className={`tabular-nums ${bold ? toneClass : 'text-neutral-700'}`}>{value}</span>
    </div>
  );
}

function LedgerRows({ rows, side }) {
  return rows.map((r) => (
    <Row key={r.ledger.id} label={`${r.ledger.code} · ${r.ledger.name}`} value={money(side === 'credit' ? (r.credit - r.debit) || r.credit : (r.debit - r.credit) || r.debit)} indent />
  ));
}

export default function Reports() {
  const [active, setActive] = useState('trial-balance');
  const [period, setPeriod] = useState({ preset: 'fy' });
  const [itemType, setItemType] = useState('');
  const range = useMemo(() => resolveRange(period), [period]);
  const reportParams = useMemo(() => ({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    ...(active === 'item-profitability' && itemType ? { itemType } : {}),
  }), [active, itemType, range.dateFrom, range.dateTo]);

  const query = useQuery({
    queryKey: ['report', active, reportParams],
    queryFn: () => accountsApi.report(active, reportParams),
  });
  const data = unwrap(query.data, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setActive(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${active === r.key ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {active === 'item-profitability' && (
            <select
              value={itemType}
              onChange={(event) => setItemType(event.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 shadow-sm"
            >
              {ITEM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          )}
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>

      <Card>
        {query.isLoading ? (
          <EmptyState text="Loading report…" />
        ) : (
          <>
            {active === 'trial-balance' && <TrialBalance data={data} />}
            {active === 'profit-loss' && <ProfitLoss data={data} />}
            {active === 'item-profitability' && <ItemProfitability data={data} />}
            {active === 'balance-sheet' && <BalanceSheet data={data} />}
            {active === 'aging' && <Aging data={data} />}
            {active === 'cash-flow' && <CashFlow data={data} />}
          </>
        )}
      </Card>
    </div>
  );
}

function MetricTile({ label, value, tone }) {
  const toneClass = tone === 'pos' ? 'text-emerald-700' : tone === 'neg' ? 'text-rose-700' : 'text-neutral-950';
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function ItemProfitability({ data }) {
  const rows = asArray(data.data);
  const s = data.summary || {};
  if (!rows.length) return <EmptyState text="No item-level accounts found in this period." />;
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Sales" value={money(s.revenue)} />
        <MetricTile label="Collected" value={money(s.collected)} tone="pos" />
        <MetricTile label="Vendor Cost" value={money(s.vendorCost)} />
        <MetricTile label="Gross Profit" value={money(s.grossProfit)} tone={s.grossProfit >= 0 ? 'pos' : 'neg'} />
      </div>

      {rows.map((row) => (
        <section key={`${row.itemType}:${row.itemId || row.itemName}`} className="rounded-lg border border-neutral-200">
          <header className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{row.itemType}</p>
              <h3 className="truncate text-lg font-extrabold text-neutral-950">{row.itemName}</h3>
              <p className="mt-1 text-xs text-neutral-500">{row.bookingsCount} bookings · {row.customersCount} customers</p>
            </div>
            <div className="grid min-w-[min(100%,520px)] grid-cols-2 gap-2 text-right sm:grid-cols-4">
              <div><p className="text-[10px] font-bold uppercase text-neutral-400">Sales</p><p className="font-extrabold tabular-nums">{money(row.revenue)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-neutral-400">Receivable</p><p className="font-extrabold tabular-nums text-amber-700">{money(row.receivable)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-neutral-400">Payable</p><p className="font-extrabold tabular-nums text-rose-700">{money(row.payable)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-neutral-400">Profit</p><p className={`font-extrabold tabular-nums ${row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(row.grossProfit)}</p></div>
            </div>
          </header>

          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-neutral-900">Customer Receivables</h4>
                <span className="text-xs font-bold text-neutral-500">{money(row.receivable)} open</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                      <th className="py-2">Customer</th>
                      <th className="py-2">Invoice</th>
                      <th className="py-2 text-right">Paid</th>
                      <th className="py-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asArray(row.customerReceivables).map((item) => (
                      <tr key={item.invoiceId} className="border-b border-neutral-50">
                        <td className="py-2 text-neutral-700">{item.customerName}</td>
                        <td className="py-2 text-neutral-500">{item.invoiceNumber}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">{money(item.paidAmount)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{money(item.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-neutral-900">Vendor Payables</h4>
                <span className="text-xs font-bold text-neutral-500">{money(row.vendorPaid)} paid</span>
              </div>
              {asArray(row.vendorPayables).length === 0 ? (
                <EmptyState text="No mapped vendor costs." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                        <th className="py-2">Vendor</th>
                        <th className="py-2 text-right">Cost</th>
                        <th className="py-2 text-right">Paid</th>
                        <th className="py-2 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asArray(row.vendorPayables).map((vendor) => (
                        <tr key={vendor.vendorId || vendor.vendorName} className="border-b border-neutral-50">
                          <td className="py-2 text-neutral-700">{vendor.vendorName}</td>
                          <td className="py-2 text-right tabular-nums">{money(vendor.cost)}</td>
                          <td className="py-2 text-right tabular-nums text-emerald-700">{money(vendor.paid)}</td>
                          <td className="py-2 text-right tabular-nums font-semibold text-rose-700">{money(vendor.payable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function TrialBalance({ data }) {
  const rows = asArray(data.data);
  if (!rows.length) return <EmptyState text="No balances in this period." />;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          <th className="py-2">Ledger</th>
          <th className="py-2 text-right">Debit</th>
          <th className="py-2 text-right">Credit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ledger.id} className="border-b border-neutral-50">
            <td className="py-2 text-neutral-700"><span className="font-mono text-xs text-neutral-400">{r.ledger.code}</span> {r.ledger.name}</td>
            <td className="py-2 text-right tabular-nums text-sky-700">{Number(r.debit) ? money(r.debit) : ''}</td>
            <td className="py-2 text-right tabular-nums text-emerald-700">{Number(r.credit) ? money(r.credit) : ''}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-extrabold">
          <td className="py-2">Total</td>
          <td className="py-2 text-right tabular-nums">{money(data.summary?.debit)}</td>
          <td className="py-2 text-right tabular-nums">{money(data.summary?.credit)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function ProfitLoss({ data }) {
  const s = data.summary || {};
  const sec = data.sections || {};
  return (
    <div className="mx-auto max-w-2xl">
      {asArray(sec.operatingIncome).length > 0 && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Revenue</p>}
      <LedgerRows rows={asArray(sec.operatingIncome)} side="credit" />
      <Row label="Total Revenue" value={money(s.revenue)} bold />
      {asArray(sec.directCosts).length > 0 && <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Direct Costs</p>}
      <LedgerRows rows={asArray(sec.directCosts)} side="debit" />
      <Row label="Gross Profit" value={money(s.grossProfit)} bold tone={s.grossProfit >= 0 ? 'pos' : 'neg'} />
      {asArray(sec.operatingExpenses).length > 0 && <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Operating Expenses</p>}
      <LedgerRows rows={asArray(sec.operatingExpenses)} side="debit" />
      <Row label="Operating Profit" value={money(s.operatingProfit)} bold tone={s.operatingProfit >= 0 ? 'pos' : 'neg'} />
      {asArray(sec.otherIncome).length > 0 && <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Other Income</p>}
      <LedgerRows rows={asArray(sec.otherIncome)} side="credit" />
      <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-950 px-4 py-3 text-white">
        <span className="font-extrabold">Net Profit</span>
        <span className="tabular-nums text-lg font-extrabold">{money(s.netProfit)}</span>
      </div>
      <div className="mt-2 flex justify-end gap-6 text-xs text-neutral-500">
        <span>Gross margin: <strong>{s.grossMargin ?? 0}%</strong></span>
        <span>Net margin: <strong>{s.netMargin ?? 0}%</strong></span>
      </div>
    </div>
  );
}

function BalanceSheet({ data }) {
  const s = data.summary || {};
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Assets</p>
        <LedgerRows rows={asArray(data.assets)} side="debit" />
        <Row label="Total Assets" value={money(s.totalAssets)} bold />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Liabilities</p>
        <LedgerRows rows={asArray(data.liabilities)} side="credit" />
        <Row label="Total Liabilities" value={money(s.totalLiabilities)} bold />
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Equity</p>
        <LedgerRows rows={asArray(data.equity)} side="credit" />
        <Row label="Current Earnings" value={money(s.currentEarnings)} indent />
        <Row label="Total Equity" value={money(s.totalEquity)} bold />
        <div className={`mt-3 rounded-lg px-4 py-2 text-center text-sm font-extrabold ${s.isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {s.isBalanced ? 'Balanced ✓' : `Out of balance by ${money(s.difference)}`}
        </div>
      </div>
    </div>
  );
}

function Aging({ data }) {
  const s = data.summary || {};
  const rows = asArray(data.data);
  const buckets = [
    ['Current', s.current], ['1–30', s.days1_30], ['31–60', s.days31_60], ['61–90', s.days61_90], ['90+', s.days90Plus],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-5">
        {buckets.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 p-3 text-center">
            <p className="text-[11px] font-bold uppercase text-neutral-400">{label}</p>
            <p className="mt-1 font-extrabold text-neutral-900">{money(value)}</p>
          </div>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState text="No outstanding receivables." /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2">Invoice</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Due</th>
              <th className="py-2 text-right">Overdue</th>
              <th className="py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoiceId} className="border-b border-neutral-50">
                <td className="py-2 font-bold text-neutral-900">{r.invoiceNumber}</td>
                <td className="py-2 text-neutral-600">{r.customer?.name || '—'}</td>
                <td className="py-2 text-neutral-500">{formatDate(r.dueDate)}</td>
                <td className="py-2 text-right text-neutral-500">{r.overdueDays}d</td>
                <td className="py-2 text-right font-semibold tabular-nums">{money(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-extrabold"><td className="py-2" colSpan={4}>Total Outstanding</td><td className="py-2 text-right tabular-nums">{money(s.totalOutstanding)}</td></tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function CashFlow({ data }) {
  const s = data.summary || {};
  const rows = asArray(data.data);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 p-3 text-center"><p className="text-[11px] font-bold uppercase text-neutral-400">Inflow</p><p className="mt-1 font-extrabold text-emerald-700">{money(s.inflow)}</p></div>
        <div className="rounded-lg border border-neutral-200 p-3 text-center"><p className="text-[11px] font-bold uppercase text-neutral-400">Outflow</p><p className="mt-1 font-extrabold text-rose-700">{money(s.outflow)}</p></div>
        <div className="rounded-lg border border-neutral-200 p-3 text-center"><p className="text-[11px] font-bold uppercase text-neutral-400">Net</p><p className="mt-1 font-extrabold text-neutral-900">{money((s.inflow || 0) - (s.outflow || 0))}</p></div>
      </div>
      {rows.length === 0 ? <EmptyState text="No cash movements in this period." /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2">Date</th><th className="py-2">Narration</th><th className="py-2 text-right">In</th><th className="py-2 text-right">Out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50">
                <td className="py-2 text-neutral-500">{formatDate(r.journalEntry?.date)}</td>
                <td className="py-2 text-neutral-700">{r.description || r.journalEntry?.description || '—'}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700">{Number(r.debit) ? money(r.debit) : ''}</td>
                <td className="py-2 text-right tabular-nums text-rose-700">{Number(r.credit) ? money(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
