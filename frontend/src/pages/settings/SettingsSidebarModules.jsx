import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation } from '@tanstack/react-query';
import client from '../../api/client';
import { SquaresPlusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const MENU_ITEM_TYPES = [
  ['PACKAGE_CATEGORY', 'Package category'],
  ['PROPERTY', 'Property / resort'],
  ['SERVICE', 'Booking service'],
  ['CUSTOM_TRIP', 'Custom trip form'],
];

const SAMPLE_MENU_CONFIG = [
  { id: 'college_packages', title: 'College Packages', description: 'Tours for students', type: 'PACKAGE_CATEGORY', value: 'COLLEGE' },
  { id: 'family_packages', title: 'Family Packages', description: 'Family-friendly trips', type: 'PACKAGE_CATEGORY', value: 'FAMILY' },
  { id: 'couple_packages', title: 'Couple Packages', description: 'Honeymoon and couples', type: 'PACKAGE_CATEGORY', value: 'COUPLE' },
  { id: 'budget_packages', title: 'Budget Packages', description: 'Affordable packages', type: 'PACKAGE_CATEGORY', value: 'BUDGET' },
  { id: 'resorts', title: 'Resorts', description: 'Stays and properties', type: 'PROPERTY', value: 'Resort' },
  { id: 'train_booking', title: 'Train Booking', description: 'Rail ticket enquiries', type: 'SERVICE', value: 'TRAIN' },
  { id: 'bus_booking', title: 'Bus Booking', description: 'Bus ticket enquiries', type: 'SERVICE', value: 'BUS' },
];

const FLOW_ACTION_TYPES = [
  ['OPEN_PACKAGE_CATEGORY_MENU', 'Open package categories'],
  ['OPEN_PROPERTY_FLOW', 'Open properties flow'],
  ['OPEN_SERVICE_MENU', 'Open services menu'],
  ['OPEN_CUSTOM_TRIP_FLOW', 'Open custom trip form'],
  ['SHOW_TOUR_TYPE_LIST', 'Show tour type list'],
  ['OPEN_PACKAGE_FLOW', 'Open package flow'],
  ['CAPTURE_SERVICE_DETAILS', 'Capture service details'],
];

const FLOW_SECTIONS = [
  ['welcomeMenu', 'First message menu', 'The first options a WhatsApp user sees. Use up to 3 for buttons; more becomes a list.', 10],
  ['packageCategories', 'Package category buttons', 'Shown after user taps packages. Keep this to 3 WhatsApp buttons.', 3],
  ['tourTypes', 'Tour type list', 'Shown after Domestic or International, then opens filtered packages.', 10],
  ['serviceMenu', 'Service list', 'Shown after user taps Services, then captures service details.', 10],
];

const SAMPLE_FLOW_CONFIG = {
  welcomeMenu: [
    { id: 'show_packages', title: 'Show Packages', description: 'Domestic and international trips', action: 'OPEN_PACKAGE_CATEGORY_MENU' },
    { id: 'show_properties', title: 'Show Properties', description: 'Resorts and stays', action: 'OPEN_PROPERTY_FLOW' },
    { id: 'services', title: 'Services', description: 'Train, bus, visa and more', action: 'OPEN_SERVICE_MENU' },
  ],
  packageCategories: [
    { id: 'custom_packages', title: 'Custom', description: 'Build a custom trip', action: 'OPEN_CUSTOM_TRIP_FLOW' },
    { id: 'domestic_packages', title: 'Domestic', description: 'India packages', action: 'SHOW_TOUR_TYPE_LIST', category: 'DOMESTIC' },
    { id: 'international_packages', title: 'International', description: 'Abroad packages', action: 'SHOW_TOUR_TYPE_LIST', category: 'INTERNATIONAL' },
  ],
  tourTypes: [
    { id: 'couple_tours', title: 'Couple', description: 'Couple and honeymoon packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'COUPLE' },
    { id: 'family_tours', title: 'Family', description: 'Family packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'FAMILY' },
    { id: 'budget_tours', title: 'Budget', description: 'Affordable packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'BUDGET' },
    { id: 'college_tours', title: 'College', description: 'Student and group packages', action: 'OPEN_PACKAGE_FLOW', tourType: 'COLLEGE' },
  ],
  serviceMenu: [
    { id: 'train_booking', title: 'Train Booking', description: 'Rail ticket enquiry', action: 'CAPTURE_SERVICE_DETAILS', value: 'TRAIN' },
    { id: 'bus_booking', title: 'Bus Booking', description: 'Bus ticket enquiry', action: 'CAPTURE_SERVICE_DETAILS', value: 'BUS' },
    { id: 'visa_ticketing', title: 'Visa & Ticketing', description: 'Visa, flights and ticketing', action: 'CAPTURE_SERVICE_DETAILS', value: 'VISA_TICKETING' },
  ],
};

function toMenuId(value, fallback) {
  return String(value || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function normalizeMenuConfig(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .map((item, index) => {
      const type = String(item?.type || 'PACKAGE_CATEGORY').toUpperCase();
      const title = String(item?.title || '').trim().slice(0, 24);
      if (!title || !MENU_ITEM_TYPES.some(([value]) => value === type)) return null;
      const value = String(item?.value || '').trim().slice(0, 80);
      const id = toMenuId(item?.id, `${type}_${value || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return { id, title, description: String(item?.description || '').trim().slice(0, 72), type, value };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeFlowValue(value, limit = 80) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, limit);
}

function normalizeFlowItems(items = [], limit = 10) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .map((item, index) => {
      const action = String(item?.action || '').trim().toUpperCase();
      const title = String(item?.title || '').trim().slice(0, 24);
      if (!title || !FLOW_ACTION_TYPES.some(([value]) => value === action)) return null;
      const category = normalizeFlowValue(item?.category, 32);
      const tourType = normalizeFlowValue(item?.tourType || item?.value, 80);
      const id = toMenuId(item?.id, `${action}_${category || tourType || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id, title, description: String(item?.description || '').trim().slice(0, 72), action,
        ...(category ? { category } : {}),
        ...(tourType ? { tourType, value: tourType } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeFlowConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  return Object.fromEntries(
    FLOW_SECTIONS
      .map(([key,, , limit]) => [key, normalizeFlowItems(config[key], limit)])
      .filter(([, items]) => items.length > 0)
  );
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

export default function SettingsSidebarModules() {
  const { agency, updateAgency } = useAuthStore();
  const [form, setForm] = useState({
    whatsappMenuConfig: normalizeMenuConfig(agency?.whatsappMenuConfig || []),
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('Sidebar modules updated successfully.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update modules');
      setSuccess('');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    const menuConfigPayload = normalizeMenuConfig(form.whatsappMenuConfig);
    const currentMenuConfigPayload = normalizeMenuConfig(agency?.whatsappMenuConfig || []);
    if (JSON.stringify(menuConfigPayload) !== JSON.stringify(currentMenuConfigPayload)) {
      data.whatsappMenuConfig = menuConfigPayload;
    }

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const updateMenuItem = (index, field, value) => setForm((current) => {
    const items = [...current.whatsappMenuConfig];
    const currentItem = items[index] || { type: 'PACKAGE_CATEGORY' };
    const nextItem = {
      ...currentItem,
      [field]: field === 'title' ? value.slice(0, 24) : field === 'description' ? value.slice(0, 72) : value.slice(0, 80),
    };
    if (field === 'title' && !currentItem.id) {
      nextItem.id = toMenuId(value, `menu_${index + 1}`);
    }
    if (field === 'type' && value === 'CUSTOM_TRIP') {
      nextItem.value = '';
    }
    items[index] = nextItem;
    return { ...current, whatsappMenuConfig: items };
  });

  const addMenuItem = () => setForm((current) => ({
    ...current,
    whatsappMenuConfig: [
      ...current.whatsappMenuConfig,
      { id: '', title: '', description: '', type: 'PACKAGE_CATEGORY', value: '' },
    ].slice(0, 10),
  }));

  const removeMenuItem = (index) => setForm((current) => ({
    ...current,
    whatsappMenuConfig: current.whatsappMenuConfig.filter((_, itemIndex) => itemIndex !== index),
  }));

  const loadSampleMenuConfig = () => update('whatsappMenuConfig', SAMPLE_MENU_CONFIG);
  const clearMenuConfig = () => update('whatsappMenuConfig', []);

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="shell-panel p-6">
        <div className="flex items-center gap-3 mb-8">
          <SquaresPlusIcon className="h-5 w-5 text-[#2d2d2d]" />
          <h2 className="text-xl font-extrabold text-slate-950">Sidebar Modules & Custom Bot Flows</h2>
        </div>

        {/* Custom menu actions section */}
        <div className="border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Custom menu actions</h4>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                Add rows here only for agencies that need their own welcome flow. Empty means the default 3-button flow stays active.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={loadSampleMenuConfig} className="shell-button-secondary px-3 py-2 text-xs">Use travel sample</button>
              <button type="button" onClick={addMenuItem} disabled={form.whatsappMenuConfig.length >= 10} className="shell-button-secondary px-3 py-2 text-xs">
                <PlusIcon className="h-4 w-4" />
                Add action
              </button>
              <button type="button" onClick={clearMenuConfig} className="shell-button-secondary px-3 py-2 text-xs">Clear</button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {form.whatsappMenuConfig.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                No custom actions mapped. This agency will use the default Visa, Plan a Trip, and Staycations menu.
              </div>
            ) : form.whatsappMenuConfig.map((item, index) => (
              <div key={`${item.id || 'menu'}-${index}`} className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                  <Field label="WhatsApp title">
                    <input
                      value={item.title || ''}
                      onChange={(event) => updateMenuItem(index, 'title', event.target.value)}
                      maxLength={24}
                      placeholder="College Packages"
                      className="shell-input-rect"
                    />
                  </Field>

                  <Field label="Action">
                    <select
                      value={item.type || 'PACKAGE_CATEGORY'}
                      onChange={(event) => updateMenuItem(index, 'type', event.target.value)}
                      className="shell-input-rect"
                    >
                      {MENU_ITEM_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Map value"
                    hint={
                      item.type === 'PACKAGE_CATEGORY' ? 'Package category, e.g. COLLEGE'
                        : item.type === 'SERVICE' ? 'Service key, e.g. TRAIN'
                        : item.type === 'PROPERTY' ? 'Property type, e.g. Resort'
                        : 'Not needed'
                    }
                  >
                    <input
                      value={item.value || ''}
                      onChange={(event) => updateMenuItem(index, 'value', event.target.value)}
                      disabled={item.type === 'CUSTOM_TRIP'}
                      className="shell-input-rect disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </Field>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeMenuItem(index)}
                      className="shell-button-secondary h-[46px] px-3 text-rose-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <Field label="Description">
                    <input
                      value={item.description || ''}
                      onChange={(event) => updateMenuItem(index, 'description', event.target.value)}
                      maxLength={72}
                      className="shell-input-rect"
                    />
                  </Field>
                  <Field label="Action ID">
                    <input
                      value={item.id || ''}
                      onChange={(event) => updateMenuItem(index, 'id', event.target.value)}
                      maxLength={80}
                      className="shell-input-rect"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          {form.whatsappMenuConfig.length > 0 ? (
            <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="eyebrow">Mapped Preview</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {normalizeMenuConfig(form.whatsappMenuConfig).map((item) => (
                  <div key={item.id} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.type.replace(/_/g, ' ')}{item.value ? ` -> ${item.value}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Custom WhatsApp response flows now live in <span className="font-semibold text-slate-900">Settings / Flow Builder</span>.
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
