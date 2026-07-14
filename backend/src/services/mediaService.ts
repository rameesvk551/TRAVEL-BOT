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
    path.resolve(__dirname, '../../public'),
    '/home/ec2-user/travel-bot-frontend-release',
    path.resolve(__dirname, '../../../frontend/dist'),
    '/var/www/travel-bot',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const assetRoot = path.join(candidate, 'assets');
        if (!fs.existsSync(assetRoot)) {
          fs.mkdirSync(assetRoot, { recursive: true });
        }
        fs.accessSync(assetRoot, fs.constants.W_OK);
        return candidate;
      }
    } catch (_err) {
      // Ignore and continue trying candidates.
    }
  }

  const fallback = path.resolve(__dirname, '../../public');
  fs.mkdirSync(path.join(fallback, 'assets'), { recursive: true });
  return fallback;
}

function buildPublicAssetUrl(relativePath, downloadName = '') {
  const baseUrl = String(process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw Object.assign(new Error('BASE_URL is required to create a public brochure URL when Cloudinary is not configured.'), {
      statusCode: 500,
      code: 'PUBLIC_BASE_URL_NOT_CONFIGURED',
    });
  }

  const cleanPath = relativePath.replace(/^\/+/, '');
  const isPdf = /\.pdf(?:\?|$)/i.test(cleanPath);
  if (isPdf) {
    const filename = String(downloadName || path.posix.basename(cleanPath)).trim();
    const query = filename ? `?filename=${encodeURIComponent(filename)}` : '';
    return `${baseUrl}/api/public-assets/${cleanPath}${query}`;
  }

  return `${baseUrl}/${cleanPath}`;
}

function safePdfBaseName(originalName = 'document.pdf', fallback = 'document') {
  return String(originalName || fallback)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

async function uploadCloudinaryPdf(fileBuffer, folder, publicId, originalName = 'document.pdf', errorMessage = 'Cloudinary pdf upload failed') {
  assertCloudinaryConfigured();

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
          reject(Object.assign(new Error(err.message || errorMessage), {
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

async function uploadPublicPdf(fileBuffer, relativeFolder, id, originalName = 'document.pdf', fallbackName = 'document') {
  const safeBaseName = safePdfBaseName(originalName, fallbackName);
  const publicRoot = resolvePublicWebRoot();
  const folder = path.join(publicRoot, relativeFolder);
  const filename = `${safeBaseName}-${id}.pdf`;
  const absolutePath = path.join(folder, filename);
  const publicPath = path.posix.join(relativeFolder.replace(/\\/g, '/'), filename);

  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(absolutePath, fileBuffer);

  return {
    secureUrl: buildPublicAssetUrl(publicPath, originalName),
    publicId: `local-pdf-${id}`,
    originalFilename: originalName,
  };
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
  const uploadId = Date.now();

  return uploadPublicPdf(
    fileBuffer,
    path.join('assets', 'brochures', String(agencyId)),
    uploadId,
    originalName,
    'brochure'
  );
}

async function uploadItineraryPdf(fileBuffer, agencyId, itineraryId, originalName = 'itinerary.pdf') {
  const uploadId = itineraryId || Date.now();

  return uploadPublicPdf(
    fileBuffer,
    path.join('assets', 'itineraries', String(agencyId)),
    uploadId,
    originalName,
    'itinerary'
  );
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

async function uploadRemoteTemplateMedia(mediaUrl, agencyId, resourceType = 'image') {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot/templates';
  const folder = `${rootFolder}/${agencyId}/campaign-media`;
  const trimmedUrl = String(mediaUrl || '').trim();

  if (!trimmedUrl) {
    throw Object.assign(new Error('Remote media URL is required'), {
      statusCode: 400,
      code: 'REMOTE_MEDIA_URL_REQUIRED',
    });
  }

  const result = await cloudinary.uploader.upload(trimmedUrl, {
    folder,
    resource_type: resourceType,
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType,
  };
}

async function uploadCompanyAsset(fileBuffer, agencyId, assetType) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot';
  const folder = `${rootFolder}/agencies/${agencyId}/assets`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${assetType}-${Date.now()}`,
        resource_type: 'image',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary asset upload failed'), {
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

/**
 * Uploads a white-label partner branding asset (logo, favicon, login image).
 * Not scoped to a partner id so it works during partner creation (before an id
 * exists); the returned URL is then saved onto the partner record.
 */
async function uploadPartnerAsset(fileBuffer, assetType) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot';
  const folder = `${rootFolder}/partners/assets`;
  const safeType = String(assetType || 'asset').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'asset';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${safeType}-${Date.now()}`,
        resource_type: 'image',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary asset upload failed'), {
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

async function uploadInvoicePdf(fileBuffer, agencyId, invoiceNumber) {
  return uploadPublicPdf(
    fileBuffer,
    path.join('assets', 'invoices', String(agencyId)),
    Date.now(),
    `${invoiceNumber || 'invoice'}.pdf`,
    'invoice'
  );
}

/**
 * Uploads a generated document PDF (quotation / receipt) and returns a public
 * URL suitable for sending over WhatsApp. Mirrors uploadInvoicePdf.
 * @param {Buffer} fileBuffer
 * @param {string} agencyId
 * @param {string} kind   e.g. 'quotation' | 'receipt'
 * @param {string} ref    a short reference (number/id) for the public_id
 */
async function uploadDocumentPdf(fileBuffer, agencyId, kind, ref) {
  const safeKind = String(kind || 'document').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'document';
  const safeRef = String(ref || 'doc').replace(/[^a-z0-9_-]/gi, '').slice(0, 60) || 'doc';

  return uploadPublicPdf(
    fileBuffer,
    path.join('assets', `${safeKind}s`, String(agencyId)),
    Date.now(),
    `${safeRef}.pdf`,
    safeKind
  );
}

/**
 * Upload one brochure photo. Callers upload a 10-30 image batch concurrently.
 *
 * We store the original and derive print/thumbnail sizes at render time via
 * brochureDoc.cdnUrl (f_auto,q_auto,c_limit,w_N), rather than baking a size in here —
 * the same upload then serves the editor tray (w_400) and the PDF (w_1600).
 */
async function uploadBrochureImage(fileBuffer, agencyId) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot';
  const folder = `${rootFolder}/brochures/${agencyId}`;

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
          width: result.width,
          height: result.height,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

async function uploadCustomerDocument(fileBuffer, agencyId, customerId, originalName) {
  assertCloudinaryConfigured();

  const rootFolder = process.env.CLOUDINARY_FOLDER || 'travel-bot';
  const folder = `${rootFolder}/agencies/${agencyId}/customers/${customerId}`;
  const safeName = String(originalName || 'document')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${safeName}-${Date.now()}`,
        resource_type: 'auto',
      },
      (err, result) => {
        if (err) {
          reject(Object.assign(new Error(err.message || 'Cloudinary document upload failed'), {
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

module.exports = {
  uploadPackageImage,
  uploadPropertyImage,
  uploadPackageBrochure,
  uploadItineraryPdf,
  uploadTemplateMedia,
  uploadRemoteTemplateMedia,
  uploadCompanyAsset,
  uploadPartnerAsset,
  uploadInvoicePdf,
  uploadDocumentPdf,
  uploadBrochureImage,
  uploadCustomerDocument,
};
