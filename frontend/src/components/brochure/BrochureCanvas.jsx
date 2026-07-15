import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cdnUrl, elementStyle, imageStyle, imageInnerStyle, imageNeedsWrapper, imageWrapperStyle,
  normalizeBox, shapeStyle, textStyle, PRINT_IMAGE_WIDTH,
} from '../../utils/brochureDoc';
import { ICONS, DEFAULT_ICON } from '../../utils/brochureIcons';

// Nudge/snap step. Holding Shift while dragging or resizing disables snapping.
const GRID = 8;
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const snap = (value, enabled) => (enabled ? Math.round(value / GRID) * GRID : Math.round(value));

/**
 * The brochure page canvas.
 *
 * Elements are real, absolutely-positioned DOM nodes styled by the shared
 * brochureDoc helpers — the same helpers the server uses to render the page for
 * Puppeteer. Dragging moves the node; there is no canvas bitmap and no separate
 * print representation, so what is on screen is what prints.
 *
 * `scale` shrinks the page to fit the viewport via a CSS transform. All pointer
 * deltas are divided by it, so editing at 40% zoom still writes exact document
 * coordinates.
 */
export default function BrochureCanvas({
  doc, page, scale, selectedId, onSelect, onChangeElements, onChangePage,
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [editingId, setEditingId] = useState(null);

  const elements = page?.elements || [];
  const selected = elements.find((el) => el.id === selectedId) || null;

  const patchElement = useCallback((id, patch) => {
    onChangeElements(elements.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }, [elements, onChangeElements]);

  // --- pointer drag / resize / rotate ---------------------------------------

  const beginDrag = (event, element, mode) => {
    if (element.locked) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect(element.id);

    const stage = stageRef.current.getBoundingClientRect();
    dragRef.current = {
      mode,
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...element },
      centre: {
        x: stage.left + (element.x + element.w / 2) * scale,
        y: stage.top + (element.y + element.h / 2) * scale,
      },
    };
  };

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;

      const snapping = !event.shiftKey;
      const dx = (event.clientX - drag.startX) / scale;
      const dy = (event.clientY - drag.startY) / scale;
      const o = drag.origin;

      if (drag.mode === 'move') {
        patchElement(drag.id, { x: snap(o.x + dx, snapping), y: snap(o.y + dy, snapping) });
        return;
      }

      if (drag.mode === 'rotate') {
        const angle = Math.atan2(event.clientY - drag.centre.y, event.clientX - drag.centre.x);
        let deg = (angle * 180) / Math.PI + 90;
        if (snapping) deg = Math.round(deg / 15) * 15;
        patchElement(drag.id, { rotate: Math.round(deg) });
        return;
      }

      // Resize. Each handle moves the edges it touches; the opposite edge is fixed.
      const dir = drag.mode;
      let { x, y, w, h } = o;
      if (dir.includes('e')) w = o.w + dx;
      if (dir.includes('s')) h = o.h + dy;
      if (dir.includes('w')) { w = o.w - dx; x = o.x + dx; }
      if (dir.includes('n')) { h = o.h - dy; y = o.y + dy; }

      // Clamp before snapping so a collapsed edge can't invert the box.
      w = Math.max(GRID, w);
      h = Math.max(GRID, h);

      patchElement(drag.id, {
        x: snap(x, snapping), y: snap(y, snapping),
        w: snap(w, snapping), h: snap(h, snapping),
      });
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scale, patchElement]);

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKey = (event) => {
      if (!selected || editingId) return;
      const target = event.target;
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onChangeElements(elements.filter((el) => el.id !== selected.id));
        onSelect(null);
        return;
      }

      const step = event.shiftKey ? 1 : GRID;
      const moves = {
        ArrowLeft: { x: selected.x - step }, ArrowRight: { x: selected.x + step },
        ArrowUp: { y: selected.y - step }, ArrowDown: { y: selected.y + step },
      };
      if (moves[event.key]) {
        event.preventDefault();
        patchElement(selected.id, moves[event.key]);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, elements, editingId, onSelect, onChangeElements, patchElement]);

  // --- drop a tray photo onto the page --------------------------------------

  const onDrop = (event) => {
    event.preventDefault();
    const url = event.dataTransfer.getData('text/brochure-image');
    if (!url) return;

    const stage = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - stage.left) / scale;
    const y = (event.clientY - stage.top) / scale;

    // If dropped onto an existing image element, swap that photo instead of adding
    // a new one — this is how a designer replaces a slot's picture.
    const hit = [...elements]
      .sort((a, b) => b.z - a.z)
      .find((el) => el.type === 'image' && x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h);

    if (hit) {
      patchElement(hit.id, { url });
      onSelect(hit.id);
      return;
    }

    const topZ = elements.reduce((max, el) => Math.max(max, el.z || 1), 0);
    const element = {
      id: `i${Date.now().toString(36)}`,
      type: 'image', url, slot: '',
      x: snap(x - 160, true), y: snap(y - 110, true), w: 320, h: 220,
      rotate: 0, z: topZ + 1, opacity: 1, fit: 'cover', radius: 8,
    };
    onChangeElements([...elements, element]);
    onSelect(element.id);
  };

  // --- render ---------------------------------------------------------------

  const renderElement = (el) => {
    const common = {
      key: el.id,
      onPointerDown: (event) => beginDrag(event, el, 'move'),
      onDoubleClick: el.type === 'text' ? () => setEditingId(el.id) : undefined,
    };

    if (el.type === 'image') {
      if (!el.url) {
        const label = el.field === 'logo' ? 'Upload a logo' : (el.slot ? 'Drop a photo' : 'Empty');
        return (
          <div
            {...common}
            style={{ ...imageStyle(el), cursor: 'move', backgroundColor: el.background || '#e5e7eb' }}
            className="flex items-center justify-center border-2 border-dashed border-slate-400/60"
          >
            <span className="px-1 text-center text-[10px] font-medium text-slate-500">{label}</span>
          </div>
        );
      }

      const src = cdnUrl(el.url, el.field === 'logo' ? 600 : PRINT_IMAGE_WIDTH);

      // A padded image is wrapped, exactly as the PDF renderer does it — padding on a
      // bare <img> grows the box instead of insetting the picture.
      if (imageNeedsWrapper(el)) {
        return (
          <div {...common} style={{ ...imageWrapperStyle(el), cursor: 'move' }}>
            <img src={src} alt="" draggable={false} style={imageInnerStyle(el)} />
          </div>
        );
      }

      return (
        <img
          {...common}
          src={src}
          alt=""
          draggable={false}
          style={{ ...imageStyle(el), cursor: 'move' }}
        />
      );
    }

    if (el.type === 'text') {
      if (editingId === el.id) {
        return (
          <textarea
            key={el.id}
            autoFocus
            value={el.text}
            onChange={(event) => patchElement(el.id, { text: event.target.value })}
            onBlur={() => setEditingId(null)}
            style={{ ...textStyle(el), outline: '2px solid #2563eb', resize: 'none', background: 'transparent' }}
          />
        );
      }
      return (
        <div {...common} style={{ ...textStyle(el), cursor: 'move' }}>
          {el.text}
        </div>
      );
    }

    if (el.type === 'icon') {
      const def = ICONS[el.icon] || ICONS[DEFAULT_ICON];
      return (
        <svg
          {...common}
          viewBox="0 0 24 24"
          fill="none"
          stroke={el.color || '#111'}
          strokeWidth={el.strokeWidth || 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ ...elementStyle(el), overflow: 'visible', cursor: 'move' }}
          dangerouslySetInnerHTML={{ __html: def.body }}
        />
      );
    }

    return <div {...common} style={{ ...shapeStyle(el), cursor: 'move' }} />;
  };

  const bg = page?.bg || { type: 'color', color: '#ffffff' };

  return (
    <div
      className="relative shadow-2xl ring-1 ring-slate-900/10"
      style={{ width: doc.pageW * scale, height: doc.pageH * scale }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div
        ref={stageRef}
        className="absolute left-0 top-0 origin-top-left overflow-hidden"
        style={{
          width: doc.pageW,
          height: doc.pageH,
          transform: `scale(${scale})`,
          backgroundColor: bg.type === 'color' ? bg.color : '#ffffff',
        }}
        onPointerDown={() => onSelect(null)}
      >
        {bg.type === 'image' && bg.url && (
          <img
            src={cdnUrl(bg.url, PRINT_IMAGE_WIDTH)}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: doc.pageW, height: doc.pageH,
              objectFit: bg.fit || 'cover', zIndex: 0,
            }}
          />
        )}
        {bg.type === 'image' && bg.overlay && (
          <div
            style={{
              position: 'absolute', left: 0, top: 0,
              width: doc.pageW, height: doc.pageH,
              background: bg.overlay, zIndex: 0,
            }}
          />
        )}

        {/* Margin guide. Screen-only — it is not an element, so it never prints. */}
        {(() => {
          const m = normalizeBox(doc.margin);
          if (!(m.top || m.right || m.bottom || m.left)) return null;
          return (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: m.left,
                top: m.top,
                width: doc.pageW - m.left - m.right,
                height: doc.pageH - m.top - m.bottom,
                border: `${1 / scale}px dashed rgba(37,99,235,0.35)`,
                pointerEvents: 'none',
                zIndex: 997,
              }}
            />
          );
        })()}

        {[...elements].sort((a, b) => (a.z || 1) - (b.z || 1)).map(renderElement)}

        {selected && !selected.locked && (
          <div
            style={{
              ...elementStyle(selected),
              zIndex: 998,
              pointerEvents: 'none',
              outline: `${2 / scale}px solid #2563eb`,
            }}
          >
            <div
              onPointerDown={(event) => beginDrag(event, selected, 'rotate')}
              className="absolute rounded-full bg-blue-600"
              style={{
                width: 12 / scale, height: 12 / scale,
                left: '50%', top: -28 / scale,
                marginLeft: -6 / scale,
                pointerEvents: 'auto', cursor: 'grab',
              }}
            />
            {HANDLES.map((dir) => {
              const pos = {
                left: dir.includes('w') ? 0 : (dir.includes('e') ? '100%' : '50%'),
                top: dir.includes('n') ? 0 : (dir.includes('s') ? '100%' : '50%'),
              };
              return (
                <div
                  key={dir}
                  onPointerDown={(event) => beginDrag(event, selected, dir)}
                  className="absolute border border-blue-600 bg-white"
                  style={{
                    ...pos,
                    width: 10 / scale, height: 10 / scale,
                    marginLeft: -5 / scale, marginTop: -5 / scale,
                    pointerEvents: 'auto',
                    cursor: `${dir}-resize`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
