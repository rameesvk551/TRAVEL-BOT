// FILE: /backend/src/services/brochurePdfService.ts
// DEPS: puppeteer
//
// Renders a brochure `doc` to PDF. The HTML handed to Puppeteer is produced by
// brochureDoc.renderDocHtml — the same markup the React editor renders — so the PDF
// is a byte-for-byte reflection of what the designer saw.

const puppeteer = require('puppeteer');
const brochureDoc = require('./brochureDoc');

// A 30-photo deck fetches 30 Cloudinary derivatives plus a webfont stylesheet, so
// the default 30s navigation budget is too tight. Derivatives are ~200 KB each
// (cdnUrl caps them at w_1600, f_auto), which keeps this comfortably under the cap.
const RENDER_TIMEOUT_MS = 120000;

/**
 * @param {object} doc - a filled brochure doc
 * @returns {Promise<Buffer>} the PDF bytes
 */
async function renderPdf(doc) {
  const normalized = brochureDoc.normalizeDoc(doc);
  const html = brochureDoc.renderDocHtml(normalized);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // The doc is user-authored. Text is escaped on render, but disabling JS removes
    // the whole class of script-execution risk during server-side rendering, exactly
    // as documentPdfService does.
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: normalized.pageW, height: normalized.pageH });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: RENDER_TIMEOUT_MS });

    const bytes = await page.pdf({
      width: `${normalized.pageW}px`,
      height: `${normalized.pageH}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      timeout: RENDER_TIMEOUT_MS,
    });

    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}

/** Filename for a rendered brochure, safe for a URL and a WhatsApp document name. */
function filenameFor(title) {
  const safe = String(title || 'brochure')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'brochure';
  return `${safe}.pdf`;
}

module.exports = { renderPdf, filenameFor };
