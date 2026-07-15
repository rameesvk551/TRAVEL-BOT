// FILE: /frontend/src/pages/CatalogPage.jsx
// Public, unauthenticated catalog mini-site for one agency.
//   /s/:agencyKey                         (path mode)
//   or rendered at "/" on the agency's own domain (host mode — see App.jsx)
//
// Live data from /public/:agencyKey/catalog. No auth client (that 401-redirects).
// One structure, themed per agency; the agency's brand color is the accent.

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
  telUrl,
  whatsappUrl,
  downloadVCard,
  shareCurrent,
} from '../catalog/theme';
import { PhoneIcon, WhatsAppIcon, SaveIcon, ShareIcon } from '../catalog/CatalogIcons';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'W';
}

function ItemCard({ item, basePath, branding }) {
  return (
    <article className="cat-card">
      <div className="cat-card-media">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} loading="lazy" />
          : <div className="cat-card-media-empty">{initials(item.name)}</div>}
        {item.eyebrow ? <span className="cat-tag">{item.eyebrow}</span> : null}
        {item.price ? <span className="cat-price-chip">{money(item.price)}</span> : null}
      </div>
      <div className="cat-card-body">
        <h3 className="cat-card-name cat-display">{item.name}</h3>
        {item.subtitle ? <p className="cat-card-sub">{item.subtitle}</p> : null}
        {item.summary ? <p className="cat-card-summary">{item.summary}</p> : null}
        <div className="cat-card-actions">
          <Link className="cat-btn cat-btn-ghost" to={`${basePath}/${item.type}/${item.slug}`}>
            More details
          </Link>
          <Link className="cat-btn cat-btn-accent" to={enquireUrl(branding, item)}>
            Enquire
          </Link>
        </div>
      </div>
    </article>
  );
}

function ActionDock({ branding, onToast }) {
  const tel = telUrl(branding.contactPhone);
  const wa = whatsappUrl(branding.whatsappNumber || branding.contactPhone, `Hi ${branding.name}, I found your catalog and would like to know more.`);
  const hasContact = tel || wa || branding.contactPhone || branding.contactEmail;
  if (!hasContact) return null;

  const share = async () => {
    const result = await shareCurrent(branding.name, branding.tagline || '');
    if (result === 'copied') onToast('Link copied');
  };

  return (
    <>
      <div className="cat-dock-spacer" />
      <nav className="cat-dock" aria-label="Contact actions">
        {tel ? (
          <a className="cat-dock-btn" href={tel}><PhoneIcon /><span>Call</span></a>
        ) : null}
        {wa ? (
          <a className="cat-dock-btn" data-accent="true" href={wa} target="_blank" rel="noreferrer">
            <WhatsAppIcon /><span>WhatsApp</span>
          </a>
        ) : null}
        <button className="cat-dock-btn" type="button" onClick={() => { downloadVCard(branding); onToast('Contact saved'); }}>
          <SaveIcon /><span>Save</span>
        </button>
        <button className="cat-dock-btn" type="button" onClick={share}>
          <ShareIcon /><span>Share</span>
        </button>
      </nav>
    </>
  );
}

