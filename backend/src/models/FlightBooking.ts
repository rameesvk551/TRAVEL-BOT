// FILE: /backend/src/models/FlightBooking.ts
// DEPS: sequelize
// DESC: Flight booking requests and confirmations

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FlightBooking = sequelize.define('FlightBooking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    searchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the original flight search',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Flight provider used for this booking',
    },
    bookingRef: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment: 'Human-readable booking reference (e.g., FL-20260517-001)',
    },
    pnr: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Airline PNR / Record locator',
    },
    airlinePnr: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Airline-specific PNR',
    },
    status: {
      type: DataTypes.ENUM('REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'TICKETED', 'CANCELLED', 'FAILED', 'REFUNDED'),
      defaultValue: 'REQUESTED',
    },
    // Flight details (stored as JSON for flexibility)
    flightDetails: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Complete flight itinerary details',
    },
    // Passenger details
    passengers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of passenger objects with name, age, passport, etc.',
    },
    // Pricing
    baseFare: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Base fare in paise',
    },
    taxes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Taxes in paise',
    },
    markup: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Agency markup in paise',
    },
    totalAmount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total amount in paise (base + taxes + markup)',
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'INR',
    },
    // Contact info
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Payment
    paymentStatus: {
      type: DataTypes.ENUM('PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED'),
      defaultValue: 'PENDING',
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    paidAmount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Amount paid in paise',
    },
    // Provider response tracking
    providerBookingRef: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Booking reference from the flight provider/GDS',
    },
    providerResponse: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Raw response from provider during booking',
    },
    // Cancellation
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refundAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Refund amount in paise',
    },
    // Metadata
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Internal agency notes',
    },
    bookedByAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Agent who processed the booking',
    },
  }, {
    tableName: 'flight_bookings',
    indexes: [
      { fields: ['agency_id', 'customer_id'] },
      { fields: ['booking_ref'], unique: true },
      { fields: ['pnr'], unique: true },
      { fields: ['agency_id', 'status'] },
      { fields: ['provider_booking_ref'] },
    ],
  });

  return FlightBooking;
};
