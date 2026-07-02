import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import client from '../../api/client';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  ClipboardIcon,
  CheckIcon,
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
  { id: 'adults', label: 'Adults', type: 'number', placeholder: '2', required: false, mapsTo: 'adults' },
  { id: 'children6To12', label: 'Children (6-12 yrs)', type: 'number', placeholder: '0', required: false, mapsTo: 'children6To12' },
  { id: 'childrenBelow5', label: 'Children (below 5 yrs)', type: 'number', placeholder: '0', required: false, mapsTo: 'childrenBelow5' },
  { id: 'budgetPerPerson', label: 'Budget per person (₹)', type: 'number', placeholder: '50000', required: false, mapsTo: 'budgetPerPerson' },
  { id: 'notes', label: 'Anything else?', type: 'textarea', placeholder: 'Tell us about your trip', required: false, mapsTo: 'notes' },
];

const DEFAULTS = {
  enabled: false,
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

export default function SettingsLeadForm() {
  const { agency, updateAgency } = useAuthStore();
  const stored = agency?.leadFormConfig && Array.isArray(agency.leadFormConfig.fields) && agency.leadFormConfig.fields.length
    ? agency.leadFormConfig
    : { ...DEFAULTS, fields: DEFAULT_FIELDS };

  const [form, setForm] = useState({
    enabled: Boolean(stored.enabled),
    title: stored.title || DEFAULTS.title,
    description: stored.description || '',
    successMessage: stored.successMessage || DEFAULTS.successMessage,
    submitLabel: stored.submitLabel || DEFAULTS.submitLabel,
    fields: (stored.fields || []).map((f) => ({ ...f, options: f.options || [] })),
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const agencyKey = agency?.subdomain || agency?.id || '';
  const publicLink = `${window.location.origin}/lead/${agencyKey}`;

  const sourceExamples = useMemo(
    () => [
      { label: 'Instagram', url: `${publicLink}?source=instagram&utm_campaign=bio` },
      { label: 'Facebook', url: `${publicLink}?source=facebook` },
      { label: 'QR code', url: `${publicLink}?source=qr` },
      { label: 'Website', url: `${publicLink}?source=website` },
    ],
    [publicLink]
  );

  const update = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));
  const updateField = (index, patch) =>
    setForm((cur) => ({
      ...cur,
      fields: cur.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
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

  const mutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Lead form saved.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to save lead form');
      setSuccess('');
    },
  });

  const handleSave = () => {
    setError('');
    if (form.enabled) {
      const hasPhone = form.fields.some((f) => f.mapsTo === 'customerPhone');
      if (!hasPhone) {
        setError('Add a field mapped to "Phone" before enabling the form.');
        return;
      }
      if (form.fields.some((f) => !f.label.trim())) {
        setError('Every field needs a label.');
        return;
      }
    }
    const payload = {
      leadFormConfig: {
        enabled: form.enabled,
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
      },
    };
    mutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {/* Header + enable toggle */}
      <div className="shell-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-5 w-5 text-[#2d2d2d]" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Public Lead Form</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                One shareable link for Instagram bio, ads and QR codes. Submissions land in your CRM as leads with full source tracking.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="h-5 w-5 rounded border-neutral-300"
            />
            {form.enabled ? 'Enabled' : 'Disabled'}
          </label>
        </div>

        {/* Public link */}
        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
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
        </div>
      </div>

      {/* Branding / copy */}
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
                  <select
                    className="shell-input-rect"
                    value={field.mapsTo}
                    onChange={(e) => updateField(index, { mapsTo: e.target.value })}
                  >
                    {MAP_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select
                    className="shell-input-rect"
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value })}
                  >
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="shell-button-primary px-6 py-3 text-sm font-bold disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save lead form'}
        </button>
      </div>
    </div>
  );
}
