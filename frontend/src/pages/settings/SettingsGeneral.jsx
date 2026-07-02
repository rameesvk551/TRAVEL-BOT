import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useMutation } from '@tanstack/react-query';
import client from '../../api/client';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function SettingsGeneral() {
  const { agency, updateAgency } = useAuthStore();
  const [form, setForm] = useState({
    name: agency?.name || '',
    phone: agency?.phone || '',
    googleReviewLink: agency?.googleReviewLink || '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => client.patch('/agencies/me', data),
    onSuccess: ({ data: response }) => {
      setSuccess('General settings updated successfully.');
      setError('');
      updateAgency(response.data);
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update settings');
      setSuccess('');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = {};
    if (form.name !== agency?.name) data.name = form.name;
    if (form.phone !== agency?.phone) data.phone = form.phone;
    if (form.googleReviewLink !== agency?.googleReviewLink) data.googleReviewLink = form.googleReviewLink;

    if (Object.keys(data).length === 0) {
      setError('No changes to save.');
      return;
    }

    updateMutation.mutate(data);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="space-y-6">
      {success ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="shell-panel p-6">
        <div className="flex items-center gap-3">
          <BuildingOfficeIcon className="h-5 w-5 text-[#2d2d2d]" />
          <h2 className="text-xl font-extrabold text-slate-950">Agency Information</h2>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="Agency name">
            <input value={form.name} onChange={(event) => update('name', event.target.value)} className="shell-input-rect" />
          </Field>

          <Field label="Agency phone">
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="shell-input-rect" />
          </Field>

          <div className="md:col-span-2">
            <Field label="Google Review Link" hint="Sent by the bot when customers give 4 or 5 star ratings.">
              <input value={form.googleReviewLink} onChange={(event) => update('googleReviewLink', event.target.value)} placeholder="https://g.page/r/your-agency/review" className="shell-input-rect" />
            </Field>
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
