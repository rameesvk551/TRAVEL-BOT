import { useState } from 'react';
import { FONTS, PAGE_SIZES, pxToMm, mm as toPx } from '../../utils/brochureDoc';
import { ICONS, ICON_KEYS } from '../../utils/brochureIcons';

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 '
  + 'transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5';

function Field({ label, hint, children }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Num({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          className={input}
          value={Math.round((value ?? 0) * 100) / 100}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

function Color({ label, value, onChange, allowEmpty }) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value || '');
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
          value={isHex ? value : '#111111'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className={input}
          placeholder={allowEmpty ? 'none' : ''}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

/** Four-up padding editor with a link toggle, the way design tools do it. */
function BoxField({ label, value, onChange }) {
  const box = value || { top: 0, right: 0, bottom: 0, left: 0 };
  const uniform = box.top === box.right && box.right === box.bottom && box.bottom === box.left;
  const [linked, setLinked] = useState(uniform);

  const setAll = (n) => onChange({ top: n, right: n, bottom: n, left: n });
  const setOne = (side, n) => onChange({ ...box, [side]: n });

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <button
          type="button"
          onClick={() => { const next = !linked; setLinked(next); if (next) setAll(box.top); }}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
            linked ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
          title="Link all four sides"
        >
          {linked ? 'Linked' : 'Link'}
        </button>
      </div>

      {linked ? (
        <input
          type="number"
          min={0}
          className={input}
          value={box.top}
          onChange={(e) => setAll(Math.max(0, Number(e.target.value)))}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <div key={side}>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-center text-xs focus:border-slate-900 focus:outline-none"
                value={box[side]}
                onChange={(e) => setOne(side, Math.max(0, Number(e.target.value)))}
              />
              <span className="mt-0.5 block text-center text-[10px] capitalize text-slate-400">
                {side[0]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

const THEME_SWATCHES = [
  { key: 'accent', label: 'Accent' },
  { key: 'accent2', label: 'Accent (light)' },
  { key: 'bg', label: 'Page background' },
  { key: 'ink', label: 'Headings' },
  { key: 'inkSoft', label: 'Body text' },
  { key: 'inkMute', label: 'Muted text' },
  { key: 'panel', label: 'Panels' },
];

/**
 * The right-hand panel. Three tabs:
 *  - Element: the selected box (geometry, padding, border, type, colour)
 *  - Page:    background, size, margins
 *  - Brand:   merge fields, logo, and a palette that recolours the WHOLE deck at once
 */
/**
 * The Align panel, shown instead of the single-element panel when several boxes are picked.
 *
 * A design ships its rows on exact shared edges; dragging one by hand snaps it to the 8px
 * grid and the column stops lining up. Nudging twelve boxes back by eye is not realistic,
 * and typing X/Width into each is worse — so these do it exactly, in one click.
 */
function AlignPanel({ count, onArrange }) {
  const btn = 'rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium transition hover:bg-slate-50';

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
          {count} selected
        </span>
      </div>

      <Section title="Align">
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          <button type="button" className={btn} onClick={() => onArrange('left')} title="Align left edges">Left</button>
          <button type="button" className={btn} onClick={() => onArrange('centerH')} title="Centre horizontally">Centre</button>
          <button type="button" className={btn} onClick={() => onArrange('right')} title="Align right edges">Right</button>
          <button type="button" className={btn} onClick={() => onArrange('top')} title="Align top edges">Top</button>
          <button type="button" className={btn} onClick={() => onArrange('middleV')} title="Centre vertically">Middle</button>
          <button type="button" className={btn} onClick={() => onArrange('bottom')} title="Align bottom edges">Bottom</button>
        </div>
      </Section>

      <Section title="Match size">
        <p className="-mt-2 mb-3 text-[11px] text-slate-400">
          Copies the box you clicked <strong>first</strong>. Click the one you like, then
          shift-click the rest.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" className={btn} onClick={() => onArrange('sameWidth')}>Width</button>
          <button type="button" className={btn} onClick={() => onArrange('sameHeight')}>Height</button>
          <button type="button" className={btn} onClick={() => onArrange('sameSize')}>Both</button>
        </div>
      </Section>

      <Section title="Even spacing">
        <p className="-mt-2 mb-3 text-[11px] text-slate-400">
          Equal gaps between them. The top and bottom (or left and right) stay put. Needs
          three or more.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btn} disabled={count < 3} onClick={() => onArrange('distributeV')}>Vertically</button>
          <button type="button" className={btn} disabled={count < 3} onClick={() => onArrange('distributeH')}>Horizontally</button>
        </div>
      </Section>

      <p className="text-[11px] text-slate-400">
        Shift-click to add or remove a box. Drag any one of them to move the whole group.
      </p>
    </>
  );
}

export default function BrochureInspector({
  element, selectedCount = 0, page, doc, fields, mergeFields, assets, logoUploading,
  onPatchElement, onPatchPage, onPatchDoc, onPatchFields, onRetheme, onResize, onArrange,
  onDeleteElement, onReorder, onUploadLogo,
}) {
  const [tab, setTab] = useState('element');
  const multi = selectedCount > 1;
  const active = (element || multi) ? tab : (tab === 'element' ? 'brand' : tab);
  const theme = doc?.theme || {};

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { key: 'element', label: multi ? 'Align' : 'Element', disabled: !element && !multi },
          { key: 'page', label: 'Page' },
          { key: 'brand', label: 'Brand' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={t.disabled}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
              active === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Element ---------------- */}
      {/* Several boxes picked: the per-element controls are meaningless, so this slot
          becomes the Align panel instead. */}
      {active === 'element' && multi && (
        <AlignPanel count={selectedCount} onArrange={onArrange} />
      )}

      {active === 'element' && !multi && element && (
        <>
          <div className="mb-5 flex items-center justify-between">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold capitalize text-white">
              {element.type}
            </span>
            <button
              type="button"
              onClick={onDeleteElement}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>

          <Section title="Size & position">
            <div className="grid grid-cols-2 gap-x-3">
              <Num label="X" value={element.x} onChange={(x) => onPatchElement({ x })} suffix="px" />
              <Num label="Y" value={element.y} onChange={(y) => onPatchElement({ y })} suffix="px" />
              <Num label="Width" value={element.w} min={1} onChange={(w) => onPatchElement({ w: Math.max(1, w) })} suffix="px" />
              <Num label="Height" value={element.h} min={1} onChange={(h) => onPatchElement({ h: Math.max(1, h) })} suffix="px" />
              <Num label="Rotate" value={element.rotate} min={-360} max={360} onChange={(rotate) => onPatchElement({ rotate })} suffix="°" />
              <Num label="Opacity" value={element.opacity ?? 1} min={0} max={1} step={0.05} onChange={(opacity) => onPatchElement({ opacity })} />
            </div>

            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => onReorder('front')} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium transition hover:bg-slate-50">
                Bring to front
              </button>
              <button type="button" onClick={() => onReorder('back')} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium transition hover:bg-slate-50">
                Send to back
              </button>
            </div>
          </Section>

          {(element.type === 'text' || element.type === 'image') && (
            <Section title="Spacing & border">
              <BoxField label="Padding" value={element.padding} onChange={(padding) => onPatchElement({ padding })} />
              <div className="grid grid-cols-2 gap-x-3">
                <Num label="Border" value={element.borderWidth} min={0} max={40} onChange={(borderWidth) => onPatchElement({ borderWidth })} suffix="px" />
                <Num label="Radius" value={element.radius} min={0} max={9999} onChange={(radius) => onPatchElement({ radius })} suffix="px" />
              </div>
              <Color label="Border colour" value={element.borderColor} onChange={(borderColor) => onPatchElement({ borderColor })} />
              <Color label="Background" value={element.background} allowEmpty onChange={(background) => onPatchElement({ background })} />
            </Section>
          )}

          {element.type === 'text' && (
            <Section title="Type">
              <Field label="Text">
                <textarea rows={3} className={input} value={element.text} onChange={(e) => onPatchElement({ text: e.target.value })} />
              </Field>

              <Field label="Bind to a field" hint="Bound text updates from the Brand tab.">
                <select className={input} value={element.field || ''} onChange={(e) => onPatchElement({ field: e.target.value })}>
                  <option value="">— fixed text —</option>
                  {mergeFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </Field>

              <Field label="Font">
                <select className={input} value={element.font} onChange={(e) => onPatchElement({ font: e.target.value })}>
                  {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-x-3">
                <Num label="Size" value={element.size} min={6} max={400} onChange={(size) => onPatchElement({ size })} suffix="px" />
                <Num label="Weight" value={element.weight} min={100} max={900} step={100} onChange={(weight) => onPatchElement({ weight })} />
                <Num label="Line height" value={element.lineHeight} min={0.6} max={4} step={0.05} onChange={(lineHeight) => onPatchElement({ lineHeight })} />
                <Num label="Tracking" value={element.letterSpacing} min={-20} max={40} step={0.5} onChange={(letterSpacing) => onPatchElement({ letterSpacing })} suffix="px" />
              </div>

              <Color label="Colour" value={element.color} onChange={(color) => onPatchElement({ color })} />

              <Field label="Align">
                <Segmented
                  options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }]}
                  value={element.align}
                  onChange={(align) => onPatchElement({ align })}
                />
              </Field>

              <Field label="Vertical">
                <Segmented
                  options={[{ value: 'top', label: 'Top' }, { value: 'center', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]}
                  value={element.valign}
                  onChange={(valign) => onPatchElement({ valign })}
                />
              </Field>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="rounded border-slate-300" checked={!!element.uppercase} onChange={(e) => onPatchElement({ uppercase: e.target.checked })} />
                  Uppercase
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="rounded border-slate-300" checked={!!element.italic} onChange={(e) => onPatchElement({ italic: e.target.checked })} />
                  Italic
                </label>
              </div>
            </Section>
          )}

          {element.type === 'image' && (
            <Section title="Photo">
              {element.field === 'logo' ? (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This is the logo. Upload it once in the <strong>Brand</strong> tab and every logo on
                  every page updates.
                </p>
              ) : (
                <>
                  <Field label="Photo" hint="Or drag one from the tray onto this box.">
                    <select className={input} value={element.url || ''} onChange={(e) => onPatchElement({ url: e.target.value })}>
                      <option value="">— empty —</option>
                      {assets.map((a, i) => (
                        <option key={a.id} value={a.url}>{a.filename || `Photo ${i + 1}`}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Refill slot" hint="Named slots refill automatically when this design is reused.">
                    <input className={input} placeholder="e.g. photo_3" value={element.slot || ''} onChange={(e) => onPatchElement({ slot: e.target.value })} />
                  </Field>
                </>
              )}

              <Field label="Fit">
                <Segmented
                  options={[{ value: 'cover', label: 'Crop' }, { value: 'contain', label: 'Fit' }, { value: 'fill', label: 'Stretch' }]}
                  value={element.fit}
                  onChange={(fit) => onPatchElement({ fit })}
                />
              </Field>
            </Section>
          )}

          {element.type === 'shape' && (
            <Section title="Shape">
              <Field label="Kind">
                <Segmented
                  options={[{ value: 'rect', label: 'Rectangle' }, { value: 'ellipse', label: 'Ellipse' }]}
                  value={element.shape}
                  onChange={(s) => onPatchElement({ shape: s })}
                />
              </Field>
              <Color label="Fill" value={element.fill} onChange={(fill) => onPatchElement({ fill })} />
              <div className="grid grid-cols-2 gap-x-3">
                <Num label="Radius" value={element.radius} min={0} max={999} onChange={(radius) => onPatchElement({ radius })} suffix="px" />
                <Num label="Border" value={element.strokeWidth} min={0} max={40} onChange={(strokeWidth) => onPatchElement({ strokeWidth })} suffix="px" />
              </div>
              <Color label="Border colour" value={element.stroke} allowEmpty onChange={(stroke) => onPatchElement({ stroke })} />
            </Section>
          )}

          {element.type === 'icon' && (
            <Section title="Icon">
              <Field label="Icon">
                <select className={input} value={element.icon} onChange={(e) => onPatchElement({ icon: e.target.value })}>
                  {ICON_KEYS.map((k) => <option key={k} value={k}>{ICONS[k].label}</option>)}
                </select>
              </Field>
              <Color label="Colour" value={element.color} onChange={(color) => onPatchElement({ color })} />
              <Num label="Line weight" value={element.strokeWidth} min={0.2} max={8} step={0.1} onChange={(strokeWidth) => onPatchElement({ strokeWidth })} />
            </Section>
          )}
        </>
      )}

      {/* ---------------- Page ---------------- */}
      {active === 'page' && (
        <>
          <Section title="Background">
            <Field label="Type">
              <Segmented
                options={[{ value: 'color', label: 'Colour' }, { value: 'image', label: 'Photo' }]}
                value={page?.bg?.type || 'color'}
                onChange={(type) => onPatchPage({
                  bg: type === 'image'
                    ? { type: 'image', url: '', slot: '', overlay: '', fit: 'cover' }
                    : { type: 'color', color: theme.bg || '#ffffff' },
                })}
              />
            </Field>

            {page?.bg?.type === 'color' ? (
              <Color label="Colour" value={page.bg.color} onChange={(color) => onPatchPage({ bg: { ...page.bg, color } })} />
            ) : (
              <>
                <Field label="Photo">
                  <select className={input} value={page?.bg?.url || ''} onChange={(e) => onPatchPage({ bg: { ...page.bg, url: e.target.value } })}>
                    <option value="">— none —</option>
                    {assets.map((a, i) => (
                      <option key={a.id} value={a.url}>{a.filename || `Photo ${i + 1}`}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Overlay" hint="Darkens the photo so text stays readable.">
                  <select className={input} value={page?.bg?.overlay || ''} onChange={(e) => onPatchPage({ bg: { ...page.bg, overlay: e.target.value } })}>
                    <option value="">None</option>
                    <option value="linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.65) 100%)">Fade to dark (bottom)</option>
                    <option value="linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.10) 100%)">Fade to dark (top)</option>
                    <option value="rgba(0,0,0,0.35)">Even 35%</option>
                    <option value="rgba(0,0,0,0.55)">Even 55%</option>
                    <option value="linear-gradient(180deg, rgba(8,40,44,0.42) 0%, rgba(8,40,44,0.08) 45%, rgba(8,40,44,0.66) 100%)">Coastal teal veil</option>
                    <option value="linear-gradient(180deg, rgba(6,12,28,0.55) 0%, rgba(6,12,28,0.15) 42%, rgba(6,12,28,0.75) 100%)">Deco midnight veil</option>
                  </select>
                </Field>
              </>
            )}
          </Section>

          <Section title="Page size">
            {/* A preset size change REBUILDS the deck server-side: the layout kit derives
                tile and row sizes from the content box, so portrait and landscape are
                different coordinates, not the same design in a different box. Writing
                pageW/pageH alone would strand every element off the edge. Because the
                rebuild regenerates elements, it lands as a COPY and leaves this brochure
                alone. Custom w/h stays a raw patch — a nudge, not a shape change. */}
            <Field label="Preset" hint="Picking another shape creates a copy at that size. This brochure is left as it is.">
              <select
                className={input}
                value={doc?.size || 'portrait'}
                onChange={(e) => {
                  const key = e.target.value;
                  if (key === 'custom') { onPatchDoc({ size: 'custom' }); return; }
                  onResize(key);
                }}
              >
                {Object.entries(PAGE_SIZES).map(([key, v]) => (
                  <option key={key} value={key}>{v.label}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-x-3">
              <Num
                label="Width"
                value={doc?.pageW}
                min={200}
                max={5000}
                onChange={(pageW) => onPatchDoc({ size: 'custom', pageW })}
                suffix="px"
              />
              <Num
                label="Height"
                value={doc?.pageH}
                min={200}
                max={5000}
                onChange={(pageH) => onPatchDoc({ size: 'custom', pageH })}
                suffix="px"
              />
            </div>
            <p className="-mt-1 mb-3 text-[11px] text-slate-400">
              {pxToMm(doc?.pageW || 0)} × {pxToMm(doc?.pageH || 0)} mm at 96dpi
            </p>
          </Section>

          <Section title="Margins">
            <BoxField label="Page margin" value={doc?.margin} onChange={(margin) => onPatchDoc({ margin })} />
            <button
              type="button"
              onClick={() => onPatchDoc({ margin: { top: toPx(19), right: toPx(18), bottom: toPx(19), left: toPx(18) } })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium transition hover:bg-slate-50"
            >
              Reset to print margins (18/19mm)
            </button>
            <p className="mt-2 text-[11px] text-slate-400">
              Shown as a guide on the canvas. It does not clip — an element may bleed past it
              on purpose.
            </p>
          </Section>
        </>
      )}

      {/* ---------------- Brand ---------------- */}
      {active === 'brand' && (
        <>
          <Section title="Logo">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {fields.logo
                  ? <img src={fields.logo} alt="logo" className="h-full w-full object-contain p-1.5" />
                  : <span className="text-[10px] text-slate-400">None</span>}
              </div>
              <div className="min-w-0 flex-1">
                <label className="block cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-700">
                  {logoUploading ? 'Uploading…' : (fields.logo ? 'Replace logo' : 'Upload logo')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    hidden
                    onChange={(e) => { if (e.target.files?.[0]) onUploadLogo(e.target.files[0]); e.target.value = ''; }}
                  />
                </label>
                {fields.logo && (
                  <button
                    type="button"
                    onClick={() => onPatchFields({ logo: '' })}
                    className="mt-1.5 w-full text-[11px] text-slate-400 transition hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              A transparent PNG works best. It appears on the cover and the closing page.
            </p>
          </Section>

          <Section title="Palette">
            <p className="-mt-2 mb-3 text-[11px] text-slate-400">
              Changing a colour restyles every page at once. Anything you recoloured by hand
              is left alone.
            </p>
            {THEME_SWATCHES.map((s) => (
              <Color
                key={s.key}
                label={s.label}
                value={theme[s.key]}
                onChange={(v) => onRetheme({ [s.key]: v })}
              />
            ))}
          </Section>

          <Section title="Typefaces">
            <Field label="Headings">
              <select className={input} value={theme.fontHeading || ''} onChange={(e) => onRetheme({ fontHeading: e.target.value })}>
                {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Body">
              <select className={input} value={theme.fontBody || ''} onChange={(e) => onRetheme({ fontBody: e.target.value })}>
                {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </Field>
          </Section>

          <Section title="Details">
            {mergeFields.map((f) => (
              <Field key={f.key} label={f.label}>
                {(f.key === 'about' || f.key === 'amenities') ? (
                  <textarea rows={4} className={input} value={fields[f.key] || ''} onChange={(e) => onPatchFields({ [f.key]: e.target.value })} />
                ) : (
                  <input className={input} value={fields[f.key] || ''} onChange={(e) => onPatchFields({ [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
