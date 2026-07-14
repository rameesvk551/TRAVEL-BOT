import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { leadFormsApi } from '../../api/leadFormsApi';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  ClipboardIcon,
  CheckIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

const FIELD_TYPES = ['text', 'phone', 'email', 'date', 'number', 'select', 'textarea'];

// Mirrors backend MAP_TARGETS. Pax/budget targets require a number field.
const MAP_TARGETS = [
  { value: 'custom', label: 'Custom (shown in lead details)' },
  { value: 'customerName', label: 'Customer name' },
  { value: 'customerPhone', label: 'Phone (required)' },
  { value: 'customerEmail', label: 'Email' },
  { value: 'destination', label: 'Destination' },
  { value: 'travellers', label: 'Travellers (total)' },
  { value: 'adults', label: 'Adults' },
  { value: 'children6To12', label: 'Children (6-12)' },
  { value: 'childrenBelow5', label: 'Children (below 5)' },
  { value: 'travelStart', label: 'Travel start date' },
  { value: 'travelEnd', label: 'Travel end date' },
  { value: 'travelDates', label: 'Travel dates (text)' },
  { value: 'budgetPerPerson', label: 'Budget per person' },
  { value: 'interest', label: 'Interest' },
  { value: 'notes', label: 'Notes' },
];

const DEFAULT_FIELDS = [
  { id: 'name', label: 'Full name', type: 'text', placeholder: 'Your name', required: true, mapsTo: 'customerName' },
  { id: 'phone', label: 'WhatsApp number', type: 'phone', placeholder: '+91 9XXXXXXXXX', required: true, mapsTo: 'customerPhone' },
  { id: 'destination', label: 'Where do you want to go?', type: 'text', placeholder: 'e.g. Bali, Dubai', required: false, mapsTo: 'destination' },
  { id: 'travelDates', label: 'Travel dates', type: 'text', placeholder: 'e.g. 12-18 Dec', required: false, mapsTo: 'travelDates' },
  { id: 'notes', label: 'Anything else?', type: 'textarea', placeholder: 'Tell us about your trip', required: false, mapsTo: 'custom' },
];

const BLANK = {
  name: '',
  slug: '',
  enabled: false,
  isDefault: false,
  title: 'Plan your trip with us',
  description: 'Tell us a few details and our travel expert will reach out on WhatsApp.',
  successMessage: 'Thank you! Our travel expert will contact you shortly.',
  submitLabel: 'Send my enquiry',
};

let fieldSeq = 0;
function newField() {
  fieldSeq += 1;
  return { id: `field_${Date.now()}_${fieldSeq}`, label: '', type: 'text', placeholder: '', required: false, mapsTo: 'custom', options: [] };
}

function optionsToText(options = []) {
  return (options || []).map((o) => o.label).join(', ');
}
function textToOptions(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label, value: label }));
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

function toEditor(form) {
  if (!form) return null;
  return {
    id: form.id,
    name: form.name || '',
    slug: form.slug || '',
    enabled: Boolean(form.enabled),
    isDefault: Boolean(form.isDefault),
    title: form.title || BLANK.title,
    description: form.description || '',
    successMessage: form.successMessage || BLANK.successMessage,
    submitLabel: form.submitLabel || BLANK.submitLabel,
    fields: (form.fields || []).map((f) => ({ ...f, options: f.options || [] })),
  };
}

