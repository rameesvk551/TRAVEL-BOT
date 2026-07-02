import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyIcon, PlusIcon, TrashIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const SCOPES = [
  ['catalog:read', 'Read catalog', 'Let the website fetch your packages, properties, services, visas and cruises.'],
  ['leads:write', 'Submit leads', 'Let the website send enquiry / “request a quote” forms back to you.'],
];

// Catalog resource -> the sidebar path that controls its public visibility.
const RESOURCE_ROWS = [
  ['packages', '/packages', 'Packages'],
  ['properties', '/properties', 'Properties'],
  ['services', '/services', 'Services'],
  ['visas', '/visas', 'Visas'],
  ['cruises', '/cruises', 'Cruises'],
];

const INDUSTRY_DEFAULTS = {
  TRAVEL: null,
  RESORT: ['/properties', '/packages', '/services'],
  CLEANING: ['/packages', '/services'],
  LAUNDRY: ['/packages', '/services'],
};

// Mirrors backend/src/utils/catalogVisibility.js so the UI shows exactly what the
// public API will expose for this agency.
function isResourceEnabled(agency, path) {
  const prefs = Array.isArray(agency?.sidebarPreferences) ? agency.sidebarPreferences : [];
  if (prefs.length) return prefs.includes(path);
  const defaults = INDUSTRY_DEFAULTS[agency?.industry];
  if (!Array.isArray(defaults)) return true;
  return defaults.includes(path);
}

const PUBLIC_BASE = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/v1`;

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      className="shell-button-secondary px-3 py-2 text-xs"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <ClipboardIcon className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function SettingsApiKeys() {
  const { agency } = useAuthStore();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(['catalog:read', 'leads:write']);
  const [origins, setOrigins] = useState('');
  const [newKey, setNewKey] = useState(null); // shown once after creation
  const [error, setError] = useState('');

  const enabledResources = RESOURCE_ROWS.filter(([, path]) => isResourceEnabled(agency, path));

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await client.get('/api-keys')).data.data,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const allowedOrigins = origins
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean);
      const { data } = await client.post('/api-keys', {
        label: label.trim() || undefined,
        scopes,
        allowedOrigins,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setNewKey(data.key);
      setLabel('');
      setOrigins('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create key'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => client.delete(`/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const toggleScope = (scope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {/* One-time key reveal */}
      {newKey ? (
        <div className="rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-900">Copy your key now — it will not be shown again.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-slate-800 ring-1 ring-amber-200">{newKey}</code>
            <CopyButton value={newKey} />
          </div>
          <button type="button" onClick={() => setNewKey(null)} className="mt-3 text-xs font-semibold text-amber-800 underline">Done</button>
        </div>
      ) : null}

      {/* What this key exposes — driven by the sidebar/visibility config */}
      <div className="shell-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyIcon className="h-5 w-5 text-[#2d2d2d]" />
          <h2 className="text-xl font-extrabold text-slate-950">Website API</h2>
        </div>
        <p className="text-sm text-slate-500">
          Give your website developer a publishable key plus the base URL below. The API exposes only the
          modules enabled in your sidebar, and accepts website enquiries as leads.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">{PUBLIC_BASE}</code>
          <CopyButton value={PUBLIC_BASE} />
        </div>

        <div className="mt-5">
          <p className="eyebrow">Exposed in your public catalog</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCE_ROWS.map(([resource, path, name]) => {
              const on = isResourceEnabled(agency, path);
              return (
                <div key={resource} className={`rounded-[14px] border px-3 py-2 text-sm ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <span className="font-semibold">{name}</span>
                  <span className="ml-2 text-xs">{on ? 'exposed' : 'hidden'}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Control this from <span className="font-semibold text-slate-700">Settings → Sidebar Modules</span>.
            Hidden modules return 404 on the public API.
          </p>
        </div>
      </div>

      {/* Create key */}
      <form
        onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
        className="shell-panel p-6 space-y-5"
      >
        <h3 className="text-sm font-semibold text-slate-800">Create a new key</h3>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="Production website"
            className="shell-input-rect"
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-semibold text-slate-700">Permissions</span>
          <div className="space-y-2">
            {SCOPES.map(([value, name, hint]) => (
              <label key={value} className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={scopes.includes(value)} onChange={() => toggleScope(value)} className="mt-1" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{name}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Allowed website origins <span className="font-normal text-slate-400">(optional)</span></span>
          <textarea
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            rows={2}
            placeholder="https://www.myagency.com"
            className="shell-input-rect"
          />
          <p className="mt-2 text-xs text-slate-500">One per line. Leave blank to allow any site. Locks browser use to these domains.</p>
        </label>

        <div className="flex justify-end">
          <button type="submit" disabled={createMutation.isPending || scopes.length === 0} className="shell-button">
            <PlusIcon className="h-4 w-4" />
            {createMutation.isPending ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </form>

      {/* Existing keys */}
      <div className="shell-panel p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Your keys</h3>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            No keys yet. Create one above to connect your website.
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{key.label || 'Untitled key'}</p>
                      {key.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Active</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Revoked</span>
                      )}
                    </div>
                    <code className="mt-1 block text-xs text-slate-500">{key.keyPrefix}</code>
                    <p className="mt-1 text-xs text-slate-400">
                      {(key.scopes || []).join(', ')} · {Number(key.requestCount || 0)} requests
                      {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                    </p>
                  </div>
                  {key.isActive ? (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('Revoke this key? Any website using it will stop working immediately.')) revokeMutation.mutate(key.id); }}
                      disabled={revokeMutation.isPending}
                      className="shell-button-secondary px-3 py-2 text-xs text-rose-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
