import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, TrashIcon, MinusCircleIcon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  ReceiptPercentIcon, BookOpenIcon, ArrowUpOnSquareIcon, MagnifyingGlassIcon, ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import client from '../../api/client';
import { accountsApi } from '../../api/accountsApi';
import { formatDate } from '../../utils/formatters';
import {
  Card, EmptyState, PeriodPicker, resolveRange, money, asArray, unwrap, toPaise, today, humanize,
  inputClass, labelClass, primaryBtn, ghostBtn,
} from './ui';

// Shared hook: flat list of postable (non-group) ledgers + balance map.
function useLedgers() {
  const query = useQuery({
    queryKey: ['coa-flat'],
    queryFn: () => accountsApi.ledgerTree({ withBalances: true }),
  });
  const tree = asArray(unwrap(query.data, []));
  const flat = useMemo(() => {
    const out = [];
    const walk = (nodes) => nodes.forEach((n) => { if (!n.isGroup) out.push(n); n.children?.length && walk(n.children); });
    walk(tree);
    return out;
  }, [tree]);
  const byId = useMemo(() => new Map(flat.map((l) => [l.id, l])), [flat]);
  return { ledgers: flat, byId };
}

function LedgerSelect({ value, onChange, ledgers, filter, placeholder = 'Select ledger…', className }) {
  const options = filter ? ledgers.filter(filter) : ledgers;
  return (
    <select className={className || inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((l) => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
    </select>
  );
}

export default function Journals() {
  const [view, setView] = useState('list'); // list | journal | receipt | payment | expense
  const [selectedId, setSelectedId] = useState(null);

  const actions = [
    { key: 'receipt', label: 'Receipt', icon: ArrowDownTrayIcon },
    { key: 'payment', label: 'Payment', icon: ArrowUpTrayIcon },
    { key: 'expense', label: 'Expense Voucher', icon: ReceiptPercentIcon },
    { key: 'journal', label: 'Journal Entry', icon: BookOpenIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {(view !== 'list' || selectedId) && (
            <button type="button" onClick={() => { setView('list'); setSelectedId(null); }} className={ghostBtn}><ArrowLeftIcon className="h-4 w-4" /> Back</button>
          )}
          <h2 className="text-lg font-extrabold text-neutral-950">
            {selectedId ? 'Journal Entry Details' : view === 'list' ? 'Journal Entries' : view === 'journal' ? 'New Journal Entry' : `New ${humanize(view)}`}
          </h2>
        </div>
        {view === 'list' && !selectedId && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button key={a.key} type="button" onClick={() => setView(a.key)} className={a.key === 'journal' ? primaryBtn : ghostBtn}>
                <a.icon className="h-4 w-4" /> {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'list' && !selectedId && <JournalList onSelect={setSelectedId} />}
      {selectedId && <JournalDetails id={selectedId} />}
      {view === 'journal' && <JournalEntryForm onDone={() => setView('list')} />}
      {(view === 'receipt' || view === 'payment' || view === 'expense') && (
        <VoucherForm kind={view} onDone={() => setView('list')} />
      )}
    </div>
  );
}

// ---- list ---------------------------------------------------------------

function JournalList({ onSelect }) {
  const [period, setPeriod] = useState({ preset: 'month' });
  const [search, setSearch] = useState('');
  const range = useMemo(() => resolveRange(period), [period]);

  const query = useQuery({
    queryKey: ['journals-list', range.dateFrom, range.dateTo],
    queryFn: () => accountsApi.journals({ pageSize: 500, dateFrom: range.dateFrom, dateTo: range.dateTo }),
  });
  const rows = asArray(unwrap(query.data, { data: [] }).data);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.referenceNumber} ${r.description} ${r.type}`.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <Card>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input className={`${inputClass} pl-9`} placeholder="Search by reference, description, type…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {query.isLoading ? (
        <EmptyState text="Loading entries…" />
      ) : filtered.length === 0 ? (
        <EmptyState text="No journal entries found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                <th className="py-2">Reference #</th>
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} onClick={() => onSelect(entry.id)} className="cursor-pointer border-b border-neutral-50 transition-colors hover:bg-neutral-50">
                  <td className="py-2 font-bold text-neutral-900">{entry.referenceNumber}</td>
                  <td className="py-2 text-neutral-500">{formatDate(entry.date)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase text-neutral-500">{humanize(entry.type)}</span>
                  </td>
                  <td className="py-2 text-neutral-600">{entry.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---- bulk journal entry editor ------------------------------------------

const blankLine = () => ({ ledgerId: '', debit: '', credit: '' });

function JournalEntryForm({ onDone }) {
  const qc = useQueryClient();
  const { ledgers, byId } = useLedgers();
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([blankLine(), blankLine()]);
  const [narration, setNarration] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const totalDebit = lines.reduce((s, l) => s + toPaise(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toPaise(l.credit), 0);
  const difference = totalDebit - totalCredit;
  const balanced = difference === 0 && totalDebit > 0;
  const validLines = lines.filter((l) => l.ledgerId && (toPaise(l.debit) > 0 || toPaise(l.credit) > 0));

  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (i) => setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const uploadFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('media', file);
        const res = await client.post('/templates/upload-media', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const url = res?.data?.data?.url;
        if (url) setAttachments((prev) => [...prev, { url, name: file.name }]);
      }
    } catch (e) {
      window.alert('Upload failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => accountsApi.createJournal({
      date,
      description: narration || undefined,
      lines: validLines.map((l) => ({ ledgerId: l.ledgerId, debit: toPaise(l.debit), credit: toPaise(l.credit) })),
      metadata: attachments.length ? { attachments } : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals-list'] });
      qc.invalidateQueries({ queryKey: ['coa-tree'] });
      onDone();
    },
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not post journal entry'),
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-end">
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => {
          const led = byId.get(line.ledgerId);
          return (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-100 p-2 sm:flex-nowrap">
              <span className="w-6 shrink-0 text-center text-sm font-bold text-neutral-400">{i + 1}</span>
              <div className="min-w-[180px] flex-1">
                <label className={labelClass}>Ledger</label>
                <LedgerSelect value={line.ledgerId} onChange={(v) => setLine(i, { ledgerId: v })} ledgers={ledgers} />
              </div>
              <div className="w-28 shrink-0">
                <label className={labelClass}>Balance</label>
                <input className={`${inputClass} bg-neutral-50 text-neutral-500`} value={led ? money(led.balance) : '—'} readOnly />
              </div>
              <div className="w-28 shrink-0">
                <label className={labelClass}>Debit</label>
                <input className={inputClass} inputMode="decimal" value={line.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} placeholder="0.00" />
              </div>
              <div className="w-28 shrink-0">
                <label className={labelClass}>Credit</label>
                <input className={inputClass} inputMode="decimal" value={line.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} placeholder="0.00" />
              </div>
              <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="mb-1.5 shrink-0 rounded p-1.5 text-neutral-400 hover:text-rose-600 disabled:opacity-30">
                <MinusCircleIcon className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-center">
        <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
          <PlusIcon className="h-4 w-4" /> Add Line
        </button>
      </div>

      <div className="mx-auto mt-4 flex max-w-xl items-center justify-around gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center">
        <div>
          <p className="text-[11px] font-bold uppercase text-neutral-400">Total Debit</p>
          <p className="text-lg font-extrabold text-neutral-900">{money(totalDebit)}</p>
        </div>
        <div className="h-8 w-px bg-neutral-200" />
        <div>
          <p className="text-[11px] font-bold uppercase text-neutral-400">Total Credit</p>
          <p className="text-lg font-extrabold text-neutral-900">{money(totalCredit)}</p>
        </div>
        <div className="h-8 w-px bg-neutral-200" />
        <div>
          <p className="text-[11px] font-bold uppercase text-neutral-400">Difference</p>
          <p className={`text-lg font-extrabold ${difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(difference)}</p>
        </div>
      </div>

      <textarea className={`${inputClass} mt-4`} rows={3} placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />

      <div
        className="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-neutral-200 px-4 py-8 text-center hover:border-neutral-300"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); uploadFiles(Array.from(e.dataTransfer.files)); }}
      >
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadFiles(Array.from(e.target.files))} />
        <ArrowUpOnSquareIcon className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-2 font-bold text-neutral-600">{uploading ? 'Uploading…' : 'Drop images here or click to browse'}</p>
        <p className="text-xs text-neutral-400">Support for multiple image files</p>
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {attachments.map((a, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">
                {a.name}
                <button type="button" onClick={(e) => { e.stopPropagation(); setAttachments((prev) => prev.filter((_, idx) => idx !== i)); }}>
                  <TrashIcon className="h-3 w-3 text-rose-500" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onDone} className={ghostBtn}>Cancel</button>
        <button type="button" disabled={!balanced || validLines.length < 2 || mutation.isPending} onClick={() => mutation.mutate()} className={primaryBtn}>
          {mutation.isPending ? 'Posting…' : 'Post Journal Entry'}
        </button>
      </div>
    </Card>
  );
}

