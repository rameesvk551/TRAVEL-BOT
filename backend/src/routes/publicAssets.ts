const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function contentDispositionFilename(value) {
  const fallback = safeFilename(value).replace(/[^\x20-\x7E]/g, '_') || 'document.pdf';
  const encoded = encodeURIComponent(String(value || fallback));
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function publicRoots() {
  return [
    process.env.PUBLIC_WEB_ROOT,
    path.resolve(__dirname, '../../public'),
    '/var/www/travel-bot',
    '/home/ec2-user/travel-bot-frontend-release',
    path.resolve(__dirname, '../../../frontend/dist'),
  ].filter(Boolean);
}

function safeFilename(value = '') {
  return String(value || '')
    .replace(/[\r\n"]/g, '')
    .replace(/[\\/]/g, '-')
    .trim()
    .slice(0, 160);
}

function resolveAssetPath(relativePath = '') {
  const normalized = path.normalize(String(relativePath || '').replace(/^\/+/, ''));
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return null;
  }

  if (!normalized.split(path.sep).includes('assets')) {
    return null;
  }

  for (const root of publicRoots()) {
    const absolute = path.resolve(root, normalized);
    const rootAbsolute = path.resolve(root);
    if (!absolute.startsWith(`${rootAbsolute}${path.sep}`)) continue;
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      return absolute;
    }
  }

  return null;
}

router.get('/*', (req, res) => {
  const absolutePath = resolveAssetPath(req.params[0]);
  if (!absolutePath) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const fallbackName = path.basename(absolutePath);
  const filename = safeFilename(req.query.filename) || fallbackName;
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  }

  res.setHeader('Content-Disposition', contentDispositionFilename(filename));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(absolutePath);
});

module.exports = router;
