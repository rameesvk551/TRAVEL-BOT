// Catalog mini-site design system.
//
// One structure, four moods. Each theme is a bag of CSS custom properties; the
// agency's own brand color is injected as --cat-accent, so no two sites read as
// the same fixed template. The pages reference these vars via catalog.css.

// Display/body font pairings. Loaded on demand (injectCatalogFonts) so the rest
// of the app never pays for them.
const FONTS = {
  fraunces: "'Fraunces', 'Times New Roman', Georgia, serif",
  manrope: "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  grotesk: "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
  inter: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export const CATALOG_THEMES = {
  aurora: {
    label: 'Aurora',
    blurb: 'Airy ivory and soft light. Friendly and premium.',
    swatch: '#FBFAF7',
    dark: false,
    vars: {
      '--cat-bg': '#FBFAF7',
      '--cat-band': '#F3F0E9',
      '--cat-surface': '#FFFFFF',
      '--cat-surface-2': '#F7F5F0',
      '--cat-ink': '#14181C',
      '--cat-ink-soft': '#4B5158',
      '--cat-ink-mute': '#8A9099',
      '--cat-line': 'rgba(20,24,28,0.10)',
      '--cat-radius': '14px',
      '--cat-radius-lg': '24px',
      '--cat-card-shadow': '0 18px 44px -24px rgba(20,24,28,0.28)',
      '--cat-hero-scrim': 'linear-gradient(180deg, rgba(8,10,12,0) 26%, rgba(8,10,12,0.28) 55%, rgba(8,10,12,0.82) 100%)',
      '--cat-font-display': FONTS.fraunces,
      '--cat-font-body': FONTS.manrope,
    },
  },
  midnight: {
    label: 'Midnight',
    blurb: 'Cinematic dark with glass panels. Luxury and resort.',
    swatch: '#0B0D10',
    dark: true,
    vars: {
      '--cat-bg': '#0B0D10',
      '--cat-band': '#101318',
      '--cat-surface': '#14181D',
      '--cat-surface-2': '#191E24',
      '--cat-ink': '#F4F6F8',
      '--cat-ink-soft': '#B7BFC8',
      '--cat-ink-mute': '#79828C',
      '--cat-line': 'rgba(255,255,255,0.12)',
      '--cat-radius': '14px',
      '--cat-radius-lg': '22px',
      '--cat-card-shadow': '0 30px 60px -30px rgba(0,0,0,0.75)',
      '--cat-hero-scrim': 'linear-gradient(180deg, rgba(4,5,7,0.15) 0%, rgba(4,5,7,0.35) 50%, rgba(4,5,7,0.92) 100%)',
      '--cat-font-display': FONTS.fraunces,
      '--cat-font-body': FONTS.manrope,
    },
  },
  coast: {
    label: 'Coast',
    blurb: 'Warm sand and calm greens. Relaxed and coastal.',
    swatch: '#F5F1E8',
    dark: false,
    vars: {
      '--cat-bg': '#F5F1E8',
      '--cat-band': '#EDE7D9',
      '--cat-surface': '#FFFDF8',
      '--cat-surface-2': '#F6F1E6',
      '--cat-ink': '#1C2B2D',
      '--cat-ink-soft': '#4A5A5A',
      '--cat-ink-mute': '#8B968F',
      '--cat-line': 'rgba(28,43,45,0.12)',
      '--cat-radius': '18px',
      '--cat-radius-lg': '28px',
      '--cat-card-shadow': '0 20px 46px -26px rgba(28,43,45,0.30)',
      '--cat-hero-scrim': 'linear-gradient(180deg, rgba(10,20,20,0) 24%, rgba(10,20,20,0.30) 56%, rgba(10,20,20,0.80) 100%)',
      '--cat-font-display': FONTS.fraunces,
      '--cat-font-body': FONTS.manrope,
    },
  },
  terra: {
    label: 'Terra',
    blurb: 'Editorial, warm paper, sharp edges. Adventure and modern.',
    swatch: '#F4EEE6',
    dark: false,
    vars: {
      '--cat-bg': '#F4EEE6',
      '--cat-band': '#EAE1D4',
      '--cat-surface': '#FFFFFF',
      '--cat-surface-2': '#F5EFE7',
      '--cat-ink': '#211A14',
      '--cat-ink-soft': '#5A4F45',
      '--cat-ink-mute': '#93887A',
      '--cat-line': 'rgba(33,26,20,0.14)',
      '--cat-radius': '6px',
      '--cat-radius-lg': '10px',
      '--cat-card-shadow': '0 16px 40px -26px rgba(33,26,20,0.34)',
      '--cat-hero-scrim': 'linear-gradient(180deg, rgba(20,14,8,0) 22%, rgba(20,14,8,0.28) 54%, rgba(20,14,8,0.84) 100%)',
      '--cat-font-display': FONTS.grotesk,
      '--cat-font-body': FONTS.inter,
    },
  },
};

export function resolveTheme(name) {
  return CATALOG_THEMES[String(name || '').toLowerCase()] || CATALOG_THEMES.aurora;
}

// Readable text color for filled accent buttons/chips: white on dark brand
// colors, near-black on very light ones.
export function contrastInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#ffffff';
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  // Perceived luminance (sRGB-ish).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#14181C' : '#ffffff';
}