// ---- guided voucher (receipt / payment / expense) -----------------------

const VOUCHER_CONFIG = {
  receipt: {
    endpoint: 'receipts',
    title: 'Receipt — money received',
    cashLabel: 'Received into (Cash / Bank)',
    otherLabel: 'Received from (ledger)',
    cashFilter: (l) => l.type === 'ASSET',
    // cash debited, source credited
    buildLines: (cashId, otherId, amt) => [{ ledgerId: cashId, debit: amt }, { ledgerId: otherId, credit: amt }],
  },
  payment: {
    endpoint: 'payments',
    title: 'Payment — money paid out',
    cashLabel: 'Paid from (Cash / Bank)',
    otherLabel: 'Paid to (ledger)',
    cashFilter: (l) => l.type === 'ASSET',
    buildLines: (cashId, otherId, amt) => [{ ledgerId: otherId, debit: amt }, { ledgerId: cashId, credit: amt }],
  },
  expense: {
    endpoint: 'expense-vouchers',
    title: 'Expense voucher',
    cashLabel: 'Paid via (Cash / Bank)',
    otherLabel: 'Expense account',
    cashFilter: (l) => l.type === 'ASSET',
    otherFilter: (l) => l.type === 'EXPENSE',
    buildLines: (cashId, otherId, amt) => [{ ledgerId: otherId, debit: amt }, { ledgerId: cashId, credit: amt }],
  },
};

