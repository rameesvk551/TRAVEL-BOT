import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon, ArrowLeftIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon,
  DocumentDuplicateIcon, PaperAirplaneIcon, PhotoIcon, PlusIcon, SparklesIcon,
  Square2StackIcon, SquaresPlusIcon, TrashIcon,
} from '@heroicons/react/24/outline';

import { brochuresApi, downloadBrochurePdf } from '../api/brochuresApi';
import BrochureCanvas from '../components/brochure/BrochureCanvas';
import BrochureInspector from '../components/brochure/BrochureInspector';
import BrochurePagePreview from '../components/brochure/BrochurePagePreview';
import {
  cdnUrl, newIconElement, newImageElement, newPage, newShapeElement, newTextElement, THUMB_IMAGE_WIDTH,
} from '../utils/brochureDoc';

const AUTOSAVE_MS = 1500;

// The "+ Page → pick a layout" menu. Each key (except 'blank') maps to a buildPage layout
// on the server, which returns a fresh page themed to the deck's style + current palette.
const LAYOUT_OPTIONS = [
  { key: 'cover', label: 'Cover' },
  { key: 'intro', label: 'Intro' },
  { key: 'pool', label: 'Pool' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'interiors', label: 'Interiors' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'grounds', label: 'Grounds' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'contact', label: 'Contact' },
  { key: 'blank', label: 'Blank' },
];

