// FILE: /backend/src/models/DripEnrollment.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * DripEnrollment — a customer's enrollment in a drip sequence.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const DripEnrollment = sequelize.define('DripEnrollment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sequenceId: {
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
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    currentStepOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'The next step to execute',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    nextRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the next step should fire',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastStepSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'drip_enrollments',
    indexes: [
      { fields: ['sequence_id'] },
      { fields: ['customer_id', 'sequence_id'], unique: true },
      { fields: ['agency_id'] },
      { fields: ['status', 'next_run_at'] },
    ],
  });

  return DripEnrollment;
};
