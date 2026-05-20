// FILE: /backend/src/models/FlightAlert.ts
// DEPS: sequelize
// DESC: Flight delay/reschedule alerts and notifications

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FlightAlert = sequelize.define('FlightAlert', {
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
    flightBookingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    alertType: {
      type: DataTypes.ENUM('DELAY', 'RESCHEDULE', 'CANCELLATION', 'GATE_CHANGE', 'BOARDING', 'ARRIVAL', 'DEPARTURE', 'DIVERSION', 'WEATHER', 'GENERAL'),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL'),
      defaultValue: 'INFO',
    },
    // Flight info at time of alert
    flightNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    airlineCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    origin: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    destination: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    // Schedule changes
    scheduledDeparture: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scheduledArrival: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estimatedDeparture: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estimatedArrival: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actualDeparture: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actualArrival: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delayMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    gate: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    terminal: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    baggageClaim: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Alert content
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional alert details from provider',
    },
    // Notification tracking
    notificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    notificationSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notificationChannel: {
      type: DataTypes.ENUM('WHATSAPP', 'SMS', 'EMAIL', 'PUSH'),
      defaultValue: 'WHATSAPP',
    },
    notificationError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    waMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Customer acknowledgment
    customerAcknowledged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    customerAcknowledgedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Provider source
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    providerAlertId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Alert ID from the flight data provider',
    },
    rawPayload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Raw webhook payload from provider',
    },
    isResolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolvedNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'flight_alerts',
    indexes: [
      { fields: ['agency_id', 'customer_id'] },
      { fields: ['flight_booking_id'] },
      { fields: ['agency_id', 'alert_type'] },
      { fields: ['notification_sent'] },
      { fields: ['provider_alert_id'] },
      { fields: ['created_at'] },
    ],
  });

  return FlightAlert;
};
