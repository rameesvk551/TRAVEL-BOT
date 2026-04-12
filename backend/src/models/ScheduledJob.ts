// FILE: /backend/src/models/ScheduledJob.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * ScheduledJob model — tracks BullMQ jobs for reminders and notifications.
 * Stores bullJobId for cancellation support.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const ScheduledJob = sequelize.define('ScheduledJob', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    jobType: {
      type: DataTypes.ENUM('REMINDER_3DAY', 'REMINDER_1DAY', 'REVIEW_REQUEST', 'CUSTOM'),
      allowNull: false,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'SENT', 'CANCELLED', 'FAILED'),
      defaultValue: 'PENDING',
    },
    bullJobId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'BullMQ job ID for cancellation',
    },
  }, {
    tableName: 'scheduled_jobs',
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['agency_id'] },
      { fields: ['status'] },
      { fields: ['scheduled_at'] },
    ],
  });

  return ScheduledJob;
};