// The inline-style var bag applied to the catalog root.
export function themeStyle(themeName, brandColor) {
  const theme = resolveTheme(themeName);
  const accent = /^#[0-9a-f]{6}$/i.test(String(brandColor || '')) ? brandColor : '#00A884';
  return {
    ...theme.vars,
    '--cat-accent': accent,
    '--cat-accent-ink': contrastInk(accent),
    background: 'var(--cat-bg)',
    color: 'var(--cat-ink)',
    fontFamily: 'var(--cat-font-body)',
  };
}

let fontsInjected = false;
export function injectCatalogFonts() {
  if (fontsInjected || typeof document === 'undefined') return;
  fontsInjected = true;
  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = 'anonymous';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href =
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap';
  document.head.append(pre1, pre2, css);
}

// ── Public API client (mirrors LeadFormPage: NOT the auth client). ────────────
import axios from 'axios';

const PUBLIC_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api\/?$/, '') || '';
export const catalogClient = axios.create({
  baseURL: `${PUBLIC_BASE}/public`,
  headers: { 'Content-Type': 'application/json' },
});

// ── Formatting + link helpers ────────────────────────────────────────────────

export function money(rupees, suffix) {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n <= 0) return 'On request';
  const formatted = `₹${n.toLocaleString('en-IN')}`;
  return suffix ? `${formatted} ${suffix}` : formatted;
}

const TYPE_LABEL = {
  package: 'Tours',
  property: 'Stays',
  service: 'Services',
  visa: 'Visas',
  cruise: 'Cruises',
};
export const typeLabel = (t) => TYPE_LABEL[t] || t;

// Enquire link → the agency's lead form, with the tapped item pre-bound.
export function enquireUrl(branding, item) {
  const base = branding?.leadFormPath || '';
  const params = new URLSearchParams({ source: 'catalog' });
  if (item?.token) params.set('item', item.token);
  return `${base}?${params.toString()}`;
}

const digits = (v) => String(v || '').replace(/[^\d]/g, '');

export function telUrl(phone) {
  const d = digits(phone);
  return d ? `tel:+${d}` : '';
}

export function whatsappUrl(number, text) {
  const d = digits(number);
  if (!d) return '';
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${d}${q}`;
}

// Build + download a vCard so a visitor saves the agency to their contacts —
// the "Save Contact" behavior from the digital-card reference.
export function downloadVCard(branding) {
  const name = branding?.name || 'Travel Agency';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${name}`,
  ];
  if (branding?.contactPhone) lines.push(`TEL;TYPE=CELL:${branding.contactPhone}`);
  if (branding?.whatsappNumber && branding.whatsappNumber !== branding.contactPhone) {
    lines.push(`TEL;TYPE=WhatsApp:${branding.whatsappNumber}`);
  }
  if (branding?.contactEmail) lines.push(`EMAIL:${branding.contactEmail}`);
  if (typeof window !== 'undefined') lines.push(`URL:${window.location.origin}${window.location.pathname}`);
  if (branding?.logoUrl) lines.push(`PHOTO;VALUE=URI:${branding.logoUrl}`);
  lines.push('END:VCARD');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Native share sheet, with a copy-link fallback. Returns 'shared' | 'copied' | ''.
export async function shareCurrent(title, text) {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  if (!url) return '';
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }
  } catch (_err) {
    return '';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (_err) {
    return '';
  }
}