export default function SettingsLeadForm() {
  const { agency } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['lead-forms'],
    queryFn: leadFormsApi.list,
  });
  const forms = data?.data || [];

  // Select the default form (or the first) once the list arrives.
  useEffect(() => {
    if (!forms.length) return;
    const stillThere = selectedId && forms.some((f) => f.id === selectedId);
    if (!stillThere) {
      const pick = forms.find((f) => f.isDefault) || forms[0];
      setSelectedId(pick.id);
      setForm(toEditor(pick));
    }
  }, [forms, selectedId]);

  const agencyKey = agency?.subdomain || agency?.id || '';
  const isNew = selectedId === '__new__';
  const publicLink = useMemo(() => {
    const base = `${window.location.origin}/lead/${agencyKey}`;
    if (!form) return base;
    // The default form also answers the bare link; a named form needs its slug.
    return form.isDefault || !form.slug ? base : `${base}/${form.slug}`;
  }, [agencyKey, form]);

  const sourceExamples = useMemo(
    () => [
      { label: 'Instagram', url: `${publicLink}?source=instagram&utm_campaign=bio` },
      { label: 'Facebook', url: `${publicLink}?source=facebook` },
      { label: 'QR code', url: `${publicLink}?source=qr` },
    ],
    [publicLink]
  );

  const update = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));
  const updateField = (index, patch) =>
    setForm((cur) => ({ ...cur, fields: cur.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
  const removeField = (index) => setForm((cur) => ({ ...cur, fields: cur.fields.filter((_, i) => i !== index) }));
  const addField = () => setForm((cur) => ({ ...cur, fields: [...cur.fields, newField()] }));
  const moveField = (index, dir) =>
    setForm((cur) => {
      const next = [...cur.fields];
      const target = index + dir;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...cur, fields: next };
    });

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  };

  const startNew = () => {
    setSelectedId('__new__');
    setForm({ ...BLANK, name: '', fields: DEFAULT_FIELDS.map((f) => ({ ...f, options: [] })) });
    setError('');
    setSuccess('');
  };

  const selectForm = (f) => {
    setSelectedId(f.id);
    setForm(toEditor(f));
    setError('');
    setSuccess('');
  };

  const done = (message) => {
    setSuccess(message);
    setError('');
    queryClient.invalidateQueries({ queryKey: ['lead-forms'] });
    setTimeout(() => setSuccess(''), 3000);
  };
  const failed = (err, fallback) => {
    setError(err.response?.data?.error || fallback);
    setSuccess('');
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isNew ? leadFormsApi.create(payload) : leadFormsApi.update(selectedId, payload),
    onSuccess: ({ data: saved }) => {
      setSelectedId(saved.id);
      setForm(toEditor(saved));
      done('Lead form saved.');
    },
    onError: (err) => failed(err, 'Failed to save lead form'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => leadFormsApi.remove(id),
    onSuccess: () => {
      setSelectedId(null);
      setForm(null);
      done('Lead form deleted.');
    },
    onError: (err) => failed(err, 'Failed to delete lead form'),
  });

  const handleSave = () => {
    setError('');
    if (!form.name.trim()) {
      setError('Give this form a name (e.g. "Villa enquiry").');
      return;
    }
    if (form.enabled) {
      if (!form.fields.some((f) => f.mapsTo === 'customerPhone')) {
        setError('Add a field mapped to "Phone" before enabling the form.');
        return;
      }
      if (form.fields.some((f) => !f.label.trim())) {
        setError('Every field needs a label.');
        return;
      }
    }
    saveMutation.mutate({
      name: form.name,
      slug: form.slug || undefined,
      enabled: form.enabled,
      isDefault: form.isDefault,
      title: form.title,
      description: form.description,
      successMessage: form.successMessage,
      submitLabel: form.submitLabel,
      fields: form.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder,
        required: f.required,
        mapsTo: f.mapsTo,
        options: f.type === 'select' ? f.options : undefined,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {/* Forms list */}
      <div className="shell-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-5 w-5 text-[#2d2d2d]" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Lead Forms</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Build as many capture forms as you need — each gets its own link, and any can be opened from a
                campaign or Instagram card button. Submissions land in your CRM with full source tracking.
              </p>
            </div>
          </div>
          <button type="button" onClick={startNew} className="shell-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
            <PlusIcon className="h-4 w-4" /> New form
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {isLoading ? <p className="text-sm text-neutral-400">Loading forms…</p> : null}
          {forms.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => selectForm(f)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                selectedId === f.id
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
              }`}
            >
              {f.isDefault ? <StarIcon className="h-3.5 w-3.5" /> : null}
              {f.name}
              <span className={`text-[10px] uppercase ${selectedId === f.id ? 'text-white/60' : 'text-neutral-400'}`}>
                {f.enabled ? 'live' : 'off'}
              </span>
            </button>
          ))}
          {isNew ? (
            <span className="rounded-full border border-dashed border-neutral-400 px-4 py-2 text-sm font-medium text-neutral-500">
              New form (unsaved)
            </span>
          ) : null}
        </div>
      </div>

      {!form ? null : (
        <>
          {/* Identity + link */}
          <div className="shell-panel space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Form settings</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => update('enabled', e.target.checked)}
                    className="h-5 w-5 rounded border-neutral-300"
                  />
                  {form.enabled ? 'Enabled' : 'Disabled'}
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => update('isDefault', e.target.checked)}
                    className="h-5 w-5 rounded border-neutral-300"
                  />
                  Default
                </label>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Form name" hint="Internal label, e.g. “Villa enquiry”.">
                <input className="shell-input-rect" value={form.name} maxLength={120} onChange={(e) => update('name', e.target.value)} placeholder="Villa enquiry" />
              </Field>
              <Field label="Link slug" hint="Leave blank to generate from the name.">
                <input className="shell-input-rect" value={form.slug} maxLength={80} onChange={(e) => update('slug', e.target.value)} placeholder="villa-enquiry" />
              </Field>
            </div>

            {!isNew ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <code className="truncate text-sm text-neutral-700">{publicLink}</code>
                  <button
                    type="button"
                    onClick={() => copy(publicLink, 'main')}
                    className="shell-button-secondary flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs"
                  >
                    {copied === 'main' ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                    {copied === 'main' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceExamples.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => copy(ex.url, ex.label)}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-300"
                      title={ex.url}
                    >
                      {copied === ex.label ? 'Copied!' : `Copy ${ex.label} link`}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  When a campaign or Instagram card button opens this form, the tapped item is appended automatically
                  (<code>?item=PROPERTY:&lt;id&gt;</code>) and the lead is linked to that property.
                </p>
              </div>
            ) : null}
          </div>

          {/* Form copy */}
          <div className="shell-panel space-y-5 p-6">
            <h3 className="text-base font-bold text-slate-900">Form text</h3>
            <Field label="Title">
              <input className="shell-input-rect" value={form.title} maxLength={160} onChange={(e) => update('title', e.target.value)} />
            </Field>
            <Field label="Description" hint="Short line shown under the title.">
              <textarea className="shell-input-rect resize-y" rows={2} maxLength={600} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Submit button label">
                <input className="shell-input-rect" value={form.submitLabel} maxLength={60} onChange={(e) => update('submitLabel', e.target.value)} />
              </Field>
              <Field label="Success message">
                <input className="shell-input-rect" value={form.successMessage} maxLength={400} onChange={(e) => update('successMessage', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Field builder */}
          <div className="shell-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Form fields</h3>
              <button type="button" onClick={addField} className="shell-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
                <PlusIcon className="h-4 w-4" /> Add field
              </button>
            </div>

            <div className="space-y-4">
              {form.fields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Label">
                      <input
                        className="shell-input-rect"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Field label"
                      />
                    </Field>
                    <Field label="Maps to">
                      <select className="shell-input-rect" value={field.mapsTo} onChange={(e) => updateField(index, { mapsTo: e.target.value })}>
                        {MAP_TARGETS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Type">
                      <select className="shell-input-rect" value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Placeholder">
                      <input
                        className="shell-input-rect"
                        value={field.placeholder}
                        onChange={(e) => updateField(index, { placeholder: e.target.value })}
                      />
                    </Field>
                  </div>

                  {field.type === 'select' ? (
                    <div className="mt-3">
                      <Field label="Options" hint="Comma-separated, e.g. Domestic, International">
                        <input
                          className="shell-input-rect"
                          value={optionsToText(field.options)}
                          onChange={(e) => updateField(index, { options: textToOptions(e.target.value) })}
                        />
                      </Field>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      Required
                    </label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveField(index, -1)} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100" disabled={index === 0}>↑</button>
                      <button type="button" onClick={() => moveField(index, 1)} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100" disabled={index === form.fields.length - 1}>↓</button>
                      <button type="button" onClick={() => removeField(index)} className="rounded px-2 py-1 text-rose-500 hover:bg-rose-50">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {form.fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
                  No fields yet. Add at least a name and phone field.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {!isNew && !form.isDefault ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete the "${form.name}" form? Its link will stop working.`)) {
                    deleteMutation.mutate(selectedId);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <TrashIcon className="h-4 w-4" /> Delete form
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="shell-button-primary px-6 py-3 text-sm font-bold disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : isNew ? 'Create form' : 'Save lead form'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
