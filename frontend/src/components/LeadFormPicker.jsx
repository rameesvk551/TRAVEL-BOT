import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { leadFormsApi } from '../api/leadFormsApi';

/**
 * Picks which of the agency's named lead forms a button opens (the OPEN_LEAD_FORM
 * action). Nothing about the button is hardcoded — the agency chooses the button,
 * the action and the form; at send time the tapped card's catalog item is appended
 * to the link so the created lead is bound to that property/package.
 */
export default function LeadFormPicker({ value, onChange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-forms'],
    queryFn: leadFormsApi.list,
  });
  const forms = data?.data || [];
  const selected = useMemo(() => forms.find((f) => f.id === value) || null, [forms, value]);

  return (
    <div className="space-y-2">
      <select
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value || null)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      >
        <option value="">{isLoading ? 'Loading forms…' : 'Use the default lead form'}</option>
        {forms.map((form) => (
          <option key={form.id} value={form.id}>
            {form.name}{form.enabled ? '' : ' — disabled'}
          </option>
        ))}
      </select>

      {selected && !selected.enabled ? (
        <p className="text-[11px] font-semibold text-amber-600">
          “{selected.name}” is disabled — enable it or this button won’t open.
        </p>
      ) : null}

      <p className="text-[11px] text-slate-500">
        The tapped card’s item is added to the link automatically, so the lead is linked to that property.{' '}
        <Link to="/settings/lead-form" className="font-semibold underline">Manage lead forms</Link>
      </p>
    </div>
  );
}
