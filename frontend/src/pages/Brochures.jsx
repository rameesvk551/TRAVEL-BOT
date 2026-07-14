import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon, PaperAirplaneIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline';

import { brochuresApi, downloadBrochurePdf } from '../api/brochuresApi';
import { leadsApi } from '../api/leadsApi';
import { cdnUrl, THUMB_IMAGE_WIDTH } from '../utils/brochureDoc';

/**
 * Create flow. The point of this screen is that an agency with a folder of resort
 * photos gets a finished, branded deck without placing a single box: drop the
 * photos, pick a look, and auto-compose sizes the page sequence to the photo count.
 * Everything is freely editable afterwards.
 */
function CreateDialog({ meta, templates, onClose, onCreated }) {
  const fileRef = useRef(null);
  const [title, setTitle] = useState('');
  const [choice, setChoice] = useState('theme:beach');
  const [size, setSize] = useState('landscape');
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(0);
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

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Give the brochure a name');
      return;
    }
    setCreating(true);
    try {
      const [kind, value] = choice.split(':');
      const res = await brochuresApi.create({
        title,
        size,
        ...(kind === 'template' ? { templateId: value } : {}),
        ...(kind === 'theme' ? { theme: value } : {}),
        ...(kind === 'blank' ? { blank: true } : {}),
      });
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create brochure');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">New brochure</h2>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
          <input
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Dunecastle Villas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Photos ({assets.length})</span>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              {uploading ? `Uploading ${uploading}%…` : '+ Add photos'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-dashed border-slate-300 p-2">
            {assets.length ? assets.map((a) => (
              <img
                key={a.id}
                src={cdnUrl(a.url, THUMB_IMAGE_WIDTH)}
                alt=""
                className="h-14 w-20 shrink-0 rounded object-cover"
              />
            )) : (
              <p className="p-3 text-sm text-slate-400">
                Drop in the resort’s photos — 10 to 30 works well. The page count adapts to how many you add.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <span className="mb-2 block text-sm font-medium text-slate-700">Start from</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {meta.themes.map((t) => (
              <button
                key={t.key}
                onClick={() => setChoice(`theme:${t.key}`)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left ${
                  choice === `theme:${t.key}` ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="h-8 w-8 shrink-0 rounded" style={{ background: t.primary }} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{t.name}</span>
                  <span className="block text-xs text-slate-500">Auto-built from your photos</span>
                </span>
              </button>
            ))}

            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setChoice(`template:${t.id}`)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left ${
                  choice === `template:${t.id}` ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-200 text-xs font-semibold">
                  {t.slotCount}
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-900">{t.name}</span>
                  <span className="block text-xs text-slate-500">Your saved design</span>
                </span>
              </button>
            ))}

            <button
              onClick={() => setChoice('blank:1')}
              className={`rounded-lg border p-3 text-left ${
                choice === 'blank:1' ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-medium text-slate-900">Blank page</span>
              <span className="block text-xs text-slate-500">Design from scratch</span>
            </button>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Page shape</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            {Object.entries(meta.pageSizes).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={creating}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? 'Building…' : 'Create brochure'}
          </button>
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

      {creating && meta && (
        <CreateDialog
          meta={meta}
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
