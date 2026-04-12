// FILE: /backend/src/utils/bookingRefGenerator.js
// DEPS: sequelize (via models)

const { Booking } = require('../models');

/**
 * Generates a unique booking reference in format TB-YYYY-XXXX.
 * Sequential per agency, per year.
 * @param {string} agencyId - The agency ID
 * @returns {Promise<string>} The generated booking reference
 */
async function generateBookingRef(agencyId) {
  const year = new Date().getFullYear();
  const prefix = `TB-${year}-`;

  // Find the latest booking ref for this agency this year
  const latestBooking = await Booking.findOne({
    where: { agencyId },
    order: [['createdAt', 'DESC']],
    attributes: ['bookingRef'],
  });

  let nextNumber = 1;
  if (latestBooking && latestBooking.bookingRef) {
    const match = latestBooking.bookingRef.match(/TB-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const ref = `${prefix}${String(nextNumber).padStart(4, '0')}`;
  return ref;
}

module.exports = { generateBookingRef };
