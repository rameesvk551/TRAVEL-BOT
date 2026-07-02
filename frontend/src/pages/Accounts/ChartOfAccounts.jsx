import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { accountsApi } from '../../api/accountsApi';
import { formatDate } from '../../utils/formatters';
import {
  Card, EmptyState, Stat, DrCrBadge, SlideOver, Modal, PeriodPicker, resolveRange,
  money, asArray, unwrap, toPaise, inputClass, labelClass, primaryBtn, ghostBtn,
} from './ui';

// Flatten tree → list (for merge targets and counts).
function flatten(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) flatten(node.children, out);
  }
  return out;
}

// IDs of nodes that match the query, plus all their ancestors (so the branch shows).
function matchingIds(nodes, query, ancestors = [], acc = new Set()) {
  const q = query.toLowerCase();
  for (const node of nodes) {
    const hit = `${node.code} ${node.name}`.toLowerCase().includes(q);
    if (hit) {
      acc.add(node.id);
      ancestors.forEach((id) => acc.add(id));
    }
    if (node.children?.length) matchingIds(node.children, query, [...ancestors, node.id], acc);
  }
  return acc;
}

function TypePill({ type }) {
  const map = {
    ASSET: 'bg-sky-50 text-sky-700',
    LIABILITY: 'bg-amber-50 text-amber-700',
    EQUITY: 'bg-violet-50 text-violet-700',
    REVENUE: 'bg-emerald-50 text-emerald-700',
    EXPENSE: 'bg-rose-50 text-rose-700',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${map[type] || 'bg-neutral-100 text-neutral-500'}`}>{type?.slice(0, 4)}</span>;
}

function TreeNode({ node, depth, expanded, toggle, showBalances, onSelect, onAddChild, onEdit, onMerge, onDelete }) {
  const isGroup = node.isGroup || node.children?.length > 0;
  const isOpen = expanded.has(node.id);
  const bal = showBalances ? (isGroup ? node.rollup?.balance : node.balance) : 0;
  const FolderIco = isOpen ? FolderOpenIcon : FolderIcon;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-lg py-1.5 pr-2 hover:bg-neutral-50"
        style={{ paddingLeft: `${depth * 22 + 4}px` }}
      >
        {isGroup ? (
          <button type="button" onClick={() => toggle(node.id)} className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-900">
            <ChevronRightIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {isGroup ? <FolderIco className="h-4 w-4 shrink-0 text-sky-500" /> : <DocumentTextIcon className="h-4 w-4 shrink-0 text-neutral-400" />}

        <button
          type="button"
          onClick={() => (isGroup ? toggle(node.id) : onSelect(node))}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-neutral-500">{node.code}</span>
          <span className={`truncate text-sm ${isGroup ? 'font-bold text-neutral-900' : 'font-medium text-neutral-700'}`}>{node.name}</span>
          {!isGroup && <TypePill type={node.type} />}
          {node.systemCreated && <span className="shrink-0 rounded bg-neutral-100 px-1 text-[9px] font-bold uppercase text-neutral-400">sys</span>}
        </button>

        {showBalances && (
          <span className="shrink-0 px-2 text-right">
            <DrCrBadge paise={bal} type={node.type} bold={isGroup} />
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {isGroup && (
            <button type="button" title="Add account" onClick={() => onAddChild(node)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50">
              <PlusCircleIcon className="h-4 w-4" />
            </button>
          )}
          {!isGroup && (
            <button type="button" title="Statement" onClick={() => onSelect(node)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
              <EyeIcon className="h-4 w-4" />
            </button>
          )}
          {!node.systemCreated && (
            <>
              <button type="button" title="Edit" onClick={() => onEdit(node)} className="rounded p-1 text-amber-500 hover:bg-amber-50">
                <PencilSquareIcon className="h-4 w-4" />
              </button>
              <button type="button" title="Merge into…" onClick={() => onMerge(node)} className="rounded p-1 text-violet-500 hover:bg-violet-50">
                <ArrowsRightLeftIcon className="h-4 w-4" />
              </button>
              <button type="button" title="Delete" onClick={() => onDelete(node)} className="rounded p-1 text-rose-500 hover:bg-rose-50">
                <TrashIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {isGroup && isOpen && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          showBalances={showBalances}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onMerge={onMerge}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// Filter the tree to nodes in the allowed id set (used for search).
function pruneTree(nodes, allowed) {
  return nodes
    .filter((node) => allowed.has(node.id))
    .map((node) => ({ ...node, children: node.children ? pruneTree(node.children, allowed) : [] }));
}

export default function ChartOfAccounts() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState({ preset: 'fy' });
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [showBalances, setShowBalances] = useState(true);
  const [selected, setSelected] = useState(null); // leaf node for statement
  const [editor, setEditor] = useState(null); // { mode:'add'|'edit', node, parent }
  const [mergeNode, setMergeNode] = useState(null);

  const range = useMemo(() => resolveRange(period), [period]);
  const treeQuery = useQuery({
    queryKey: ['coa-tree', range.dateFrom, range.dateTo],
    queryFn: () => accountsApi.ledgerTree({ withBalances: true, dateFrom: range.dateFrom, dateTo: range.dateTo }),
  });

  const tree = asArray(unwrap(treeQuery.data, []));
  const flat = useMemo(() => flatten(tree), [tree]);

  // Auto-expand top two levels on first load.
  useEffect(() => {
    if (tree.length && expanded.size === 0) {
      const ids = new Set();
      tree.forEach((root) => {
        ids.add(root.id);
        root.children?.forEach((child) => ids.add(child.id));
      });
      setExpanded(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  // When searching, auto-expand matching branches.
  const allowed = useMemo(() => (search.trim() ? matchingIds(tree, search.trim()) : null), [tree, search]);
  const displayTree = useMemo(() => (allowed ? pruneTree(tree, allowed) : tree), [tree, allowed]);
  const effectiveExpanded = useMemo(() => (allowed ? new Set([...expanded, ...allowed]) : expanded), [allowed, expanded]);

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const expandAll = () => setExpanded(new Set(flat.map((n) => n.id)));
  const collapseAll = () => setExpanded(new Set());

  // Top-strip totals by type (rollup at root sub-groups).
  const totals = useMemo(() => {
    const sum = { ASSET: 0, LIABILITY: 0, EQUITY: 0, REVENUE: 0, EXPENSE: 0 };
    flat.forEach((n) => {
      if (!n.isGroup && n.children?.length === 0) sum[n.type] = (sum[n.type] || 0) + Number(n.balance || 0);
    });
    const balanced = sum.ASSET === (sum.LIABILITY + sum.EQUITY + (sum.REVENUE - sum.EXPENSE));
    return { ...sum, balanced };
  }, [flat]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['coa-tree'] });

  const seedMutation = useMutation({ mutationFn: () => accountsApi.seedChart(), onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: (id) => accountsApi.deleteLedger(id),
    onSuccess: invalidate,
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not delete ledger'),
  });

  const handleDelete = async (node) => {
    try {
      const res = await accountsApi.canDeleteLedger(node.id);
      const can = unwrap(res, res);
      if (can && can.canDelete === false) {
        window.alert(can.reason || 'This ledger cannot be deleted.');
        return;
      }
    } catch {
      /* fall through to attempt; backend re-validates */
    }
    if (window.confirm(`Delete "${node.code} - ${node.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(node.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* top strip */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assets" value={money(totals.ASSET)} tone="blue" />
        <Stat label="Liabilities" value={money(totals.LIABILITY)} tone="amber" />
        <Stat label="Equity" value={money(totals.EQUITY)} tone="neutral" />
        <Stat label="Balance Check" value={totals.balanced ? 'Balanced ✓' : 'Off ✗'} note="Assets = Liab + Equity + P/L" tone={totals.balanced ? 'green' : 'rose'} />
      </div>

      <Card>
        {/* toolbar */}
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Chart of Accounts</p>
            <h2 className="mt-0.5 text-lg font-extrabold text-neutral-950">Ledger tree</h2>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search by code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={expandAll} className={ghostBtn} title="Expand all"><ArrowsPointingOutIcon className="h-4 w-4" /></button>
            <button type="button" onClick={collapseAll} className={ghostBtn} title="Collapse all"><ArrowsPointingInIcon className="h-4 w-4" /></button>
            <button type="button" onClick={() => setShowBalances((v) => !v)} className={ghostBtn} title="Toggle balances">
              {showBalances ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setEditor({ mode: 'add', parent: null })} className={primaryBtn}>
              <PlusCircleIcon className="h-4 w-4" /> New ledger
            </button>
          </div>
        </div>

        {/* tree */}
        {treeQuery.isLoading ? (
          <EmptyState text="Loading chart of accounts…" />
        ) : displayTree.length === 0 ? (
          search.trim() ? (
            <EmptyState text="No accounts match your search." />
          ) : (
            <div className="space-y-3 py-6 text-center">
              <EmptyState text="No chart of accounts yet." />
              <button type="button" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className={primaryBtn}>
                {seedMutation.isPending ? 'Seeding…' : 'Seed default chart'}
              </button>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-neutral-100">
            {displayTree.map((root) => (
              <TreeNode
                key={root.id}
                node={root}
                depth={0}
                expanded={effectiveExpanded}
                toggle={toggle}
                showBalances={showBalances}
                onSelect={setSelected}
                onAddChild={(parent) => setEditor({ mode: 'add', parent })}
                onEdit={(node) => setEditor({ mode: 'edit', node })}
                onMerge={(node) => setMergeNode(node)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Card>

      <LedgerStatement node={selected} range={range} onClose={() => setSelected(null)} />
      <LedgerEditor editor={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); invalidate(); }} />
      <MergeDialog node={mergeNode} ledgers={flat} onClose={() => setMergeNode(null)} onMerged={() => { setMergeNode(null); invalidate(); }} />
    </div>
  );
}

// ---- leaf statement slide-over ------------------------------------------

function LedgerStatement({ node, range, onClose }) {
  const query = useQuery({
    enabled: !!node,
    queryKey: ['ledger-report', node?.id, range.dateFrom, range.dateTo],
    queryFn: () => accountsApi.ledgerReport({ ledgerId: node.id, dateFrom: range.dateFrom, dateTo: range.dateTo }),
  });
  const payload = unwrap(query.data, { data: [], summary: {} });
  const rows = asArray(payload.data);

  return (
    <SlideOver open={!!node} title={node ? `${node.code} - ${node.name}` : ''} subtitle={node?.type} onClose={onClose} width="max-w-2xl">
      {query.isLoading ? (
        <EmptyState text="Loading statement…" />
      ) : rows.length === 0 ? (
        <EmptyState text="No transactions in this period." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2">Date</th>
              <th className="py-2">Narration</th>
              <th className="py-2 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-50">
                <td className="py-2 text-xs text-neutral-500">{formatDate(row.journalEntry?.date)}</td>
                <td className="py-2 text-neutral-700">{row.description || row.journalEntry?.description || '—'}</td>
                <td className="py-2 text-right tabular-nums text-sky-700">{Number(row.debit) ? money(row.debit) : ''}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700">{Number(row.credit) ? money(row.credit) : ''}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{money(row.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-extrabold">
              <td className="py-2" colSpan={2}>Total</td>
              <td className="py-2 text-right tabular-nums">{money(payload.summary?.debit)}</td>
              <td className="py-2 text-right tabular-nums">{money(payload.summary?.credit)}</td>
              <td className="py-2 text-right tabular-nums">{money(payload.summary?.balance)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </SlideOver>
  );
}

// ---- add / edit ledger --------------------------------------------------

const TYPE_TO_STATEMENT = {
  ASSET: 'BALANCE_SHEET',
  LIABILITY: 'BALANCE_SHEET',
  EQUITY: 'BALANCE_SHEET',
  REVENUE: 'PROFIT_AND_LOSS',
  EXPENSE: 'PROFIT_AND_LOSS',
};

function LedgerEditor({ editor, onClose, onSaved }) {
  const isEdit = editor?.mode === 'edit';
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!editor) { setForm(null); return; }
    if (isEdit) {
      const n = editor.node;
      setForm({ code: n.code, name: n.name, type: n.type, parentId: n.parentId || '', isGroup: !!n.isGroup, openingBalance: '' });
    } else {
      const parent = editor.parent;
      const type = parent?.type || 'ASSET';
      setForm({ code: '', name: '', type, parentId: parent?.id || '', isGroup: false, openingBalance: '' });
      accountsApi.nextLedgerCode(type).then((res) => {
        const data = unwrap(res, res);
        setForm((f) => (f ? { ...f, code: data.code || '' } : f));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? accountsApi.updateLedger(editor.node.id, payload) : accountsApi.createLedger(payload)),
    onSuccess: onSaved,
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not save ledger'),
  });

  if (!editor || !form) return null;

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      financialStatement: TYPE_TO_STATEMENT[form.type],
      isGroup: form.isGroup,
      parentId: form.parentId || null,
    };
    if (!isEdit) {
      if (form.code) payload.code = form.code;
      const ob = toPaise(form.openingBalance);
      if (ob) payload.openingBalance = ['ASSET', 'EXPENSE'].includes(form.type) ? ob : -ob;
    }
    mutation.mutate(payload);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit ledger' : 'New ledger'}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Code</label>
            <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={isEdit} placeholder="auto" />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              className={inputClass}
              value={form.type}
              disabled={isEdit}
              onChange={(e) => {
                const type = e.target.value;
                setForm((f) => ({ ...f, type }));
                if (!isEdit) accountsApi.nextLedgerCode(type).then((res) => {
                  const data = unwrap(res, res);
                  setForm((f) => (f ? { ...f, code: data.code || '' } : f));
                }).catch(() => {});
              }}
            >
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <input type="checkbox" checked={form.isGroup} onChange={(e) => setForm({ ...form, isGroup: e.target.checked })} />
          This is a group (folder, no transactions)
        </label>
        {!isEdit && !form.isGroup && (
          <div>
            <label className={labelClass}>Opening balance (optional)</label>
            <input className={inputClass} inputMode="decimal" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={mutation.isPending} className={primaryBtn}>{mutation.isPending ? 'Saving…' : 'Save ledger'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---- merge dialog -------------------------------------------------------

function MergeDialog({ node, ledgers, onClose, onMerged }) {
  const [targetId, setTargetId] = useState('');
  useEffect(() => { setTargetId(''); }, [node]);

  const mutation = useMutation({
    mutationFn: () => accountsApi.mergeLedgers({ sourceId: node.id, targetId }),
    onSuccess: onMerged,
    onError: (e) => window.alert(e?.response?.data?.error || 'Could not merge ledgers'),
  });

  if (!node) return null;
  const candidates = ledgers.filter((l) => l.id !== node.id && l.type === node.type && !l.isGroup);

  return (
    <Modal open onClose={onClose} title="Merge ledger" width="max-w-md">
      <p className="text-sm text-neutral-600">
        Move all transactions and children of <strong>{node.code} - {node.name}</strong> into another ledger, then delete it.
      </p>
      <div className="mt-3">
        <label className={labelClass}>Merge into</label>
        <select className={inputClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">Select target ledger…</option>
          {candidates.map((l) => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
        </select>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button type="button" disabled={!targetId || mutation.isPending} onClick={() => mutation.mutate()} className={primaryBtn}>
          {mutation.isPending ? 'Merging…' : 'Merge'}
        </button>
      </div>
    </Modal>
  );
}
