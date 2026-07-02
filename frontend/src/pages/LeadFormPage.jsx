// FILE: /frontend/src/pages/LeadFormPage.jsx
// Public, unauthenticated lead-capture form. Shareable in Instagram bios / ads via
// /lead/:agencyKey?source=instagram. Talks to the /public/:agencyKey/lead-form
// endpoints directly (NOT the auth client, which redirects to /login on 401).

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const PUBLIC_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api\/?$/, '') || '';

const publicClient = axios.create({
  baseURL: `${PUBLIC_BASE}/public`,
  headers: { 'Content-Type': 'application/json' },
});

function FieldInput({ field, value, onChange, accent }) {
  const base =
    'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-900 ' +
    'outline-none transition focus:border-transparent focus:ring-2';
  const ringStyle = { '--tw-ring-color': accent };

  if (field.type === 'textarea') {
    return (
      <textarea
        className={`${base} min-h-[110px] resize-y`}
        style={ringStyle}
        rows={4}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={base}
        style={ringStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">Select…</option>
        {(field.options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  const typeMap = { phone: 'tel', email: 'email', number: 'number', date: 'date' };
  return (
    <input
      type={typeMap[field.type] || 'text'}
      inputMode={field.type === 'number' ? 'numeric' : field.type === 'phone' ? 'tel' : undefined}
      className={base}
      style={ringStyle}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      min={field.type === 'number' ? 0 : undefined}
    />
  );
}

export default function LeadFormPage() {
  const { agencyKey } = useParams();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState({});
  const [company, setCompany] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const tracking = useMemo(() => {
    const get = (k) => searchParams.get(k) || '';
    return {
      source: get('source'),
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign'),
      utm_content: get('utm_content'),
      utm_term: get('utm_term'),
    };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    publicClient
      .get(`/${encodeURIComponent(agencyKey)}/lead-form`)
      .then(({ data }) => {
        if (!active) return;
        setConfig(data.data);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err.response?.data?.error || 'This form is not available.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [agencyKey]);

  const accent = config?.branding?.primaryColor || '#00A884';

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await publicClient.post(`/${encodeURIComponent(agencyKey)}/lead-form`, {
        answers,
        company,
        ...tracking,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </div>
    );
  }

  if (loadError || !config || !config.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-neutral-900">Form unavailable</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {loadError || 'This enquiry form is not currently accepting submissions.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-0 sm:py-8">
      <div className="mx-auto w-full max-w-md bg-white sm:rounded-3xl sm:shadow-xl sm:overflow-hidden">
        {/* Branded header */}
        <div
          className="relative px-6 pt-10 pb-12 text-white"
          style={{
            background: config.branding?.heroImageUrl
              ? `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55)), url(${config.branding.heroImageUrl}) center/cover`
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          }}
        >
          {config.branding?.logoUrl ? (
            <img
              src={config.branding.logoUrl}
              alt={config.agencyName}
              className="mb-4 h-12 w-12 rounded-full bg-white/90 object-contain p-1"
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{config.agencyName}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{config.title}</h1>
          {config.description ? (
            <p className="mt-2 text-sm text-white/90">{config.description}</p>
          ) : null}
        </div>

        {submitted ? (
          <div className="px-6 py-14 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-neutral-900">Enquiry sent</h2>
            <p className="mt-2 text-sm text-neutral-500">{config.successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-7">
            {config.fields.map((field) => (
              <label key={field.id} className="block">
                <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
                  {field.label}
                  {field.required ? <span className="ml-0.5 text-rose-500">*</span> : null}
                </span>
                <FieldInput
                  field={field}
                  value={answers[field.id] || ''}
                  onChange={(v) => setAnswer(field.id, v)}
                  accent={accent}
                />
              </label>
            ))}

            {/* Honeypot — visually hidden, off-screen; real users never fill it. */}
            <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
              <label>
                Company
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
            </div>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl px-4 py-3.5 text-[15px] font-bold text-white shadow-sm transition disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {submitting ? 'Sending…' : config.submitLabel}
            </button>
            <p className="pt-1 text-center text-[11px] text-neutral-400">
              Your details are shared only with {config.agencyName}.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
