// FILE: /backend/src/utils/bookingRefGenerator.js
// DEPS: sequelize (via models)

const { Op } = require('sequelize');
const { Booking } = require('../models');

/**
 * Generates a unique booking reference in format TB-YYYY-XXXX.
 * Sequential globally per year.
 * @param {string} agencyId - The agency ID
 * @returns {Promise<string>} The generated booking reference
 */
async function generateBookingRef() {
  const year = new Date().getFullYear();
  const prefix = `TB-${year}-`;

  const existingRefs = await Booking.findAll({
    where: { bookingRef: { [Op.like]: `${prefix}%` } },
    attributes: ['bookingRef'],
    order: [['bookingRef', 'DESC']],
    limit: 25,
  });

  let nextNumber = 1;
  for (const booking of existingRefs) {
    const match = String(booking.bookingRef || '').match(/^TB-\d{4}-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
      break;
    }
  }

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ref = `${prefix}${String(nextNumber + attempt).padStart(4, '0')}`;
    const existing = await Booking.findOne({ where: { bookingRef: ref }, attributes: ['id'] });
    if (!existing) return ref;
  }

  return `${prefix}${Date.now()}`;
}

module.exports = { generateBookingRef };
