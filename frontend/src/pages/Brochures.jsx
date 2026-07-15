import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon, CheckIcon, PaperAirplaneIcon, PlusIcon,
  Square2StackIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

import { brochuresApi, downloadBrochurePdf } from '../api/brochuresApi';
import { leadsApi } from '../api/leadsApi';
import { cdnUrl, THUMB_IMAGE_WIDTH } from '../utils/brochureDoc';
import BrochurePagePreview from '../components/brochure/BrochurePagePreview';

/** One design in the picker: a stack of live cover/interior thumbnails of the resort. */
function PresetCard({ preview, selected, onSelect }) {
  const cover = preview.doc.pages[0];
  const inner = preview.doc.pages[1] || preview.doc.pages[0];
  const w = 168;
  const scale = w / preview.doc.pageW;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all ${
        selected
          ? 'border-slate-900 shadow-lg ring-2 ring-slate-900/10'
          : 'border-transparent shadow-sm ring-1 ring-slate-200 hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="relative flex justify-center gap-2 bg-slate-50 p-3">
        <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5">
          <BrochurePagePreview doc={preview.doc} page={cover} scale={scale} />
        </div>
        <div className="mt-4 hidden overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 sm:block">
          <BrochurePagePreview doc={preview.doc} page={inner} scale={scale * 0.82} />
        </div>
        {selected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
            <CheckIcon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="border-t border-slate-100 px-3.5 py-2.5">
        <p className="text-sm font-semibold text-slate-900">{preview.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{preview.description}</p>
      </div>
    </button>
  );
}

/**
 * Create flow, in two steps.
 *
 *  1. Name the brochure and drop in the resort's photos.
 *  2. See every one of the ten designs rendered LIVE with those photos, and pick one.
 *
 * Step 2 is the whole pitch: the customer sees their own resort transformed into a
 * finished brochure before committing, which is what turns "maybe" into "that one".
 */
function CreateDialog({ templates, onClose, onCreated }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(0);

  const [previews, setPreviews] = useState([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [choice, setChoice] = useState(null); // { kind: 'preset'|'template'|'blank', value }
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    brochuresApi.listAssets().then((res) => setAssets(res.data)).catch(() => {});
  }, []);

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(1);
    try {
      const res = await brochuresApi.uploadAssets(files, null, setUploading);
      setAssets((current) => [...current, ...res.data]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(0);
    }
  };

  const goToDesigns = async () => {
    if (!title.trim()) { toast.error('Give the brochure a name first'); return; }
    setStep(2);
    setLoadingPreviews(true);
    try {
      const res = await brochuresApi.previewPresets();
      setPreviews(res.data);
      setChoice({ kind: 'preset', value: res.data[0]?.key });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not build previews');
    } finally {
      setLoadingPreviews(false);
    }
  };

  const submit = async () => {
    if (!choice) return;
    setCreating(true);
    try {
      const res = await brochuresApi.create({
        title,
        ...(choice.kind === 'preset' ? { preset: choice.value } : {}),
        ...(choice.kind === 'template' ? { templateId: choice.value } : {}),
        ...(choice.kind === 'blank' ? { blank: true } : {}),
      });
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create brochure');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {step === 1 ? 'New brochure' : 'Choose a design'}
            </h2>
            <p className="text-xs text-slate-500">
              {step === 1
                ? 'Name it and add the resort’s photos.'
                : 'Every design, built from your photos. Pick one — you can change everything after.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1 — name + photos */}
        {step === 1 && (
          <div className="overflow-y-auto px-6 py-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Brochure name</span>
              <input
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                placeholder="e.g. Dunecastle Villas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') goToDesigns(); }}
              />
            </label>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Photos ({assets.length})</span>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  {uploading ? `Uploading ${uploading}%…` : '+ Add photos'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </div>
              <div className="grid grid-cols-4 gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-3 sm:grid-cols-6">
                {assets.length ? assets.map((a) => (
                  <img key={a.id} src={cdnUrl(a.url, THUMB_IMAGE_WIDTH)} alt="" className="aspect-square w-full rounded-lg object-cover" />
                )) : (
                  <p className="col-span-full py-8 text-center text-sm text-slate-400">
                    Drop in the resort’s photos — 10 to 30 works beautifully.<br />The page count adapts to how many you add.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — live design gallery */}
        {step === 2 && (
          <div className="overflow-y-auto bg-slate-50 px-6 py-6">
            {loadingPreviews ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                Rendering your resort in every design…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {previews.map((p) => (
                  <PresetCard
                    key={p.key}
                    preview={p}
                    selected={choice?.kind === 'preset' && choice.value === p.key}
                    onSelect={() => setChoice({ kind: 'preset', value: p.key })}
                  />
                ))}

                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChoice({ kind: 'template', value: t.id })}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 text-center transition ${
                      choice?.kind === 'template' && choice.value === t.id
                        ? 'border-slate-900 bg-white shadow-lg'
                        : 'border-transparent bg-white shadow-sm ring-1 ring-slate-200 hover:shadow-md'
                    }`}
                  >
                    <Square2StackIcon className="h-7 w-7 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">{t.name}</span>
                    <span className="text-xs text-slate-500">Your saved design · {t.slotCount} photos</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setChoice({ kind: 'blank' })}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    choice?.kind === 'blank' ? 'border-slate-900 bg-white' : 'border-slate-300 hover:bg-white'
                  }`}
                >
                  <PlusIcon className="h-7 w-7 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">Blank page</span>
                  <span className="text-xs text-slate-500">Design from scratch</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={() => (step === 1 ? onClose() : setStep(1))}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button
              onClick={goToDesigns}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              See designs →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={creating || !choice}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {creating ? 'Building…' : 'Create brochure'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SendDialog({ brochure, onClose }) {
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    leadsApi.list({ limit: 100 })
      .then((res) => setLeads(res.data?.leads || res.data || []))
      .catch(() => {});
  }, []);

  const send = async () => {
    if (!leadId) return;
    setSending(true);
    try {
      await brochuresApi.send(brochure.id, leadId);
      toast.success('Brochure sent on WhatsApp');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Send “{brochure.title}”</h2>
        <p className="mt-1 text-sm text-slate-500">
          The brochure is rendered to PDF and delivered as a WhatsApp document.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">To lead</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          >
            <option value="">Choose a lead…</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.customer?.name || 'Unnamed'} · {lead.customer?.phone || 'no number'}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!leadId || sending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Brochures() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [meta, setMeta] = useState(null);
  const [brochures, setBrochures] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const sendId = params.get('send');
  const sendTarget = useMemo(
    () => brochures.find((b) => b.id === sendId) || null,
    [brochures, sendId],
  );

  const load = async () => {
    try {
      const [metaRes, listRes, templatesRes] = await Promise.all([
        brochuresApi.meta(),
        brochuresApi.list(),
        brochuresApi.listTemplates(),
      ]);
      setMeta(metaRes.data);
      setBrochures(listRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load brochures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const download = async (brochure) => {
    const pending = toast.loading('Rendering PDF…');
    try {
      await downloadBrochurePdf(brochure.id, brochure.title);
      toast.success('PDF ready', { id: pending });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not render the PDF', { id: pending });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this brochure?')) return;
    try {
      await brochuresApi.delete(id);
      setBrochures((current) => current.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete');
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Brochures</h1>
          <p className="text-sm text-slate-500">
            Design multi-page property brochures from your photos and send them on WhatsApp.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" /> New brochure
        </button>
      </div>

      {brochures.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 py-20 text-center">
          <p className="text-slate-600">No brochures yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Upload a resort’s photos and a full deck is built for you in seconds.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Brochure</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brochures.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/brochures/${b.id}`)}
                      className="font-medium text-slate-900 hover:text-blue-600"
                    >
                      {b.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === 'READY' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {b.status === 'READY' ? 'Ready' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(b.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => download(b)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        title="Download PDF"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setParams({ send: b.id })}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                        title="Send on WhatsApp"
                      >
                        <PaperAirplaneIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(b.id)}
                        className="rounded-md p-2 text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateDialog
          templates={templates}
          onClose={() => setCreating(false)}
          onCreated={(brochure) => navigate(`/brochures/${brochure.id}`)}
        />
      )}

      {sendTarget && (
        <SendDialog brochure={sendTarget} onClose={() => setParams({})} />
      )}
    </div>
  );
}
