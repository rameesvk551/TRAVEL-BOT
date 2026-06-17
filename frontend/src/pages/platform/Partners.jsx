import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Building2,
  Plus,
  Palette,
  Receipt,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { platformApi } from '../../api/platformApi';
import { formatCurrency } from '../../utils/formatters';

function cx(...c) {
  return c.filter(Boolean).join(' ');
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  customDomain: '',
  isActive: true,
  brandName: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#00A884',
  accentColor: '#141414',
  loginTagline: '',
  loginImageUrl: '',
  supportEmail: '',
  supportUrl: '',
  emailFromName: '',
  emailReplyTo: '',
  emailFooterText: '',
  billingModel: 'REV_SHARE',
  revenueSharePercent: 0,
  perAgencyFee: 0,
  currency: 'INR',
  billingStatus: 'ACTIVE',
};

const FIELD_GROUPS = [
  {
    title: 'Identity',
    icon: Building2,
    fields: [
      { key: 'name', label: 'Partner name', placeholder: 'Acme Travel Tech' },
      { key: 'slug', label: 'Slug (subdomain)', placeholder: 'acme', hint: 'Used for acme.app.<root domain>' },
      { key: 'customDomain', label: 'Custom domain (optional)', placeholder: 'app.acmetravel.com' },
    ],
  },
  {
    title: 'Branding',
    icon: Palette,
    fields: [
      { key: 'brandName', label: 'Brand name', placeholder: 'Acme' },
      { key: 'logoUrl', label: 'Logo', type: 'image', assetType: 'logo' },
      { key: 'faviconUrl', label: 'Favicon', type: 'image', assetType: 'favicon' },
      { key: 'primaryColor', label: 'Primary color', type: 'color' },
      { key: 'accentColor', label: 'Accent color', type: 'color' },
      { key: 'loginTagline', label: 'Login tagline' },
      { key: 'loginImageUrl', label: 'Login hero image', type: 'image', assetType: 'login-image' },
      { key: 'supportEmail', label: 'Support email' },
      { key: 'supportUrl', label: 'Support URL' },
    ],
  },
  {
    title: 'Email identity',
    icon: Receipt,
    fields: [
      { key: 'emailFromName', label: 'Email from name' },
      { key: 'emailReplyTo', label: 'Email reply-to' },
      { key: 'emailFooterText', label: 'Email footer text' },
    ],
  },
];

function PartnerForm({ initial, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initial || {}) });
  const [uploading, setUploading] = useState({});
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleUpload = async (field, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [field.key]: true }));
    try {
      const res = await platformApi.uploadPartnerAsset(field.assetType, file);
      set(field.key, res.data.url);
      toast.success(`${field.label} uploaded`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [field.key]: false }));
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-6"
    >
      {FIELD_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-3 flex items-center gap-2">
            <group.icon className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-black uppercase tracking-wide text-neutral-700">{group.title}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.fields.map((field) => (
              <label key={field.key} className={cx('block', field.type === 'image' && 'sm:col-span-2')}>
                <span className="mb-1 block text-xs font-bold text-neutral-500">{field.label}</span>
                {field.type === 'image' ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                      {form[field.key] ? (
                        <img src={form[field.key]} alt={field.label} className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5 text-neutral-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <label className="shell-button-secondary cursor-pointer px-3 py-2 text-xs">
                          <Upload className="h-3.5 w-3.5" />
                          {uploading[field.key] ? 'Uploading…' : 'Upload'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading[field.key]}
                            onChange={(e) => handleUpload(field, e.target.files?.[0])}
                          />
                        </label>
                        {form[field.key] ? (
                          <button type="button" onClick={() => set(field.key, '')} className="text-xs font-bold text-rose-600 hover:underline">Remove</button>
                        ) : null}
                      </div>
                      <input
                        type="text"
                        value={form[field.key] || ''}
                        onChange={(e) => set(field.key, e.target.value)}
                        className="shell-input-rect mt-2 w-full text-xs"
                        placeholder="…or paste an image URL"
                      />
                    </div>
                  </div>
                ) : field.type === 'color' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form[field.key] || '#000000'}
                      onChange={(e) => set(field.key, e.target.value)}
                      className="h-10 w-14 rounded-lg border border-neutral-200"
                    />
                    <input
                      type="text"
                      value={form[field.key] || ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      className="shell-input-rect flex-1"
                      placeholder="#00A884"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form[field.key] || ''}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="shell-input-rect w-full"
                    placeholder={field.placeholder || ''}
                  />
                )}
                {field.hint ? <span className="mt-1 block text-[11px] text-neutral-400">{field.hint}</span> : null}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-black uppercase tracking-wide text-neutral-700">Commercials</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-neutral-500">Billing model</span>
            <select value={form.billingModel} onChange={(e) => set('billingModel', e.target.value)} className="shell-input-rect w-full">
              <option value="REV_SHARE">Revenue share</option>
              <option value="MARKUP">Markup</option>
              <option value="FLAT">Flat fee</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-neutral-500">Revenue share %</span>
            <input type="number" step="0.01" min="0" max="100" value={form.revenueSharePercent} onChange={(e) => set('revenueSharePercent', e.target.value)} className="shell-input-rect w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-neutral-500">Per-agency fee</span>
            <input type="number" step="0.01" min="0" value={form.perAgencyFee} onChange={(e) => set('perAgencyFee', e.target.value)} className="shell-input-rect w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-neutral-500">Currency</span>
            <input type="text" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} className="shell-input-rect w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-neutral-500">Billing status</span>
            <select value={form.billingStatus} onChange={(e) => set('billingStatus', e.target.value)} className="shell-input-rect w-full">
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past due</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={!!form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4" />
            <span className="text-xs font-bold text-neutral-600">Partner active</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <button type="button" onClick={onCancel} className="shell-button-secondary px-4">Cancel</button>
        <button type="submit" disabled={saving} className="shell-button-primary px-5 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save partner'}
        </button>
      </div>
    </form>
  );
}

