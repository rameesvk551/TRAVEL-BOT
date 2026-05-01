// FILE: /backend/src/services/mediaService.js
// DEPS: cloudinary

const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function assertCloudinaryConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw Object.assign(new Error('Cloudinary is not configured on the server.'), {
      statusCode: 500,
      code: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }
}

function hasCloudinaryConfig() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function resolvePublicWebRoot() {
  const candidates = [
    process.env.PUBLIC_WEB_ROOT,
    '/var/www/travel-bot',
    path.resolve(__dirname, '../../../frontend/dist'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_err) {
      // Ignore and continue trying candidates.
    }
  }

  return candidates[0] || path.resolve(__dirname, '../../../frontend/dist');
}

function buildPublicAssetUrl(relativePath) {
  const baseUrl = String(process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw Object.assign(new Error('BASE_URL is required to create a public brochure URL when Cloudinary is not configured.'), {
      statusCode: 500,
      code: 'PUBLIC_BASE_URL_NOT_CONFIGURED',
    });
  }

  return `${baseUrl}/${relativePath.replace(/^\/+/, '')}`;
}

async function uploadPackageImage(fileBuffer, agencyId) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${rootFolder}/${agencyId}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary upload failed'), {
            statusCode: 502,
            code: 'CLOUDINARY_UPLOAD_FAILED',
          }));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

async function uploadPackageBrochure(fileBuffer, agencyId, originalName = 'brochure.pdf') {
  if (!hasCloudinaryConfig()) {
    const publicRoot = resolvePublicWebRoot();
    const folder = path.join(publicRoot, 'assets', 'brochures', String(agencyId));
    const safeBaseName = String(originalName || 'brochure.pdf')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'brochure';
    const filename = `${safeBaseName}.pdf`;
    const absolutePath = path.join(folder, filename);

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(absolutePath, fileBuffer);

    return {
      secureUrl: buildPublicAssetUrl(`assets/brochures/${agencyId}/${filename}`),
      publicId: `local-brochure-${agencyId}-${safeBaseName}`,
      originalFilename: originalName,
    };
  }

  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${rootFolder}/${agencyId}/brochures`;
  const publicId = String(originalName || 'brochure')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'brochure';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'raw',
        format: 'pdf',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary brochure upload failed'), {
            statusCode: 502,
            code: 'CLOUDINARY_UPLOAD_FAILED',
          }));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          originalFilename: originalName,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

async function uploadPropertyImage(fileBuffer, agencyId) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot/properties';
  const folder = `${rootFolder}/${agencyId}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary upload failed'), {
            statusCode: 502,
            code: 'CLOUDINARY_UPLOAD_FAILED',
          }));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

async function uploadTemplateMedia(fileBuffer, agencyId, mimeType = 'image/jpeg', originalName = 'template-media') {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot/templates';
  const folder = `${rootFolder}/${agencyId}`;
  const resourceType = String(mimeType || '').startsWith('video/') ? 'video' : 'image';
  const publicId = String(originalName || 'template-media')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'template-media';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${publicId}-${Date.now()}`,
        resource_type: resourceType,
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary template media upload failed'), {
            statusCode: 502,
            code: 'CLOUDINARY_UPLOAD_FAILED',
          }));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

module.exports = {
  uploadPackageImage,
  uploadPropertyImage,
  uploadPackageBrochure,
  uploadTemplateMedia,
};
