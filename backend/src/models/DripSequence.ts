// FILE: /backend/src/models/DripSequence.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * DripSequence — automated message sequence triggered by events.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const DripSequence = sequelize.define('DripSequence', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trigger: {
      type: DataTypes.ENUM('LEAD_CREATED', 'LEAD_QUOTED', 'BOOKING_COMPLETED', 'LEAD_COLD', 'MANUAL'),
      allowNull: false,
      defaultValue: 'LEAD_CREATED',
    },
    destinationFilter: {
      type: DataTypes.JSONB,
      defaultValue: null,
      comment: 'Optional: only enroll leads for specific destinations',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    enrollmentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    completedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'drip_sequences',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
      { fields: ['trigger'] },
    ],
  });

  return DripSequence;
};
