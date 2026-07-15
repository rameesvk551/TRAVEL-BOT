import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { getWebsiteStatus, publishWebsite, unpublishWebsite, updateWebsiteSettings } from '../api/websiteApi';
import { useAuthStore } from '../store/authStore';

// Curated catalog themes. Your brand color tints the accent, so every theme
// still feels like yours. Ids match the backend catalog theme presets.
const WEBSITE_TEMPLATES = [
  { id: 'aurora', name: 'Aurora', description: 'Airy ivory and soft light. Friendly and premium — a safe default for most agencies.', swatch: '#EFEBE3' },
  { id: 'midnight', name: 'Midnight', description: 'Cinematic dark with glass panels. Ideal for luxury stays and resorts.', swatch: '#14181D' },
  { id: 'coast', name: 'Coast', description: 'Warm sand and calm greens. Relaxed and coastal for beach and leisure travel.', swatch: '#E7DFCF' },
  { id: 'terra', name: 'Terra', description: 'Editorial, warm paper, sharp edges. Modern and bold for adventure and active trips.', swatch: '#E3D8C8' },
];

function templateById(id) {
  return WEBSITE_TEMPLATES.find((template) => template.id === id) || WEBSITE_TEMPLATES[0];
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-neutral-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs leading-5 text-neutral-500">{hint}</p> : null}
    </label>
  );
}

function cleanForm(data) {
  return {
    subdomain: data?.subdomain || '',
    customDomain: data?.customDomain || '',
    websiteTheme: data?.websiteTheme || 'aurora',
    websiteTitle: data?.websiteTitle || '',
    websiteDescription: data?.websiteDescription || '',
    websiteLogoUrl: data?.websiteLogoUrl || '',
    websitePrimaryColor: data?.websitePrimaryColor || '#00A884',
    websiteHeroImageUrl: data?.websiteHeroImageUrl || '',
    websiteContactPhone: data?.websiteContactPhone || '',
    websiteContactEmail: data?.websiteContactEmail || '',
    websiteCustomCss: data?.websiteCustomCss || '',
    websiteSeoMeta: {
      title: data?.websiteSeoMeta?.title || '',
      description: data?.websiteSeoMeta?.description || '',
      keywords: data?.websiteSeoMeta?.keywords || '',
    },
    websiteSocialLinks: {
      instagram: data?.websiteSocialLinks?.instagram || '',
      facebook: data?.websiteSocialLinks?.facebook || '',
      youtube: data?.websiteSocialLinks?.youtube || '',
    },
  };
}