function VoucherForm({ kind, onDone }) {
  const cfg = VOUCHER_CONFIG[kind];
  const qc = useQueryClient();
  const { ledgers } = useLedgers();
  const [cashId, setCashId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');

  const amt = toPaise(amount);
  const valid = cashId && otherId && cashId !== otherId && amt > 0;

  const mutation = useMutation({
    mutationFn: () => accountsApi.createVoucher(cfg.endpoint, {
      date,
      description: description || undefined,
      lines: cfg.buildLines(cashId, otherId, amt),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals-list'] });
      qc.invalidateQueries({ queryKey: ['coa-tree'] });
      onDone();
    },
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not post voucher'),
  });

  return (
    <Card className="mx-auto max-w-xl">
      <p className="eyebrow">{cfg.title}</p>
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{cfg.cashLabel}</label>
            <LedgerSelect value={cashId} onChange={setCashId} ledgers={ledgers} filter={cfg.cashFilter} />
          </div>
          <div>
            <label className={labelClass}>{cfg.otherLabel}</label>
            <LedgerSelect value={otherId} onChange={setOtherId} ledgers={ledgers} filter={cfg.otherFilter} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Amount</label>
            <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Narration</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
        {valid && (
          <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            Posts: <span className="font-bold text-sky-700">Dr {ledgers.find((l) => l.id === cfg.buildLines(cashId, otherId, amt)[0].ledgerId)?.name}</span>
            {' · '}
            <span className="font-bold text-emerald-700">Cr {ledgers.find((l) => l.id === cfg.buildLines(cashId, otherId, amt)[1].ledgerId)?.name}</span>
            {' · '}{money(amt)}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onDone} className={ghostBtn}>Cancel</button>
          <button type="button" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()} className={primaryBtn}>
            {mutation.isPending ? 'Posting…' : `Post ${humanize(kind)}`}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---- details ------------------------------------------------------------

function JournalDetails({ id }) {
  const query = useQuery({
    queryKey: ['journal', id],
    queryFn: () => accountsApi.journal(id),
  });

  const entry = unwrap(query.data);

  if (query.isLoading) {
    return <EmptyState text="Loading details…" />;
  }
  if (!entry) {
    return <EmptyState text="Entry not found." />;
  }

  const lines = asArray(entry.lines);
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <Card className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-neutral-900">{entry.referenceNumber}</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Date: <span className="font-semibold text-neutral-800">{formatDate(entry.date)}</span>
            {' · '}
            Type: <span className="font-semibold uppercase text-neutral-700">{humanize(entry.type)}</span>
          </p>
        </div>
      </div>

      {entry.description && (
        <div className="mb-6 rounded-lg bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-700">Description</p>
          <p className="mt-1 text-sm text-neutral-600">{entry.description}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Ledger</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3">Narration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lines.map((line, i) => (
              <tr key={line.id || i} className="hover:bg-neutral-50/50">
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  {line.ledger?.name || 'Unknown Ledger'}
                  {line.ledger?.code && <span className="ml-1 text-xs text-neutral-400">({line.ledger.code})</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{line.debit > 0 ? money(line.debit) : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{line.credit > 0 ? money(line.credit) : '—'}</td>
                <td className="px-4 py-3 text-neutral-500">{line.description || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-neutral-50">
            <tr className="border-t-2 border-neutral-200">
              <td className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-500">Total</td>
              <td className="px-4 py-3 text-right font-extrabold tabular-nums text-neutral-900">{money(totalDebit)}</td>
              <td className="px-4 py-3 text-right font-extrabold tabular-nums text-neutral-900">{money(totalCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {entry.metadata?.attachments?.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold text-neutral-700">Attachments</p>
          <div className="flex flex-wrap gap-4">
            {entry.metadata.attachments.map((a, i) => {
              const isImage = a.url.match(/\.(jpeg|jpg|gif|png)$/i);
              return (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2 pr-4 transition-colors hover:bg-neutral-50">
                  {isImage ? (
                    <img src={a.url} alt={a.name || 'Attachment'} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100">
                      <BookOpenIcon className="h-5 w-5 text-neutral-400" />
                    </div>
                  )}
                  <span className="max-w-[150px] truncate text-sm font-medium text-neutral-700">{a.name || 'View Attachment'}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
