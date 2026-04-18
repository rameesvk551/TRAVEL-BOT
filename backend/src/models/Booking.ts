// FILE: /backend/src/models/Booking.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Booking model — a confirmed trip. Created from a lead.
 * All monetary amounts in paise. bookingRef is a human-readable unique ID.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    itineraryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    bookingRef: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'e.g. TB-2026-0042',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'),
      defaultValue: 'PENDING',
    },
    totalAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'In paise',
    },
    advancePaid: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'In paise',
    },
    balanceDue: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('totalAmount') - this.getDataValue('advancePaid');
      },
    },
    travelDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    returnDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    travellers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'bookings',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['customer_id'] },
      { fields: ['booking_ref'] },
      { fields: ['travel_date'] },
    ],
  });

  return Booking;
};
