import { FONTS } from '../../utils/brochureDoc';

function Row({ label, children }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const input = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <Row label={label}>
      <input
        type="number"
        className={input}
        value={value ?? 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Row>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border border-slate-300"
          value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#111827'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input className={input} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Row>
  );
}

/**
 * Right-hand panel. Shows the selected element's properties, or — when nothing is
 * selected — the page background and the brochure's merge fields.
 *
 * Merge fields are the reuse mechanism: a text element bound to `property_name`
 * takes its content from here, so applying this design to the next resort is a
 * matter of retyping one field rather than hunting for the text on the page.
 */
export default function BrochureInspector({
  element, page, fields, mergeFields, assets,
  onPatchElement, onPatchPage, onPatchFields, onDeleteElement, onReorder,
}) {
  if (!element) {
    return (
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Page background</h3>

          <Row label="Type">
            <select
              className={input}
              value={page?.bg?.type || 'color'}
              onChange={(e) => onPatchPage({
                bg: e.target.value === 'image'
                  ? { type: 'image', url: '', slot: '', overlay: '', fit: 'cover' }
                  : { type: 'color', color: '#ffffff' },
              })}
            >
              <option value="color">Solid colour</option>
              <option value="image">Full-bleed photo</option>
            </select>
          </Row>

          {page?.bg?.type === 'color' ? (
            <ColorField
              label="Colour"
              value={page.bg.color}
              onChange={(color) => onPatchPage({ bg: { ...page.bg, color } })}
            />
          ) : (
            <>
              <Row label="Photo">
                <select
                  className={input}
                  value={page?.bg?.url || ''}
                  onChange={(e) => onPatchPage({ bg: { ...page.bg, url: e.target.value } })}
                >
                  <option value="">— none —</option>
                  {assets.map((a, i) => (
                    <option key={a.id} value={a.url}>{a.filename || `Photo ${i + 1}`}</option>
                  ))}
                </select>
              </Row>
              <Row label="Darkening overlay">
                <select
                  className={input}
                  value={page?.bg?.overlay || ''}
                  onChange={(e) => onPatchPage({ bg: { ...page.bg, overlay: e.target.value } })}
                >
                  <option value="">None</option>
                  <option value="linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.65) 100%)">
                    Fade to dark (bottom)
                  </option>
                  <option value="rgba(0,0,0,0.35)">Even 35%</option>
                  <option value="rgba(0,0,0,0.55)">Even 55%</option>
                </select>
              </Row>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Brochure details</h3>
          <p className="mb-3 text-xs text-slate-500">
            Text boxes bound to a field update automatically when you edit it here.
          </p>
          {mergeFields.map((f) => (
            <Row key={f.key} label={f.label}>
              {f.key === 'about' || f.key === 'amenities' ? (
                <textarea
                  rows={4}
                  className={input}
                  value={fields[f.key] || ''}
                  onChange={(e) => onPatchFields({ [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className={input}
                  value={fields[f.key] || ''}
                  onChange={(e) => onPatchFields({ [f.key]: e.target.value })}
                />
              )}
            </Row>
          ))}
        </section>
      </div>
    );
  }

  const patch = onPatchElement;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-slate-900">{element.type}</h3>
        <button
          type="button"
          onClick={onDeleteElement}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <NumberField label="X" value={element.x} onChange={(x) => patch({ x })} />
        <NumberField label="Y" value={element.y} onChange={(y) => patch({ y })} />
        <NumberField label="Width" value={element.w} onChange={(w) => patch({ w: Math.max(8, w) })} />
        <NumberField label="Height" value={element.h} onChange={(h) => patch({ h: Math.max(8, h) })} />
        <NumberField label="Rotation" value={element.rotate} min={-360} max={360} onChange={(rotate) => patch({ rotate })} />
        <NumberField label="Opacity" value={element.opacity ?? 1} min={0} max={1} step={0.05} onChange={(opacity) => patch({ opacity })} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => onReorder('front')} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50">
          Bring to front
        </button>
        <button type="button" onClick={() => onReorder('back')} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50">
          Send to back
        </button>
      </div>

      {element.type === 'text' && (
        <section>
          <Row label="Text">
            <textarea rows={3} className={input} value={element.text} onChange={(e) => patch({ text: e.target.value })} />
          </Row>

          <Row label="Bind to a brochure field">
            <select className={input} value={element.field || ''} onChange={(e) => patch({ field: e.target.value })}>
              <option value="">— fixed text —</option>
              {mergeFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Row>

          <Row label="Font">
            <select className={input} value={element.font} onChange={(e) => patch({ font: e.target.value })}>
              {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Row>

          <div className="grid grid-cols-2 gap-x-3">
            <NumberField label="Size" value={element.size} min={6} max={400} onChange={(size) => patch({ size })} />
            <NumberField label="Weight" value={element.weight} min={100} max={900} step={100} onChange={(weight) => patch({ weight })} />
            <NumberField label="Line height" value={element.lineHeight} min={0.6} max={4} step={0.05} onChange={(lineHeight) => patch({ lineHeight })} />
            <NumberField label="Letter spacing" value={element.letterSpacing} min={-20} max={40} onChange={(letterSpacing) => patch({ letterSpacing })} />
          </div>

          <ColorField label="Colour" value={element.color} onChange={(color) => patch({ color })} />

          <Row label="Align">
            <div className="flex gap-1">
              {['left', 'center', 'right'].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => patch({ align: a })}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize ${
                    element.align === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Row>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!element.uppercase} onChange={(e) => patch({ uppercase: e.target.checked })} />
            Uppercase
          </label>
        </section>
      )}

      {element.type === 'image' && (
        <section>
          <Row label="Photo">
            <select className={input} value={element.url || ''} onChange={(e) => patch({ url: e.target.value })}>
              <option value="">— empty slot —</option>
              {assets.map((a, i) => (
                <option key={a.id} value={a.url}>{a.filename || `Photo ${i + 1}`}</option>
              ))}
            </select>
          </Row>
          <p className="-mt-1 mb-3 text-xs text-slate-500">Or drag a photo from the tray onto this box.</p>

          <Row label="Fit">
            <select className={input} value={element.fit} onChange={(e) => patch({ fit: e.target.value })}>
              <option value="cover">Cover (fill, may crop)</option>
              <option value="contain">Contain (whole photo)</option>
              <option value="fill">Stretch</option>
            </select>
          </Row>

          <NumberField label="Corner radius" value={element.radius} min={0} max={400} onChange={(radius) => patch({ radius })} />

          <Row label="Refill slot">
            <input
              className={input}
              placeholder="e.g. photo_3"
              value={element.slot || ''}
              onChange={(e) => patch({ slot: e.target.value })}
            />
          </Row>
          <p className="-mt-2 text-xs text-slate-500">
            Named slots refill automatically when this design is reused as a template.
          </p>
        </section>
      )}

      {element.type === 'shape' && (
        <section>
          <Row label="Shape">
            <select className={input} value={element.shape} onChange={(e) => patch({ shape: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
            </select>
          </Row>
          <ColorField label="Fill" value={element.fill} onChange={(fill) => patch({ fill })} />
          <NumberField label="Corner radius" value={element.radius} min={0} max={400} onChange={(radius) => patch({ radius })} />
          <ColorField label="Border colour" value={element.stroke} onChange={(stroke) => patch({ stroke })} />
          <NumberField label="Border width" value={element.strokeWidth} min={0} max={40} onChange={(strokeWidth) => patch({ strokeWidth })} />
        </section>
      )}
    </div>
  );
}
