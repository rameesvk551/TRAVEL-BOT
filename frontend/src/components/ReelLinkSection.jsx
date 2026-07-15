// Links Instagram reels/posts to a catalog item (property or package). A comment on a linked
// reel auto-DMs the customer and, on the resulting lead, records which reel brought them and
// which item it advertised. See docs/plans/2026-07-14-reel-catalog-mapping-design.md.
//
// Reels can only be linked once the item exists (the link needs its id), so this renders a hint
// in create mode and the picker in edit mode.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhotoIcon, XMarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import * as igApi from '../api/instagramApi';
import { catalogMediaLinksApi } from '../api/catalogMediaLinksApi';

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const ACTION_OPTIONS = [
  { value: '', label: 'Agency default' },
  { value: 'WHATSAPP', label: 'Send WhatsApp link' },
  { value: 'LEAD_FORM', label: 'Send lead form' },
  { value: 'DM_PDF', label: 'Send PDF in DM' },
];

export default function ReelLinkSection({ itemType, itemId }) {
  const qc = useQueryClient();
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  const connectionQuery = useQuery({
    queryKey: ['ig-connection'],
    queryFn: () => igApi.getInstagramConnection(),
  });
  const accounts = useMemo(
    () => asArray(connectionQuery.data?.data?.accounts || connectionQuery.data?.accounts),
    [connectionQuery.data],
  );
  const account = accounts[0] || null;

  const mediaQuery = useQuery({
    queryKey: ['ig-media', account?.id, 'reel-link-picker'],
    queryFn: () => igApi.getMedia({ accountId: account.id, limit: 30 }),
    enabled: Boolean(account?.id),
  });
  const media = useMemo(() => asArray(mediaQuery.data?.data), [mediaQuery.data]);

  const linksQuery = useQuery({
    queryKey: ['catalog-media-links', itemType, itemId],
    queryFn: () => catalogMediaLinksApi.list({ itemType, itemId }),
    enabled: Boolean(itemId),
  });
  const links = useMemo(() => asArray(linksQuery.data?.data), [linksQuery.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog-media-links', itemType, itemId] });

  const createMutation = useMutation({
    mutationFn: (payload) => catalogMediaLinksApi.create(payload),
    onSuccess: () => { setSelectedMediaId(''); setAction(''); setError(''); invalidate(); },
    onError: (err) => setError(err?.response?.data?.message || 'Could not link this reel'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => catalogMediaLinksApi.update(id, patch),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => catalogMediaLinksApi.delete(id),
    onSuccess: invalidate,
  });

  const linkedMediaIds = new Set(links.map((l) => String(l.mediaId)));
  const availableMedia = media.filter((m) => !linkedMediaIds.has(String(m.igMediaId || m.id)));

  const handleAdd = () => {
    if (!selectedMediaId) return;
    const chosen = media.find((m) => String(m.igMediaId || m.id) === String(selectedMediaId));
    createMutation.mutate({
      mediaId: selectedMediaId,
      itemType,
      itemId,
      actionOverride: action || undefined,
      permalink: chosen?.permalink || undefined,
      thumbnailUrl: chosen?.thumbnailUrl || chosen?.mediaUrl || undefined,
    });
  };

  const cardClass = 'rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm';

  if (!itemId) {
    return (
      <div className={cardClass}>
        <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <LinkIcon className="h-5 w-5 text-neutral-400" /> Linked Instagram reels
        </h3>
        <p className="mt-2 text-sm text-neutral-500">
          Save this item first, then come back to link the reels that advertise it.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        <LinkIcon className="h-5 w-5 text-neutral-400" /> Linked Instagram reels
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        When someone comments on a linked reel, the auto-DM points them here and the lead records which reel brought them.
      </p>

      {connectionQuery.isSuccess && accounts.length === 0 && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Connect an Instagram account in Settings to link reels.
        </p>
      )}

      {/* Existing links */}
      {links.length > 0 && (
        <ul className="mt-4 space-y-3">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
              {link.thumbnailUrl ? (
                <img src={link.thumbnailUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100">
                  <PhotoIcon className="h-6 w-6 text-neutral-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-800">
                  {link.permalink ? (
                    <a href={link.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                      Reel #{link.code}
                    </a>
                  ) : `Reel #${link.code}`}
                </div>
                <div className="text-xs text-neutral-500">Handoff code: {link.code}</div>
              </div>
              <select
                className="prop-input !py-1.5 !text-sm"
                value={link.actionOverride || ''}
                onChange={(e) => updateMutation.mutate({ id: link.id, patch: { actionOverride: e.target.value } })}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(link.id)}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                aria-label="Remove reel link"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add a link */}
      {account && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="prop-label">Reel / post</span>
            <select
              className="prop-input"
              value={selectedMediaId}
              onChange={(e) => setSelectedMediaId(e.target.value)}
            >
              <option value="">Choose a reel…</option>
              {availableMedia.map((m) => {
                const id = String(m.igMediaId || m.id);
                const label = (m.caption || m.mediaType || id).slice(0, 60);
                return <option key={id} value={id}>{label}</option>;
              })}
            </select>
          </label>
          <label>
            <span className="prop-label">On comment</span>
            <select className="prop-input" value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedMediaId || createMutation.isPending}
            className="prop-wizard-primary"
          >
            {createMutation.isPending ? 'Linking…' : 'Link reel'}
          </button>
        </div>
      )}

      {mediaQuery.isSuccess && account && availableMedia.length === 0 && media.length > 0 && (
        <p className="mt-3 text-sm text-neutral-500">All fetched reels are already linked to this item.</p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
