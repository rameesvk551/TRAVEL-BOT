// FILE: /frontend/src/pages/CatalogItemPage.jsx
// Public detail page for one catalog item.
//   /s/:agencyKey/:type/:slug   (path mode)
//   or /:type/:slug on the agency's own domain (host mode — see App.jsx)
//
// Gallery + full info + a sticky Enquire bar that carries the exact item onto
// the lead the enquiry creates.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../catalog/catalog.css';
import {
  catalogClient,
  themeStyle,
  injectCatalogFonts,
  money,
  typeLabel,
  enquireUrl,
  whatsappUrl,
} from '../catalog/theme';
import {
  ChevronLeftIcon, CheckIcon, MinusIcon, PinIcon, DocIcon, WhatsAppIcon,
} from '../catalog/CatalogIcons';

function List({ title, items, variant }) {
  if (!items || !items.length) return null;
  const Icon = variant === 'exclude' ? MinusIcon : CheckIcon;
  return (
    <div className="cat-block">
      <h3 className="cat-block-title">{title}</h3>
      <div className="cat-list">
        {items.map((raw, i) => {
          const text = typeof raw === 'string' ? raw : (raw?.label || raw?.name || String(raw));
          return (
            <div key={i} className={`cat-list-row ${variant === 'exclude' ? 'cat-exc' : 'cat-inc'}`}>
              <Icon /><span>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chips({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div className="cat-block">
      <h3 className="cat-block-title">{title}</h3>
      <div className="cat-chips">
        {items.map((raw, i) => (
          <span key={i} className="cat-chip">{typeof raw === 'string' ? raw : (raw?.label || raw?.name || String(raw))}</span>
        ))}
      </div>
    </div>
  );
}

function Itinerary({ days }) {
  if (!days || !days.length) return null;
  return (
    <div className="cat-block">
      <h3 className="cat-block-title">Day by day</h3>
      <div style={{ marginTop: 16 }}>
        {days.map((day, i) => (
          <div key={i} className="cat-day">
            <p className="cat-day-num">Day {day.day || i + 1}</p>
            {day.title ? <p className="cat-day-title">{day.title}</p> : null}
            {day.description ? <p className="cat-day-desc">{day.description}</p> : null}
            {Array.isArray(day.activities) && day.activities.length ? (
              <p className="cat-day-desc">{day.activities.join(' · ')}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Facts row, per item type.
function facts(item) {
  const out = [];
  const add = (label, value) => { if (value) out.push({ label, value }); };
  switch (item.type) {
    case 'package':
      add('Duration', item.subtitle?.split(' · ')[0]);
      if (item.destinations?.length) add('Destinations', item.destinations.slice(0, 3).join(', '));
      break;
    case 'property':
      add('Type', item.eyebrow);
      add('Location', item.location);
      break;
    case 'visa':
      add('Processing', item.processingTime);
      add('Validity', item.validityPeriod);
      add('Type', item.visaType);
      break;
    case 'cruise':
      add('Cruise line', item.cruiseLine);
      add('Duration', item.duration);
      add('Departs', item.departurePort);
      break;
    case 'service':
      add('Category', item.eyebrow);
      break;
    default:
      break;
  }
  return out;
}

export default function CatalogItemPage({ agencyKey: agencyKeyProp, basePath: basePathProp }) {
  const params = useParams();
  const agencyKey = agencyKeyProp || params.agencyKey;
  const basePath = basePathProp !== undefined ? basePathProp : `/s/${agencyKey}`;
  const { type, slug } = params;

  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  useEffect(() => { injectCatalogFonts(); }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, error: '' });
    catalogClient
      .get(`/${encodeURIComponent(agencyKey)}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`)
      .then((res) => { if (alive) setState({ status: 'ready', data: res.data.data, error: '' }); })
      .catch((err) => {
        if (!alive) return;
        setState({ status: 'error', data: null, error: err.response?.status === 404 ? 'notfound' : 'error' });
      });
    return () => { alive = false; };
  }, [agencyKey, type, slug]);

  const branding = state.data?.branding;
  const item = state.data?.item;
  const style = useMemo(
    () => themeStyle(branding?.theme, branding?.primaryColor),
    [branding?.theme, branding?.primaryColor],
  );

  useEffect(() => {
    if (item?.name && branding?.name) document.title = `${item.name} — ${branding.name}`;
  }, [item?.name, branding?.name]);

  if (state.status === 'loading') {
    return (
      <div className="cat-root" style={style}>
        <div className="cat-wrap" style={{ paddingTop: 24 }}>
          <div className="cat-skel" style={{ height: '52vh' }} />
          <div className="cat-skel" style={{ height: 40, width: '60%', marginTop: 24, borderRadius: 8 }} />
          <div className="cat-skel" style={{ height: 200, marginTop: 20 }} />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="cat-root" style={style}>
        <div className="cat-center">
          <h1 className="cat-empty-title">{state.error === 'notfound' ? 'Not found' : 'Something went wrong'}</h1>
          <p className="cat-empty-sub">
            {state.error === 'notfound' ? 'This item may have been removed or renamed.' : 'Please try again in a moment.'}
          </p>
          <Link className="cat-btn cat-btn-ghost" to={basePath} style={{ maxWidth: 200 }}>Back to catalog</Link>
        </div>
      </div>
    );
  }

  const gallery = item.gallery && item.gallery.length ? item.gallery : [];
  const factRows = facts(item);
  const description = item.description || item.summary || '';
  const wa = whatsappUrl(
    branding.whatsappNumber || branding.contactPhone,
    `Hi ${branding.name}, I’m interested in “${item.name}”. Please share details.`,
  );

  return (
    <div className="cat-root" style={style}>
      <div className="cat-wrap">
        <Link className="cat-detail-back" to={basePath}>
          <ChevronLeftIcon /> Back to {branding.name}
        </Link>

        {/* Gallery */}
        {gallery.length ? (
          <div className={`cat-gallery ${gallery.length === 1 ? 'cat-gallery-single' : ''}`}>
            {gallery.map((src, i) => <img key={i} src={src} alt={`${item.name} ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />)}
          </div>
        ) : (
          <div className="cat-skel" style={{ height: '38vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="cat-display" style={{ fontSize: 40, color: 'var(--cat-ink-mute)' }}>{item.name?.[0] || 'W'}</span>
          </div>
        )}

        {/* Head */}
        <div className="cat-detail-head">
          <p className="cat-eyebrow">{item.eyebrow || typeLabel(item.type)}</p>
          <h1 className="cat-detail-name cat-display">{item.name}</h1>
          {factRows.length ? (
            <div className="cat-detail-facts">
              {item.type === 'property' && item.location ? (
                <span className="cat-fact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <PinIcon style={{ width: 16, height: 16 }} /> <strong>{item.location}</strong>
                </span>
              ) : null}
              {factRows.map((f) => (
                <span key={f.label} className="cat-fact">{f.label}: <strong>{f.value}</strong></span>
              ))}
            </div>
          ) : null}
        </div>

        {description ? <p className="cat-prose">{description}</p> : null}

        {/* Type-specific blocks */}
        {item.type === 'package' ? <Itinerary days={item.itinerary} /> : null}
        {item.type === 'package' ? <List title="What’s included" items={item.inclusions} /> : null}
        {item.type === 'package' ? <List title="Not included" items={item.exclusions} variant="exclude" /> : null}
        {item.type === 'property' ? <Chips title="Amenities" items={item.amenities} /> : null}
        {item.type === 'service' ? <List title="Highlights" items={item.features} /> : null}
        {item.type === 'cruise' ? <Chips title="Cabin types" items={item.cabinTypes} /> : null}
        {item.type === 'cruise' ? <List title="What’s included" items={item.inclusions} /> : null}
        {item.type === 'cruise' ? <List title="Not included" items={item.exclusions} variant="exclude" /> : null}
        {item.type === 'visa' && item.requiredDocuments?.length ? (
          <div className="cat-block">
            <h3 className="cat-block-title">Required documents</h3>
            <div className="cat-list">
              {item.requiredDocuments.map((doc, i) => (
                <div key={i} className="cat-list-row cat-inc"><DocIcon /><span>{typeof doc === 'string' ? doc : (doc?.label || String(doc))}</span></div>
              ))}
            </div>
          </div>
        ) : null}
        {item.type === 'visa' && item.eligibilityNotes ? (
          <div className="cat-block">
            <h3 className="cat-block-title">Good to know</h3>
            <p className="cat-prose" style={{ marginTop: 12 }}>{item.eligibilityNotes}</p>
          </div>
        ) : null}
        {item.type === 'package' && item.brochureUrl ? (
          <div className="cat-block">
            <a className="cat-btn cat-btn-ghost" href={item.brochureUrl} target="_blank" rel="noreferrer" style={{ maxWidth: 220 }}>
              Download brochure
            </a>
          </div>
        ) : null}
      </div>

      {/* Sticky enquire bar */}
      <div className="cat-enquire-spacer" />
      <div className="cat-enquire-bar">
        <div className="cat-enquire-inner">
          <div className="cat-enquire-price">
            {item.price ? (
              <>
                <span className="amt">{money(item.price)}</span>{' '}
                {item.priceSuffix ? <span className="lbl">{item.priceSuffix}</span> : null}
              </>
            ) : (
              <span className="amt">On request</span>
            )}
          </div>
          <div className="cat-enquire-actions">
            {wa ? (
              <a className="cat-btn cat-btn-ghost" href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <WhatsAppIcon style={{ width: 18, height: 18 }} />
              </a>
            ) : null}
            <Link className="cat-btn cat-btn-accent cat-btn-lg" to={enquireUrl(branding, item)}>Enquire now</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