function LoadingState({ style }) {
  return (
    <div className="cat-root" style={style}>
      <div className="cat-skel" style={{ height: '78vh', borderRadius: 0 }} />
      <div className="cat-wrap" style={{ paddingTop: 40 }}>
        <div className="cat-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="cat-skel" style={{ height: 300 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage({ agencyKey: agencyKeyProp, basePath: basePathProp }) {
  const params = useParams();
  const agencyKey = agencyKeyProp || params.agencyKey;
  const basePath = basePathProp !== undefined ? basePathProp : `/s/${agencyKey}`;

  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [active, setActive] = useState('all');
  const [toast, setToast] = useState('');

  useEffect(() => { injectCatalogFonts(); }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, error: '' });
    catalogClient
      .get(`/${encodeURIComponent(agencyKey)}/catalog`)
      .then((res) => {
        if (!alive) return;
        setState({ status: 'ready', data: res.data.data, error: '' });
      })
      .catch((err) => {
        if (!alive) return;
        const code = err.response?.status;
        setState({ status: 'error', data: null, error: code === 404 ? 'notfound' : 'error' });
      });
    return () => { alive = false; };
  }, [agencyKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const branding = state.data?.branding;
  const sections = state.data?.sections || [];

  const style = useMemo(
    () => themeStyle(branding?.theme, branding?.primaryColor),
    [branding?.theme, branding?.primaryColor],
  );

  useEffect(() => {
    if (branding?.name) {
      document.title = branding.seo?.title || `${branding.name} — Catalog`;
    }
  }, [branding?.name, branding?.seo?.title]);

  if (state.status === 'loading') return <LoadingState style={style} />;

  if (state.status === 'error') {
    return (
      <div className="cat-root" style={style}>
        <div className="cat-center">
          <h1 className="cat-empty-title">
            {state.error === 'notfound' ? 'Catalog not found' : 'Something went wrong'}
          </h1>
          <p className="cat-empty-sub">
            {state.error === 'notfound'
              ? 'This catalog is not available. The link may be wrong or the site is not published yet.'
              : 'Please check your connection and try again.'}
          </p>
        </div>
      </div>
    );
  }

  const visible = active === 'all' ? sections : sections.filter((s) => s.type === active);
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="cat-root" style={style}>
      {/* Hero */}
      <header className="cat-hero">
        <div className="cat-hero-media">
          {branding.heroImageUrl ? <img src={branding.heroImageUrl} alt="" /> : null}
        </div>
        <div className="cat-hero-scrim" />
        <div className="cat-hero-inner">
          {branding.logoUrl
            ? <img className="cat-hero-seal" src={branding.logoUrl} alt={branding.name} />
            : <span className="cat-hero-seal">{initials(branding.name)}</span>}
          <h1 className="cat-hero-name cat-display">{branding.name}</h1>
          {branding.tagline ? <p className="cat-hero-tagline">{branding.tagline}</p> : null}
          <div className="cat-hero-meta">
            {sections.map((s) => (
              <span key={s.type} className="cat-hero-chip">{s.items.length} {typeLabel(s.type)}</span>
            ))}
          </div>
        </div>
      </header>

      {/* Sticky filter rail */}
      {sections.length > 1 ? (
        <div className="cat-rail">
          <div className="cat-rail-inner">
            <button className="cat-pill" data-active={active === 'all'} onClick={() => setActive('all')}>
              All<span className="cat-pill-count">{totalItems}</span>
            </button>
            {sections.map((s) => (
              <button
                key={s.type}
                className="cat-pill"
                data-active={active === s.type}
                onClick={() => setActive(s.type)}
              >
                {typeLabel(s.type)}<span className="cat-pill-count">{s.items.length}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sections */}
      <main className="cat-wrap">
        {totalItems === 0 ? (
          <div className="cat-center">
            <h2 className="cat-empty-title">Coming soon</h2>
            <p className="cat-empty-sub">New trips and stays are being added. Reach out and we’ll help you plan.</p>
          </div>
        ) : (
          visible.map((section) => (
            <section key={section.type} className="cat-section">
              <div className="cat-section-head">
                <div>
                  <p className="cat-eyebrow">{typeLabel(section.type)}</p>
                  <h2 className="cat-section-title cat-display">{typeLabel(section.type)}</h2>
                </div>
              </div>
              <div className="cat-grid">
                {section.items.map((item) => (
                  <ItemCard key={`${item.type}-${item.id}`} item={item} basePath={basePath} branding={branding} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="cat-footer">
        <div className="cat-footer-inner">
          <p className="cat-footer-name">{branding.name}</p>
          <div className="cat-footer-links">
            {branding.contactPhone ? <a href={telUrl(branding.contactPhone)}>{branding.contactPhone}</a> : null}
            {branding.contactEmail ? <a href={`mailto:${branding.contactEmail}`}>{branding.contactEmail}</a> : null}
            {branding.social?.instagram ? <a href={branding.social.instagram} target="_blank" rel="noreferrer">Instagram</a> : null}
            {branding.social?.facebook ? <a href={branding.social.facebook} target="_blank" rel="noreferrer">Facebook</a> : null}
            {branding.social?.youtube ? <a href={branding.social.youtube} target="_blank" rel="noreferrer">YouTube</a> : null}
          </div>
        </div>
      </footer>

      <ActionDock branding={branding} onToast={setToast} />

      {toast ? (
        <div style={{
          position: 'fixed', bottom: 108, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: 'var(--cat-ink)', color: 'var(--cat-bg)', padding: '10px 16px',
          borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      ) : null}
    </div>
  );
}