export default function BrochureEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const canvasWrapRef = useRef(null);

  const [meta, setMeta] = useState(null);
  const [brochure, setBrochure] = useState(null);
  const [doc, setDoc] = useState(null);
  const [fields, setFields] = useState({});
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);

  // Undo/redo. The doc is small (JSON, no bitmaps), so snapshotting whole documents
  // is cheaper and far less bug-prone than diffing element patches.
  const history = useRef({ past: [], future: [] });
  const dirty = useRef(false);
  const saveTimer = useRef(null);

  const page = doc?.pages?.[pageIndex] || null;
  const selected = page?.elements?.find((el) => el.id === selectedId) || null;

  // --- load ------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [metaRes, brochureRes, assetsRes, templatesRes] = await Promise.all([
          brochuresApi.meta(),
          brochuresApi.getById(id),
          brochuresApi.listAssets(),
          brochuresApi.listTemplates(),
        ]);
        if (cancelled) return;

        setMeta(metaRes.data);
        setBrochure(brochureRes.data);
        setDoc(brochureRes.data.doc);
        setFields(brochureRes.data.fields || {});
        setAssets(assetsRes.data);
        setTemplates(templatesRes.data);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Could not open this brochure');
        navigate('/brochures');
      }
    })();

    return () => { cancelled = true; };
  }, [id, navigate]);

  // Fit the page to the available width.
  useEffect(() => {
    if (!doc) return undefined;
    const fit = () => {
      const el = canvasWrapRef.current;
      if (!el) return;
      const available = el.clientWidth - 64;
      setScale(Math.min(1, Math.max(0.15, available / doc.pageW)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [doc?.pageW]);

  // --- mutation + autosave ---------------------------------------------------

  const commit = useCallback((nextDoc, { snapshot = true } = {}) => {
    setDoc((current) => {
      if (snapshot && current) {
        history.current.past.push(current);
        if (history.current.past.length > 60) history.current.past.shift();
        history.current.future = [];
      }
      return typeof nextDoc === 'function' ? nextDoc(current) : nextDoc;
    });
    dirty.current = true;
  }, []);

  const save = useCallback(async (docToSave, fieldsToSave) => {
    setSaving(true);
    try {
      await brochuresApi.update(id, { doc: docToSave, fields: fieldsToSave });
      dirty.current = false;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [id]);

  useEffect(() => {
    if (!doc || !dirty.current) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(doc, fields), AUTOSAVE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [doc, fields, save]);

  const undo = () => {
    const { past, future } = history.current;
    if (!past.length) return;
    const previous = past.pop();
    future.push(doc);
    setDoc(previous);
    dirty.current = true;
  };

  const redo = () => {
    const { past, future } = history.current;
    if (!future.length) return;
    const next = future.pop();
    past.push(doc);
    setDoc(next);
    dirty.current = true;
  };

  const setElements = (elements) => {
    commit((current) => ({
      ...current,
      pages: current.pages.map((p, i) => (i === pageIndex ? { ...p, elements } : p)),
    }));
  };

  const patchPage = (patch) => {
    commit((current) => ({
      ...current,
      pages: current.pages.map((p, i) => (i === pageIndex ? { ...p, ...patch } : p)),
    }));
  };

  const patchElement = (patch) => {
    if (!selected) return;
    setElements(page.elements.map((el) => (el.id === selected.id ? { ...el, ...patch } : el)));
  };

  const patchFields = (patch) => {
    const next = { ...fields, ...patch };
    setFields(next);
    // Field-bound elements mirror the form immediately, so the canvas is never showing
    // stale content that the server would overwrite on the next save. Text takes the
    // value as copy; an image (the logo) takes it as its src.
    commit((current) => ({
      ...current,
      pages: current.pages.map((p) => ({
        ...p,
        elements: p.elements.map((el) => {
          if (!el.field || next[el.field] == null) return el;
          if (el.type === 'text') return { ...el, text: next[el.field] };
          if (el.type === 'image') return { ...el, url: next[el.field] };
          return el;
        }),
      })),
    }), { snapshot: false });
    dirty.current = true;
  };

  /** Page-level geometry: size, margins. */
  const patchDoc = (patch) => commit((current) => ({ ...current, ...patch }));

  /**
   * Recolour the whole deck. Done on the server so one implementation of the swap
   * logic exists (brochureDoc.retheme) rather than a second copy drifting on the client.
   */
  const retheme = async (patch) => {
    clearTimeout(saveTimer.current);
    if (dirty.current) await save(doc, fields);
    try {
      const res = await brochuresApi.retheme(id, patch);
      history.current.past.push(doc);
      history.current.future = [];
      setDoc(res.data.doc);
      dirty.current = false;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not apply the theme');
    }
  };

  const uploadLogo = async (file) => {
    setLogoUploading(true);
    try {
      const res = await brochuresApi.uploadLogo(file);
      patchFields({ logo: res.data.url });
      toast.success('Logo added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const addElement = (factory) => {
    const element = factory(doc.pageW, doc.pageH);
    const topZ = (page.elements || []).reduce((max, el) => Math.max(max, el.z || 1), 0);
    setElements([...(page.elements || []), { ...element, z: topZ + 1 }]);
    setSelectedId(element.id);
  };

  const reorderSelected = (where) => {
    if (!selected) return;
    const zs = page.elements.map((el) => el.z || 1);
    const z = where === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
    patchElement({ z: Math.max(0, z) });
  };

  // --- pages -----------------------------------------------------------------

  const addPage = () => {
    commit((current) => ({ ...current, pages: [...current.pages, newPage()] }));
    setPageIndex(doc.pages.length);
    setSelectedId(null);
  };

  /**
   * Insert a fresh THEMED page after the current one, built on the server to match the
   * deck's style (doc.styleKey) and current colours (doc.theme). 'blank' is the old
   * behaviour. The page arrives with empty photo slots for the user to fill afterwards.
   */
  const addLayoutPage = async (layout) => {
    if (layout === 'blank') { addPage(); return; }
    try {
      const res = await brochuresApi.buildPage({
        styleKey: doc.styleKey || '', layout, size: doc.size, theme: doc.theme,
      });
      const built = res.data || res;
      // Assign a fresh page id so the pages-rail React key can never collide with an
      // existing page, exactly as duplicatePage does.
      const nextPage = { ...built, id: `p${Date.now().toString(36)}` };
      commit((current) => {
        const pages = [...current.pages];
        pages.splice(pageIndex + 1, 0, nextPage);
        return { ...current, pages };
      });
      setPageIndex(pageIndex + 1);
      setSelectedId(null);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not add page');
    }
  };

  const duplicatePage = (index) => {
    commit((current) => {
      const copy = JSON.parse(JSON.stringify(current.pages[index]));
      copy.id = `p${Date.now().toString(36)}`;
      copy.elements = copy.elements.map((el, i) => ({ ...el, id: `${el.id}-c${i}${Date.now().toString(36)}` }));
      const pages = [...current.pages];
      pages.splice(index + 1, 0, copy);
      return { ...current, pages };
    });
    setPageIndex(index + 1);
  };

  const deletePage = (index) => {
    if (doc.pages.length === 1) {
      toast.error('A brochure needs at least one page');
      return;
    }
    commit((current) => ({ ...current, pages: current.pages.filter((_, i) => i !== index) }));
    setPageIndex((current) => Math.max(0, current > index ? current - 1 : Math.min(current, doc.pages.length - 2)));
    setSelectedId(null);
  };

  const movePage = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= doc.pages.length) return;
    commit((current) => {
      const pages = [...current.pages];
      [pages[index], pages[target]] = [pages[target], pages[index]];
      return { ...current, pages };
    });
    setPageIndex(target);
  };

  // --- photos ----------------------------------------------------------------

  const uploadPhotos = async (files) => {
    if (!files?.length) return;
    setUploading(1);
    try {
      const res = await brochuresApi.uploadAssets(files, null, setUploading);
      setAssets((current) => [...current, ...res.data]);
      toast.success(`${res.data.length} photo(s) added`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(0);
    }
  };

  const removePhoto = async (assetId) => {
    try {
      await brochuresApi.deleteAsset(assetId);
      setAssets((current) => current.filter((a) => a.id !== assetId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove photo');
    }
  };

  // --- actions ---------------------------------------------------------------

  const flushThenRun = async (action) => {
    clearTimeout(saveTimer.current);
    if (dirty.current) await save(doc, fields);
    return action();
  };

  const downloadPdf = () => flushThenRun(async () => {
    const pending = toast.loading('Rendering PDF…');
    try {
      await downloadBrochurePdf(id, brochure.title);
      toast.success('PDF ready', { id: pending });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not render the PDF', { id: pending });
    }
  });

  const saveAsTemplate = () => flushThenRun(async () => {
    const name = window.prompt('Name this design so you can reuse it for the next property:', `${brochure.title} layout`);
    if (!name) return;
    try {
      const res = await brochuresApi.saveAsTemplate(id, name);
      setTemplates((current) => [res.data, ...current]);
      toast.success('Saved as a reusable template');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save template');
    }
  });

  const applyTemplate = (templateId) => flushThenRun(async () => {
    if (!templateId) return;
    if (!window.confirm('Replace this brochure’s layout with the template? Your photos refill automatically.')) return;
    try {
      const res = await brochuresApi.applyTemplate(id, templateId);
      setDoc(res.data.doc);
      setPageIndex(0);
      setSelectedId(null);
      toast.success('Template applied');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not apply template');
    }
  });

  if (!doc || !meta) {
    return <div className="p-10 text-slate-500">Loading brochure…</div>;
  }

  const thumbScale = 128 / doc.pageW;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <button onClick={() => navigate('/brochures')} className="rounded-md p-2 hover:bg-slate-100" title="Back">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        <input
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold hover:border-slate-300 focus:border-blue-500 focus:outline-none"
          value={brochure.title}
          onChange={(e) => setBrochure({ ...brochure, title: e.target.value })}
          onBlur={(e) => brochuresApi.update(id, { title: e.target.value }).catch(() => {})}
        />

        <span className="whitespace-nowrap text-xs text-slate-400">
          {saving ? 'Saving…' : (dirty.current ? 'Unsaved' : 'All changes saved')}
        </span>

        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
          <button onClick={undo} className="rounded-md p-2 hover:bg-slate-100" title="Undo">
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </button>
          <button onClick={redo} className="rounded-md p-2 hover:bg-slate-100" title="Redo">
            <ArrowUturnRightIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
          <button onClick={() => addElement(newTextElement)} className="rounded-md px-2 py-1.5 text-sm hover:bg-slate-100" title="Add text">
            Text
          </button>
          <button onClick={() => addElement(newImageElement)} className="rounded-md p-2 hover:bg-slate-100" title="Add image box">
            <PhotoIcon className="h-5 w-5" />
          </button>
          <button onClick={() => addElement(newShapeElement)} className="rounded-md p-2 hover:bg-slate-100" title="Add shape">
            <SquaresPlusIcon className="h-5 w-5" />
          </button>
          <button onClick={() => addElement(newIconElement)} className="rounded-md p-2 hover:bg-slate-100" title="Add icon">
            <SparklesIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">Apply a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.agencyId ? '' : ' (preset)'} · {t.slotCount} photos
              </option>
            ))}
          </select>

          <button onClick={saveAsTemplate} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            <Square2StackIcon className="h-4 w-4" /> Save as template
          </button>

          <button onClick={downloadPdf} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            <ArrowDownTrayIcon className="h-4 w-4" /> PDF
          </button>

          <button
            onClick={() => flushThenRun(() => navigate(`/brochures?send=${id}`))}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PaperAirplaneIcon className="h-4 w-4" /> Send
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Pages rail */}
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
          {doc.pages.map((p, i) => (
            <div key={p.id} className="group mb-3">
              <button
                onClick={() => { setPageIndex(i); setSelectedId(null); }}
                className={`block w-full overflow-hidden rounded-lg ring-2 ${
                  i === pageIndex ? 'ring-blue-500' : 'ring-slate-200 hover:ring-slate-300'
                }`}
              >
                <BrochurePagePreview doc={doc} page={p} scale={thumbScale} />
              </button>
              <div className="mt-1 flex items-center justify-between px-1">
                <span className="text-xs text-slate-500">{i + 1}</span>
                <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => movePage(i, -1)} className="rounded p-0.5 text-xs hover:bg-slate-200" title="Move up">↑</button>
                  <button onClick={() => movePage(i, 1)} className="rounded p-0.5 text-xs hover:bg-slate-200" title="Move down">↓</button>
                  <button onClick={() => duplicatePage(i)} className="rounded p-0.5 hover:bg-slate-200" title="Duplicate">
                    <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deletePage(i)} className="rounded p-0.5 text-red-600 hover:bg-red-50" title="Delete page">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* "+ Page → pick a layout". The dashed affordance is unchanged; a transparent
              native <select> sits over it so the click opens a layout menu. It resets to
              the placeholder after each pick so the same layout can be added again. */}
          <div className="relative">
            <div className="pointer-events-none flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500">
              <PlusIcon className="h-4 w-4" /> Page
            </div>
            <select
              aria-label="Add a page"
              className="absolute inset-0 h-full w-full cursor-pointer rounded-lg opacity-0"
              value=""
              onChange={(e) => {
                const layout = e.target.value;
                e.target.value = '';
                if (layout) addLayoutPage(layout);
              }}
            >
              <option value="" disabled>Add a page…</option>
              {LAYOUT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </aside>

        {/* Canvas + photo tray */}
        <main className="flex min-w-0 flex-1 flex-col bg-slate-100">
          <div ref={canvasWrapRef} className="flex flex-1 items-center justify-center overflow-auto p-8">
            <BrochureCanvas
              doc={doc}
              page={page}
              scale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChangeElements={setElements}
              onChangePage={patchPage}
            />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Photos ({assets.length})
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              >
                {uploading ? `Uploading ${uploading}%…` : '+ Add photos'}
              </button>
              <span className="text-xs text-slate-400">Drag a photo onto the page, or onto a photo box to swap it.</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { uploadPhotos(e.target.files); e.target.value = ''; }}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {assets.map((asset) => (
                <div key={asset.id} className="group relative shrink-0">
                  <img
                    src={cdnUrl(asset.url, THUMB_IMAGE_WIDTH)}
                    alt={asset.filename || ''}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/brochure-image', asset.url)}
                    className="h-16 w-24 cursor-grab rounded-md object-cover ring-1 ring-slate-200"
                  />
                  <button
                    onClick={() => removePhoto(asset.id)}
                    className="absolute -right-1 -top-1 hidden rounded-full bg-red-600 p-0.5 text-white group-hover:block"
                    title="Remove"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {!assets.length && (
                <p className="py-5 text-sm text-slate-400">
                  No photos yet — add the resort’s images and drag them onto the pages.
                </p>
              )}
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          <BrochureInspector
            element={selected}
            page={page}
            doc={doc}
            fields={fields}
            mergeFields={meta.mergeFields}
            assets={assets}
            logoUploading={logoUploading}
            onPatchElement={patchElement}
            onPatchPage={patchPage}
            onPatchDoc={patchDoc}
            onPatchFields={patchFields}
            onRetheme={retheme}
            onUploadLogo={uploadLogo}
            onDeleteElement={() => {
              setElements(page.elements.filter((el) => el.id !== selected.id));
              setSelectedId(null);
            }}
            onReorder={reorderSelected}
          />
        </aside>
      </div>
    </div>
  );
}
