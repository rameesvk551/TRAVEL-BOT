import {
  cdnUrl, elementStyle, imageStyle, imageInnerStyle, imageNeedsWrapper, imageWrapperStyle,
  shapeStyle, textStyle, THUMB_IMAGE_WIDTH,
} from '../../utils/brochureDoc';
import { ICONS, DEFAULT_ICON } from '../../utils/brochureIcons';

/**
 * A non-interactive, scaled thumbnail of one page — the same style helpers the editor
 * and the PDF renderer use, so it is a faithful miniature rather than an approximation.
 *
 * Used by the preset picker (to show the customer's own photos in every design) and by
 * the editor's page rail. `scale` shrinks a full-size page via a CSS transform.
 */
export default function BrochurePagePreview({ doc, page, scale, imageWidth = THUMB_IMAGE_WIDTH }) {
  const bg = page?.bg || { type: 'color', color: '#ffffff' };

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: doc.pageW * scale, height: doc.pageH * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: doc.pageW,
          height: doc.pageH,
          transform: `scale(${scale})`,
          backgroundColor: bg.type === 'color' ? bg.color : '#ffffff',
        }}
      >
        {bg.type === 'image' && bg.url && (
          <img
            src={cdnUrl(bg.url, imageWidth)}
            alt=""
            style={{ position: 'absolute', inset: 0, width: doc.pageW, height: doc.pageH, objectFit: bg.fit || 'cover', zIndex: 0 }}
          />
        )}
        {bg.type === 'image' && bg.overlay && (
          <div style={{ position: 'absolute', inset: 0, width: doc.pageW, height: doc.pageH, background: bg.overlay, zIndex: 0 }} />
        )}

        {[...(page?.elements || [])].sort((a, b) => (a.z || 1) - (b.z || 1)).map((el) => {
          if (el.type === 'image') {
            if (!el.url) return <div key={el.id} style={{ ...imageStyle(el), background: el.background || '#e5e7eb' }} />;
            const src = cdnUrl(el.url, imageWidth);
            if (imageNeedsWrapper(el)) {
              return (
                <div key={el.id} style={imageWrapperStyle(el)}>
                  <img src={src} alt="" style={imageInnerStyle(el)} />
                </div>
              );
            }
            return <img key={el.id} src={src} alt="" style={imageStyle(el)} />;
          }
          if (el.type === 'text') return <div key={el.id} style={textStyle(el)}>{el.text}</div>;
          if (el.type === 'icon') {
            const def = ICONS[el.icon] || ICONS[DEFAULT_ICON];
            return (
              <svg
                key={el.id}
                viewBox="0 0 24 24"
                fill="none"
                stroke={el.color || '#111'}
                strokeWidth={el.strokeWidth || 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ ...elementStyle(el), overflow: 'visible' }}
                dangerouslySetInnerHTML={{ __html: def.body }}
              />
            );
          }
          return <div key={el.id} style={shapeStyle(el)} />;
        })}
      </div>
    </div>
  );
}
