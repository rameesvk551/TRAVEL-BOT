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
    itemType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'),
      defaultValue: 'PACKAGE',
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    cruiseId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    visaId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customItemName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    customItemDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    paymentMode: {
      type: DataTypes.ENUM('FULL', 'ADVANCE', 'NO_PAYMENT'),
      defaultValue: 'FULL',
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
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Per-traveller/item base price in paise',
    },
    advancePaid: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'In paise',
    },
    // How the money is settled between agency, customer and supplier.
    //   FULL_COLLECTION  — agency collects the whole totalAmount (default; existing behaviour)
    //   COMMISSION_ONLY  — agency earns only its commission; the customer pays the
    //                      balance directly at the property. The property balance is a
    //                      memo shown on the invoice PDF but never posted to the books.
    settlementType: {
      type: DataTypes.ENUM('FULL_COLLECTION', 'COMMISSION_ONLY'),
      defaultValue: 'FULL_COLLECTION',
    },
    // Agency's own revenue for COMMISSION_ONLY bookings, in paise. Defaults to whatever
    // the agency actually collected (advancePaid) when not set explicitly.
    commissionAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'In paise. Agency revenue for COMMISSION_ONLY bookings.',
    },
    balanceDue: {
      type: DataTypes.VIRTUAL,
      get() {
        // For COMMISSION_ONLY the agency is only owed its commission; the rest is paid by
        // the customer at the property (see balanceAtProperty), so nothing is due here.
        if (this.getDataValue('settlementType') === 'COMMISSION_ONLY') {
          const commission = this.getDataValue('commissionAmount') ?? this.getDataValue('advancePaid') ?? 0;
          return Math.max(0, commission - (this.getDataValue('advancePaid') || 0));
        }
        return this.getDataValue('totalAmount') - this.getDataValue('advancePaid');
      },
    },
    // Money the customer still pays directly at the property. Zero unless the booking is
    // COMMISSION_ONLY. Shown on the invoice PDF; deliberately absent from the ledgers.
    balanceAtProperty: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.getDataValue('settlementType') !== 'COMMISSION_ONLY') return 0;
        return Math.max(0, this.getDataValue('totalAmount') - this.getDataValue('advancePaid'));
      },
    },
    travelDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    returnDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    travellers: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
