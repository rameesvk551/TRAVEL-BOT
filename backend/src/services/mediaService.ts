// FILE: /backend/src/services/mediaService.js
// DEPS: cloudinary

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

module.exports = {
  uploadPackageImage,
};