function PartnerDetail({ partnerId, onClose }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState({ periodStart: '', periodEnd: '' });
  const [assignAgencyId, setAssignAgencyId] = useState('');

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['platform-partner', partnerId],
    queryFn: () => platformApi.partner(partnerId),
  });
  const { data: agenciesRes } = useQuery({
    queryKey: ['platform-agencies', { limit: 250 }],
    queryFn: () => platformApi.agencies({ limit: 250 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform-partner', partnerId] });
    qc.invalidateQueries({ queryKey: ['platform-partners'] });
  };

  const assignMutation = useMutation({
    mutationFn: () => platformApi.assignAgency(partnerId, assignAgencyId),
    onSuccess: () => { setAssignAgencyId(''); invalidate(); },
  });
  const unassignMutation = useMutation({
    mutationFn: (agencyId) => platformApi.unassignAgency(agencyId),
    onSuccess: invalidate,
  });
  const invoiceMutation = useMutation({
    mutationFn: () => platformApi.generatePartnerInvoice(partnerId, period),
    onSuccess: invalidate,
  });
  const invoiceStatusMutation = useMutation({
    mutationFn: ({ invoiceId, status }) => platformApi.updatePartnerInvoice(invoiceId, status),
    onSuccess: invalidate,
  });

  const partner = detailRes?.data;
  const allAgencies = agenciesRes?.data || [];
  const unassigned = useMemo(
    () => allAgencies.filter((a) => !a.partnerId),
    [allAgencies]
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-neutral-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <h2 className="text-lg font-black">{partner?.brandName || partner?.name || 'Partner'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>

        {isLoading || !partner ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : (
          <div className="space-y-6 p-5">
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl" style={{ background: partner.primaryColor || '#111' }}>
                  {partner.logoUrl ? <img src={partner.logoUrl} alt="" className="h-full w-full object-contain p-1.5" /> : <span className="text-white font-black">{(partner.brandName || partner.name || '?')[0]}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-black">{partner.brandName || partner.name}</p>
                  <p className="truncate text-xs text-neutral-500">{partner.slug}.app · {partner.customDomain || 'no custom domain'}</p>
                </div>
                <span className={cx('ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold', partner.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                  {partner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-neutral-50 p-2"><p className="font-black text-lg">{partner.agencies?.length || 0}</p><p className="text-neutral-500">Agencies</p></div>
                <div className="rounded-lg bg-neutral-50 p-2"><p className="font-black text-lg">{Number(partner.revenueSharePercent)}%</p><p className="text-neutral-500">Rev share</p></div>
                <div className="rounded-lg bg-neutral-50 p-2"><p className="font-black text-lg">{partner.billingStatus}</p><p className="text-neutral-500">Billing</p></div>
              </div>
            </section>

            {/* Agencies */}
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-neutral-700">Agencies</h3>
              <div className="mb-3 flex gap-2">
                <select value={assignAgencyId} onChange={(e) => setAssignAgencyId(e.target.value)} className="shell-input-rect flex-1">
                  <option value="">Assign an agency…</option>
                  {unassigned.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                </select>
                <button type="button" disabled={!assignAgencyId || assignMutation.isPending} onClick={() => assignMutation.mutate()} className="shell-button-primary px-4 disabled:opacity-60">Assign</button>
              </div>
              <ul className="divide-y divide-neutral-100">
                {(partner.agencies || []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{a.name}</p>
                      <p className="truncate text-xs text-neutral-400">{a.email}</p>
                    </div>
                    <button type="button" onClick={() => unassignMutation.mutate(a.id)} className="text-xs font-bold text-rose-600 hover:underline">Remove</button>
                  </li>
                ))}
                {(partner.agencies || []).length === 0 ? <li className="py-3 text-xs text-neutral-400">No agencies assigned yet.</li> : null}
              </ul>
            </section>

            {/* Billing */}
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-neutral-700">Revenue-share invoices</h3>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-neutral-500">Period start</span>
                  <input type="date" value={period.periodStart} onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))} className="shell-input-rect" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-neutral-500">Period end</span>
                  <input type="date" value={period.periodEnd} onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))} className="shell-input-rect" />
                </label>
                <button type="button" disabled={!period.periodStart || !period.periodEnd || invoiceMutation.isPending} onClick={() => invoiceMutation.mutate()} className="shell-button-primary px-4 disabled:opacity-60">Generate</button>
              </div>
              <ul className="divide-y divide-neutral-100">
                {(partner.invoices || []).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-bold">{inv.periodStart} → {inv.periodEnd}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(inv.amountDue, inv.currency)} due · {inv.agencyCount} agencies</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold',
                        inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : inv.status === 'ISSUED' ? 'bg-sky-50 text-sky-700' : inv.status === 'VOID' ? 'bg-neutral-100 text-neutral-500' : 'bg-amber-50 text-amber-700')}>{inv.status}</span>
                      {inv.status === 'DRAFT' ? <button type="button" onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'ISSUED' })} className="text-xs font-bold text-sky-600 hover:underline">Issue</button> : null}
                      {inv.status === 'ISSUED' ? <button type="button" onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'PAID' })} className="text-xs font-bold text-emerald-600 hover:underline">Mark paid</button> : null}
                    </div>
                  </li>
                ))}
                {(partner.invoices || []).length === 0 ? <li className="py-3 text-xs text-neutral-400">No invoices yet.</li> : null}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlatformPartners() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const { data: partnersRes, isLoading } = useQuery({
    queryKey: ['platform-partners'],
    queryFn: platformApi.partners,
  });
  const partners = partnersRes?.data || [];

  const createMutation = useMutation({
    mutationFn: (data) => platformApi.createPartner(data),
    onSuccess: () => { setShowForm(false); qc.invalidateQueries({ queryKey: ['platform-partners'] }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => platformApi.updatePartner(id, data),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['platform-partners'] }); },
  });

  const formError = createMutation.error || updateMutation.error;

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/platform" className="rounded-lg p-2 hover:bg-neutral-100" title="Back to dashboard"><ArrowLeft className="h-5 w-5" /></a>
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-neutral-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-black">White-label Partners</p>
              <p className="text-xs font-semibold text-neutral-400">Resellers and revenue share</p>
            </div>
          </div>
          <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="shell-button-primary px-4">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New partner</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-3 py-6 sm:px-6">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading partners…</p>
        ) : partners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 font-black">No partners yet</p>
            <p className="mt-1 text-sm text-neutral-500">Create a white-label partner to resell the platform under their own brand.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {partners.map((p) => (
              <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ background: p.primaryColor || '#111' }}>
                    {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-full w-full object-contain p-1.5" /> : <span className="font-black text-white">{(p.brandName || p.name || '?')[0]}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black">{p.brandName || p.name}</p>
                    <p className="truncate text-xs text-neutral-400">{p.slug}.app</p>
                  </div>
                  <span className={cx('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                    {p.isActive ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>{p.agencyCount} agencies</span>
                  <span>{Number(p.revenueSharePercent)}% share</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setDetailId(p.id)} className="shell-button-secondary flex-1 justify-center">Manage</button>
                  <button type="button" onClick={() => { setEditing(p); setShowForm(true); }} className="shell-button-secondary justify-center px-3">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{editing ? 'Edit partner' : 'New partner'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
            </div>
            {formError ? (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {formError?.response?.data?.error || 'Could not save partner'}
              </div>
            ) : null}
            <PartnerForm
              initial={editing}
              saving={createMutation.isPending || updateMutation.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(data) => (editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data))}
            />
          </div>
        </div>
      ) : null}

      {detailId ? <PartnerDetail partnerId={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}
