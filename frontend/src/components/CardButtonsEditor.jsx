import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { leadFormsApi } from '../api/leadFormsApi';

/**
 * Edits the buttons shown on EACH catalog card (Instagram generic-template cards allow up to 3).
 * Every button is a link:
 *   LEAD_FORM — opens one of the agency's lead forms with THIS card's item attached, so the
 *               lead that comes out of the form is bound to that exact property/package.
 *   WHATSAPP  — wa.me click-to-chat, prefilled with the item.
 *   URL       — any static link.
 * Nothing is hardcoded: the agency picks the label, the action and (for LEAD_FORM) the form.
 */
const ACTIONS = [
  { value: 'LEAD_FORM', label: 'Open a lead form' },
  { value: 'WHATSAPP', label: 'Chat on WhatsApp' },
  { value: 'URL', label: 'Open a link' },
];

const MAX_BUTTONS = 3;

export default function CardButtonsEditor({ buttons, onChange }) {
  const list = Array.isArray(buttons) ? buttons : [];

  const { data } = useQuery({ queryKey: ['lead-forms'], queryFn: leadFormsApi.list });
  const forms = data?.data || [];

  const patch = (index, updates) =>
    onChange(list.map((btn, i) => (i === index ? { ...btn, ...updates } : btn)));

  const add = () =>
    onChange([
      ...list,
      { id: `card_btn_${list.length + 1}`, label: '', action: 'LEAD_FORM', leadFormId: null },
    ]);

  const remove = (index) => onChange(list.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Buttons on each card</span>
        {list.length < MAX_BUTTONS ? (
          <button
            type="button"
            onClick={add}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
          >
            + Add button
          </button>
        ) : null}
      </div>

      {!list.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
          No buttons configured — each card falls back to the single “WhatsApp button” label above.
          Add a button to put e.g. <b>Check Availability</b> + <b>WhatsApp</b> on every card.
        </p>
      ) : null}

      {list.map((btn, index) => {
        const action = String(btn.action || 'WHATSAPP').toUpperCase();
        const selectedForm = forms.find((f) => f.id === btn.leadFormId);
        return (
          <div key={btn.id || index} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <input
                value={btn.label || ''}
                maxLength={20}
                placeholder="Check Availability"
                onChange={(event) => patch(index, { label: event.target.value.slice(0, 20) })}
                className="shell-input-rect flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Remove
              </button>
            </div>

            <select
              value={action}
              onChange={(event) => patch(index, { action: event.target.value })}
              className="shell-input-rect w-full bg-white text-sm"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            {action === 'LEAD_FORM' ? (
              <>
                <select
                  value={btn.leadFormId || ''}
                  onChange={(event) => patch(index, { leadFormId: event.target.value || null })}
                  className="shell-input-rect w-full bg-white text-sm"
                >
                  <option value="">Use the default lead form</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}{form.enabled ? '' : ' — disabled'}
                    </option>
                  ))}
                </select>
                {selectedForm && !selectedForm.enabled ? (
                  <p className="text-[11px] font-semibold text-amber-600">
                    “{selectedForm.name}” is disabled — this button is skipped until you enable it.
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-500">
                  Opens the form with this card’s item attached, so the lead is linked to that property.{' '}
                  <Link to="/settings/lead-form" className="font-semibold underline">Manage forms</Link>
                </p>
              </>
            ) : null}

            {action === 'URL' ? (
              <input
                type="url"
                value={btn.url || ''}
                placeholder="https://example.com"
                onChange={(event) => patch(index, { url: event.target.value.slice(0, 500) })}
                className="shell-input-rect w-full text-sm"
              />
            ) : null}

            {action === 'WHATSAPP' ? (
              <p className="text-[11px] text-slate-500">
                Opens wa.me chat prefilled with this card’s item.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
