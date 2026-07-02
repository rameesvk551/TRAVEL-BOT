import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReceiptRefundIcon } from '@heroicons/react/24/outline';
import { accountsApi } from '../../api/accountsApi';
import { formatDate } from '../../utils/formatters';
import {
  Card, EmptyState, Modal, SlideOver, money, asArray, unwrap, toPaise, today, humanize,
  inputClass, labelClass, primaryBtn, ghostBtn,
} from './ui';

export default function Invoices() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('invoices');
  const [creditFor, setCreditFor] = useState(null);
  const [statementFor, setStatementFor] = useState(null);

  const invoicesQuery = useQuery({ queryKey: ['acc-invoices'], queryFn: () => accountsApi.invoices({ limit: 500 }) });
  const creditQuery = useQuery({ queryKey: ['acc-credit-notes'], queryFn: () => accountsApi.creditNotes({ limit: 500 }) });

  const invoices = asArray(unwrap(invoicesQuery.data, []));
  const creditNotes = asArray(unwrap(creditQuery.data, []));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {[['invoices', 'Invoices'], ['credit-notes', 'Credit Notes']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${tab === key ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>{label}</button>
        ))}
      </div>

      <Card>
        {tab === 'invoices' ? (
          invoicesQuery.isLoading ? <EmptyState text="Loading invoices…" /> : invoices.length === 0 ? <EmptyState text="No invoices yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    <th className="py-2">Invoice #</th><th className="py-2">Customer</th><th className="py-2">Date</th><th className="py-2">Status</th>
                    <th className="py-2 text-right">Total</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Due</th><th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const due = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0));
                    return (
                      <tr key={inv.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                        <td className="py-2 font-bold text-neutral-900">{inv.invoiceNumber}</td>
                        <td className="py-2">
                          <button type="button" className="text-neutral-600 hover:text-neutral-900 hover:underline" onClick={() => inv.customerId && setStatementFor({ id: inv.customerId, name: inv.customer?.name })}>
                            {inv.customer?.name || '—'}
                          </button>
                        </td>
                        <td className="py-2 text-neutral-500">{formatDate(inv.invoiceDate)}</td>
                        <td className="py-2"><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase text-neutral-500">{humanize(inv.status)}</span></td>
                        <td className="py-2 text-right tabular-nums">{money(inv.totalAmount)}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">{money(inv.paidAmount)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{money(due)}</td>
                        <td className="py-2 text-right">
                          {inv.status !== 'VOID' && (
                            <button type="button" title="Create credit note" onClick={() => setCreditFor(inv)} className="rounded p-1 text-violet-600 hover:bg-violet-50">
                              <ReceiptRefundIcon className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          creditQuery.isLoading ? <EmptyState text="Loading credit notes…" /> : creditNotes.length === 0 ? <EmptyState text="No credit notes yet." /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                  <th className="py-2">Reference</th><th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="border-b border-neutral-50">
                    <td className="py-2 font-bold text-neutral-900">{cn.referenceNumber || cn.sourceId}</td>
                    <td className="py-2 text-neutral-500">{formatDate(cn.date)}</td>
                    <td className="py-2 text-neutral-600">{cn.description || '—'}</td>
                    <td className="py-2 text-right tabular-nums">{money(cn.amount ?? cn.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </Card>

      <CreditNoteModal invoice={creditFor} onClose={() => setCreditFor(null)} onSaved={() => { setCreditFor(null); qc.invalidateQueries({ queryKey: ['acc-credit-notes'] }); qc.invalidateQueries({ queryKey: ['acc-invoices'] }); }} />
      <PartyStatement customer={statementFor} onClose={() => setStatementFor(null)} />
    </div>
  );
}

function CreditNoteModal({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => accountsApi.createCreditNote({ invoiceId: invoice.id, totalAmount: toPaise(amount), reason: reason || undefined, date: today() }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not create credit note'),
  });
  if (!invoice) return null;
  const due = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
  return (
    <Modal open onClose={onClose} title={`Credit note — ${invoice.invoiceNumber}`}>
      <p className="text-sm text-neutral-500">Invoice total {money(invoice.totalAmount)} · outstanding {money(due)}.</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className={labelClass}>Credit amount</label>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="button" disabled={toPaise(amount) <= 0 || mutation.isPending} onClick={() => mutation.mutate()} className={primaryBtn}>{mutation.isPending ? 'Saving…' : 'Create credit note'}</button>
        </div>
      </div>
    </Modal>
  );
}

function PartyStatement({ customer, onClose }) {
  const query = useQuery({
    enabled: !!customer,
    queryKey: ['party-statement', customer?.id],
    queryFn: () => accountsApi.report('party-statement', { partyType: 'CUSTOMER', partyId: customer.id }),
  });
  const payload = unwrap(query.data, { data: [], summary: {} });
  const rows = asArray(payload.data);
  return (
    <SlideOver open={!!customer} title={customer?.name || 'Customer'} subtitle="Statement of account" onClose={onClose} width="max-w-2xl">
      {query.isLoading ? <EmptyState text="Loading statement…" /> : rows.length === 0 ? <EmptyState text="No transactions for this customer." /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2">Date</th><th className="py-2">Narration</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th><th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i} className="border-b border-neutral-50">
                <td className="py-2 text-xs text-neutral-500">{formatDate(row.journalEntry?.date || row.date)}</td>
                <td className="py-2 text-neutral-700">{row.description || row.journalEntry?.description || '—'}</td>
                <td className="py-2 text-right tabular-nums text-sky-700">{Number(row.debit) ? money(row.debit) : ''}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700">{Number(row.credit) ? money(row.credit) : ''}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{money(row.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SlideOver>
  );
}