export default function WebsiteBuilder() {
  const qc = useQueryClient();
  const updateAgency = useAuthStore((state) => state.updateAgency);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const websiteQuery = useQuery({
    queryKey: ['agency-website'],
    queryFn: getWebsiteStatus,
  });

  useEffect(() => {
    if (!websiteQuery.data || form) return;
    setForm(cleanForm(websiteQuery.data));
  }, [websiteQuery.data, form]);

  const publicUrl = useMemo(() => {
    const data = websiteQuery.data;
    if (!data) return '';
    if (data.customDomain) return `https://${data.customDomain}`;
    if (data.subdomain && data.publicRootDomain) return `https://${data.subdomain}.${data.publicRootDomain}`;
    return data.previewPath || '';
  }, [websiteQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateWebsiteSettings,
    onSuccess: (data) => {
      qc.setQueryData(['agency-website'], data);
      updateAgency(data);
      setNotice('Website settings saved.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to save website settings');
      setNotice('');
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishWebsite,
    onSuccess: (data) => {
      qc.setQueryData(['agency-website'], data);
      updateAgency(data);
      setNotice('Website generated and published.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to publish website');
      setNotice('');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: unpublishWebsite,
    onSuccess: (data) => {
      qc.setQueryData(['agency-website'], data);
      updateAgency(data);
      setNotice('Website unpublished.');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to unpublish website');
      setNotice('');
    },
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateNested = (group, key, value) => setForm((current) => ({
    ...current,
    [group]: { ...(current[group] || {}), [key]: value },
  }));

  const handleSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate(form);
  };

  if (websiteQuery.isLoading || !form) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  const status = websiteQuery.data;
  const publishBusy = publishMutation.isPending || unpublishMutation.isPending;
  const selectedTemplate = templateById(form.websiteTheme);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Catalog Mini-Site</p>
          <h1 className="page-heading mt-2">Your public catalog site</h1>
          <p className="page-subtext mt-2">A branded, always-live mini-website showing your services, packages, stays, visas and cruises — with per-item pages, WhatsApp enquiries and a shareable digital card. No rebuild step; it updates as your catalog changes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicUrl ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="shell-button-secondary">
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View site
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => status.websiteEnabled ? unpublishMutation.mutate() : publishMutation.mutate()}
            disabled={publishBusy}
            className="shell-button-primary"
          >
            <RocketLaunchIcon className="h-4 w-4" />
            {status.websiteEnabled ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {notice ? <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <section className="shell-panel p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subdomain" hint={status.publicRootDomain ? `Example: ${form.subdomain || 'agency'}.${status.publicRootDomain}` : 'Set PUBLIC_SITE_ROOT_DOMAIN to enable platform subdomains.'}>
              <input className="shell-input-rect" value={form.subdomain} onChange={(event) => update('subdomain', event.target.value)} placeholder="my-agency" />
            </Field>
            <Field label="Customer domain" hint="The customer points this domain to your VPS IP. Example: www.myagency.com">
              <input className="shell-input-rect" value={form.customDomain} onChange={(event) => update('customDomain', event.target.value)} placeholder="www.example.com" />
            </Field>
            <Field label="Website title">
              <input className="shell-input-rect" value={form.websiteTitle} onChange={(event) => update('websiteTitle', event.target.value)} placeholder="Agency name" />
            </Field>
            <Field label="Template">
              <select className="shell-input-rect" value={form.websiteTheme} onChange={(event) => update('websiteTheme', event.target.value)}>
                {WEBSITE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{selectedTemplate.description}</p>
            </Field>
            <Field label="Primary color">
              <input className="shell-input-rect h-12" type="color" value={form.websitePrimaryColor || '#00A884'} onChange={(event) => update('websitePrimaryColor', event.target.value)} />
            </Field>
            <Field label="Logo URL">
              <input className="shell-input-rect" value={form.websiteLogoUrl} onChange={(event) => update('websiteLogoUrl', event.target.value)} placeholder="https://..." />
            </Field>
            <div className="md:col-span-2">
              <Field label="Hero image URL">
                <input className="shell-input-rect" value={form.websiteHeroImageUrl} onChange={(event) => update('websiteHeroImageUrl', event.target.value)} placeholder="https://..." />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Description">
                <textarea className="shell-input-rect min-h-28" value={form.websiteDescription} onChange={(event) => update('websiteDescription', event.target.value)} placeholder="Describe the agency and its travel services." />
              </Field>
            </div>
            <Field label="Contact phone">
              <input className="shell-input-rect" value={form.websiteContactPhone} onChange={(event) => update('websiteContactPhone', event.target.value)} />
            </Field>
            <Field label="Contact email">
              <input className="shell-input-rect" value={form.websiteContactEmail} onChange={(event) => update('websiteContactEmail', event.target.value)} />
            </Field>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-5">
            <h2 className="text-sm font-bold text-neutral-900">Choose a website template</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {WEBSITE_TEMPLATES.map((template) => {
                const active = form.websiteTheme === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => update('websiteTheme', template.id)}
                    className={`rounded-[var(--radius-md)] border p-4 text-left transition ${active ? 'border-neutral-900 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400'}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full border border-white/40" style={{ backgroundColor: template.swatch }} />
                      <span className="text-sm font-black">{template.name}</span>
                    </span>
                    <span className={`mt-2 block text-xs leading-5 ${active ? 'text-white/70' : 'text-neutral-500'}`}>{template.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-5">
            <div className="flex items-center gap-2">
              <CodeBracketIcon className="h-4 w-4 text-neutral-500" />
              <h2 className="text-sm font-bold text-neutral-900">SEO and advanced CSS</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="SEO title">
                <input className="shell-input-rect" value={form.websiteSeoMeta.title} onChange={(event) => updateNested('websiteSeoMeta', 'title', event.target.value)} />
              </Field>
              <Field label="SEO keywords">
                <input className="shell-input-rect" value={form.websiteSeoMeta.keywords} onChange={(event) => updateNested('websiteSeoMeta', 'keywords', event.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="SEO description">
                  <textarea className="shell-input-rect min-h-20" value={form.websiteSeoMeta.description} onChange={(event) => updateNested('websiteSeoMeta', 'description', event.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Custom CSS" hint="Optional. Keep this for small brand tweaks.">
                  <textarea className="shell-input-rect min-h-28 font-mono text-xs" value={form.websiteCustomCss} onChange={(event) => update('websiteCustomCss', event.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="shell-button-primary mt-6 w-full md:w-auto">
            {saveMutation.isPending ? 'Saving...' : 'Save settings'}
          </button>
        </section>

        <aside className="space-y-6">
          <section className="shell-panel p-5">
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="h-5 w-5 text-neutral-700" />
              <h2 className="text-lg font-bold text-neutral-950">Publish status</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-4">
                <p className="eyebrow">Catalog site</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <CheckCircleIcon className={`h-4 w-4 ${status.websiteEnabled ? 'text-emerald-600' : 'text-neutral-400'}`} />
                  {status.websiteEnabled ? 'Published' : 'Draft'}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-4">
                <p className="eyebrow">Add-on</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <CheckCircleIcon className={`h-4 w-4 ${status.catalogEnabled ? 'text-emerald-600' : 'text-neutral-400'}`} />
                  {status.catalogEnabled ? 'Enabled' : 'Not enabled'}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {status.catalogEnabled
                    ? 'The Catalog Mini-Site add-on is active on your account.'
                    : 'Your public site won’t load until this add-on is enabled. Contact your provider to switch it on.'}
                </p>
              </div>
              {publicUrl ? (
                <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-4">
                  <p className="eyebrow">Public link</p>
                  <p className="mt-2 break-all text-sm font-bold text-neutral-900">{publicUrl}</p>
                </div>
              ) : null}
              <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 p-4">
                <p className="eyebrow">Custom domain</p>
                <p className="mt-2 text-sm text-neutral-600">To use your own domain, add an A record pointing it to your server IP, save it above, then publish. Your subdomain link works right away.</p>
              </div>
            </div>
          </section>

          <section className="shell-panel overflow-hidden">
            <div className="h-36 bg-neutral-900" style={{ backgroundColor: form.websitePrimaryColor || '#00A884' }}>
              {form.websiteHeroImageUrl ? <img src={form.websiteHeroImageUrl} alt="" className="h-full w-full object-cover opacity-80" /> : null}
            </div>
            <div className="p-5">
              <p className="eyebrow">Preview</p>
              <p className="mt-2 text-xs font-bold text-neutral-500">{selectedTemplate.name}</p>
              <h3 className="mt-2 text-xl font-black text-neutral-950">{form.websiteTitle || 'Agency website'}</h3>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-neutral-600">{form.websiteDescription || 'Your public packages and properties will appear here.'}</p>
            </div>
          </section>
        </aside>
      </form>
    </div>
  );
}
