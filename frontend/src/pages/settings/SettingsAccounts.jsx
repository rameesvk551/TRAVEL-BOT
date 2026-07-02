import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BanknotesIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { accountsApi } from '../../api/accountsApi';

const METHOD_TYPES = ['BANK', 'CASH', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];

function unwrap(response, fallback) {
  return response?.data ?? fallback;
}

function methodLabel(method) {
  const ledger = method?.ledger?.name ? ` · ${method.ledger.name}` : '';
  return `${method?.name || 'Payment method'}${ledger}`;
}

function PaymentMethodForm({ method, ledgers, onCancel, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: method?.name || '',
    methodType: method?.methodType || 'BANK',
    ledgerId: method?.ledgerId || ledgers[0]?.id || '',
    isDefault: Boolean(method?.isDefault),
    isActive: method?.isActive !== false,
    sortOrder: method?.sortOrder || 0,
  });

  useEffect(() => {
    if (!form.ledgerId && ledgers[0]?.id) setForm((current) => ({ ...current, ledgerId: ledgers[0].id }));
  }, [form.ledgerId, ledgers]);

  const mutation = useMutation({
    mutationFn: (payload) => method
      ? accountsApi.updatePaymentMethod(method.id, payload)
      : accountsApi.createPaymentMethod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-payment-methods'] });
      onSaved();
    },
    onError: (err) => window.alert(err?.response?.data?.error || 'Could not save payment method'),
  });

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder || 0),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Name</span>
          <input
            required
            className="shell-input-rect"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="HDFC Current Account"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Type</span>
          <select className="shell-input-rect" value={form.methodType} onChange={(e) => setForm({ ...form, methodType: e.target.value })}>
            {METHOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Cash & Bank Ledger</span>
        <select className="shell-input-rect" required value={form.ledgerId} onChange={(e) => setForm({ ...form, ledgerId: e.target.value })}>
          <option value="">Select ledger...</option>
          {ledgers.map((ledger) => (
            <option key={ledger.id} value={ledger.id}>{ledger.code} · {ledger.name}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Default for receipts
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-neutral-500 hover:bg-neutral-100">Cancel</button>
        <button type="submit" disabled={mutation.isPending || !form.ledgerId} className="shell-button-primary">
          {mutation.isPending ? 'Saving...' : 'Save method'}
        </button>
      </div>
    </form>
  );
}

export default function SettingsAccounts() {
  const queryClient = useQueryClient();
  const [editingMethod, setEditingMethod] = useState(null);
  const [showNewMethod, setShowNewMethod] = useState(false);
  const [rules, setRules] = useState({});

  const methodsQuery = useQuery({
    queryKey: ['account-payment-methods'],
    queryFn: () => accountsApi.paymentMethods({ activeOnly: false }),
  });
  const ledgersQuery = useQuery({
    queryKey: ['account-payment-method-ledgers'],
    queryFn: () => accountsApi.paymentMethodLedgers(),
  });
  const postingRulesQuery = useQuery({
    queryKey: ['account-posting-rules'],
    queryFn: () => accountsApi.postingRules(),
  });
  const allLedgersQuery = useQuery({
    queryKey: ['account-ledgers-for-posting-rules'],
    queryFn: () => accountsApi.ledgers({ activeOnly: true }),
  });

  const methods = unwrap(methodsQuery.data, []);
  const paymentLedgers = unwrap(ledgersQuery.data, []);
  const postingRules = unwrap(postingRulesQuery.data, {});
  const allLedgers = unwrap(allLedgersQuery.data, []);
  const postingLedgers = useMemo(() => allLedgers.filter((ledger) => !ledger.isGroup && ledger.isActive !== false), [allLedgers]);

  useEffect(() => {
    if (postingRulesQuery.data) {
      setRules({
        salesLedgerId: postingRules.salesLedgerId || '',
        commissionSalesLedgerId: postingRules.commissionSalesLedgerId || '',
        customerAdvanceLedgerId: postingRules.customerAdvanceLedgerId || '',
        tradeDebtorsLedgerId: postingRules.tradeDebtorsLedgerId || '',
        tradeCreditorsLedgerId: postingRules.tradeCreditorsLedgerId || '',
        vendorExpenseLedgerId: postingRules.vendorExpenseLedgerId || '',
      });
    }
  }, [postingRulesQuery.data]);

  const saveRules = useMutation({
    mutationFn: (payload) => accountsApi.updatePostingRules(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-posting-rules'] });
      window.alert('Posting rules updated');
    },
    onError: (err) => window.alert(err?.response?.data?.error || 'Could not update posting rules'),
  });

  const ruleFields = [
    ['salesLedgerId', 'Sales ledger (full collection)'],
    ['commissionSalesLedgerId', 'Commission income (commission-only)'],
    ['customerAdvanceLedgerId', 'Customer advances'],
    ['tradeDebtorsLedgerId', 'Trade debtors'],
    ['tradeCreditorsLedgerId', 'Trade creditors'],
    ['vendorExpenseLedgerId', 'Vendor expense'],
  ];

  return (
    <div className="space-y-6">
      <section className="shell-panel p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Cash & Bank</p>
            <h2 className="mt-1 text-xl font-extrabold text-neutral-950">Payment Methods</h2>
            <p className="mt-1 text-sm text-neutral-500">Map every cash, bank, UPI, wallet, or gateway option to a ledger under Cash & Bank.</p>
          </div>
          <button type="button" onClick={() => { setEditingMethod(null); setShowNewMethod(true); }} className="shell-button-primary inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            New method
          </button>
        </div>

        {(showNewMethod || editingMethod) && (
          <div className="mb-5">
            <PaymentMethodForm
              method={editingMethod}
              ledgers={paymentLedgers}
              onCancel={() => { setShowNewMethod(false); setEditingMethod(null); }}
              onSaved={() => { setShowNewMethod(false); setEditingMethod(null); }}
            />
          </div>
        )}

        {methodsQuery.isLoading ? (
          <div className="py-8 text-sm font-semibold text-neutral-400">Loading payment methods...</div>
        ) : methods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm font-semibold text-neutral-500">
            No payment methods yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ledger</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {methods.map((method) => (
                  <tr key={method.id}>
                    <td className="px-4 py-3 font-bold text-neutral-950">
                      <span className="inline-flex items-center gap-2">
                        {method.isDefault && <CheckCircleIcon className="h-4 w-4 text-emerald-600" />}
                        {method.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{method.methodType}</td>
                    <td className="px-4 py-3 text-neutral-600">{method.ledger?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${method.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => { setShowNewMethod(false); setEditingMethod(method); }} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950" title={`Edit ${methodLabel(method)}`}>
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="shell-panel p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950 text-white">
            <Cog6ToothIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow">Double Entry</p>
            <h2 className="mt-1 text-xl font-extrabold text-neutral-950">Posting Rules</h2>
            <p className="mt-1 text-sm text-neutral-500">Choose default ledgers used by booking invoices, advances, vendor bills, and receivable/payable reports.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ruleFields.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</span>
              <select className="shell-input-rect" value={rules[key] || ''} onChange={(e) => setRules({ ...rules, [key]: e.target.value })}>
                <option value="">Use system default</option>
                {postingLedgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>{ledger.code} · {ledger.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => saveRules.mutate(rules)} disabled={saveRules.isPending} className="shell-button-primary inline-flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4" />
            {saveRules.isPending ? 'Saving...' : 'Save posting rules'}
          </button>
        </div>
      </section>
    </div>
  );
}
