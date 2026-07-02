import { useState, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation } from '@tanstack/react-query';
import client from '../../api/client';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

const DEFAULT_WELCOME_MESSAGE = [
  'Hi {customerName}',
  'Welcome to {agencyName}',
  'Tell us what you want to explore today.',
  '',
  'How can I help you today?',
].join('\n');

const DEFAULT_WHATSAPP_MENU_LABELS = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Plan a Trip',
  staycations: 'Staycations',
  flight: 'Flight',
  rail: 'Rail',
  domestic: 'Domestic',
  international: 'International',
  customTrip: 'Custom Trip',
};

const MENU_LABEL_FIELDS = [
  ['visaTicketing', 'Welcome: Visa & Ticketing'],
  ['planTrip', 'Welcome: Plan a Trip'],
  ['staycations', 'Welcome: Staycations'],
  ['flight', 'Visa submenu: Flight'],
  ['rail', 'Visa submenu: Rail'],
  ['international', 'Trip submenu: International'],
  ['domestic', 'Trip submenu: Domestic'],
  ['customTrip', 'Trip submenu: Custom Trip'],
];

function getMenuLabels(overrides = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_MENU_LABELS).map(([key, fallback]) => [
      key,
      String(overrides?.[key] || fallback).slice(0, 20),
    ])
  );
}

function getMenuLabelPayload(labels = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_MENU_LABELS)
      .map(([key, fallback]) => [key, String(labels?.[key] || '').trim().slice(0, 20), fallback])
      .filter(([, value, fallback]) => value && value !== fallback)
      .map(([key, value]) => [key, value])
  );
}

function renderWelcomePreview(message, agencyName) {
  return String(message || DEFAULT_WELCOME_MESSAGE)
    .replace(/\{customerName\}/g, 'Ravi')
    .replace(/\{agencyName\}/g, agencyName || 'Your Agency');
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

export default function SettingsWelcomeMenu() {
  const { agency, updateAgency } = useAuthStore();
  const [form, setForm] = useState({
    welcomeMessage: agency?.welcomeMessage || '',
    whatsappMenuLabels: getMenuLabels(agency?.whatsappMenuLabels || {}),
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Welcome menu updated successfully.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update welcome menu');
      setSuccess('');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    const welcomeMessage = form.welcomeMessage.trim();
    if (welcomeMessage !== (agency?.welcomeMessage || '')) data.welcomeMessage = welcomeMessage || null;
    
    const menuLabelPayload = getMenuLabelPayload(form.whatsappMenuLabels);
    const currentMenuLabelPayload = getMenuLabelPayload(getMenuLabels(agency?.whatsappMenuLabels || {}));
    if (JSON.stringify(menuLabelPayload) !== JSON.stringify(currentMenuLabelPayload)) {
      data.whatsappMenuLabels = menuLabelPayload;
    }

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateMenuLabel = (field, value) => setForm((current) => ({
    ...current,
    whatsappMenuLabels: {
      ...current.whatsappMenuLabels,
      [field]: value.slice(0, 20),
    },
  }));

  const resetWelcomeMessage = () => update('welcomeMessage', '');
  const resetMenuLabels = () => update('whatsappMenuLabels', getMenuLabels({}));

  const welcomePreview = useMemo(
    () => renderWelcomePreview(form.welcomeMessage, agency?.name),
    [form.welcomeMessage, agency?.name]
  );

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="shell-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-[#2d2d2d]" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">WhatsApp Welcome Menu</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">Customize the greeting and button names. The actions stay fixed so each button still opens the correct bot flow.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetWelcomeMessage} className="shell-button-secondary px-3 py-2 text-xs">Reset message</button>
            <button type="button" onClick={resetMenuLabels} className="shell-button-secondary px-3 py-2 text-xs">Reset labels</button>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Field label="Welcome message" hint="Use {customerName} and {agencyName}. Leave blank to use the default message.">
              <textarea
                value={form.welcomeMessage}
                onChange={(event) => update('welcomeMessage', event.target.value)}
                rows={6}
                maxLength={900}
                placeholder={DEFAULT_WELCOME_MESSAGE}
                className="shell-input-rect min-h-[150px] resize-y"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              {MENU_LABEL_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    value={form.whatsappMenuLabels[key] || ''}
                    onChange={(event) => updateMenuLabel(key, event.target.value)}
                    maxLength={20}
                    className="shell-input-rect"
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-slate-50/50 p-5 sticky top-6">
            <p className="eyebrow">Preview</p>
            <div className="mt-4 whitespace-pre-line rounded-[18px] bg-slate-100 px-4 py-4 text-sm leading-6 text-slate-800">
              {welcomePreview}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {[
                form.whatsappMenuLabels.visaTicketing,
                form.whatsappMenuLabels.planTrip,
                form.whatsappMenuLabels.staycations,
              ].map((label, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center rounded-[20px] bg-white px-4 py-2.5 text-sm font-semibold text-[#00A884] shadow-sm border border-slate-100"
                >
                  {label || 'Menu Option'}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={updateMutation.isPending} className="shell-button">
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
