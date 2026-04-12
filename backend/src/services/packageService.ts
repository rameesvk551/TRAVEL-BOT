// FILE: /backend/src/services/packageService.js

const packageRepository = require('../repositories/packageRepository');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'duration', 'destinations', 'inclusions', 'exclusions',
  'basePrice', 'imageUrl', 'itinerary', 'isActive',
];

/**
 * Lists all packages for an agency.
 * @param {string} agencyId - Agency ID
 * @param {boolean} [activeOnly=false] - Only return active packages
 * @returns {Promise<object[]>} List of packages
 */
async function listPackages(agencyId, activeOnly = false) {
  return packageRepository.findAllByAgency(agencyId, activeOnly);
}

/**
 * Gets a package by ID.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Package
 */
async function getPackageById(packageId, agencyId) {
  const pkg = await packageRepository.findByIdAndAgency(packageId, agencyId);
  if (!pkg) {
    throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return pkg;
}

/**
 * Creates a new travel package.
 * @param {object} data - Package data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created package
 */
async function createPackage(data, agencyId) {
  return packageRepository.create({ ...data, agencyId });
}

/**
 * Updates a package.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated package
 */
async function updatePackage(packageId, agencyId, updates) {
  const pkg = await getPackageById(packageId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return packageRepository.update(pkg, filtered);
}

/**
 * Deletes (deactivates) a package.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 */
async function deletePackage(packageId, agencyId) {
  const pkg = await getPackageById(packageId, agencyId);
  return packageRepository.update(pkg, { isActive: false });
}

module.exports = {
  listPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
};
