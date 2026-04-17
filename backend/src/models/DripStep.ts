// FILE: /backend/src/models/DripStep.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * DripStep — individual step within a drip sequence.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const DripStep = sequelize.define('DripStep', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sequenceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Step order within the sequence (1, 2, 3...)',
    },
    delayHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Hours to wait after previous step (0 = immediate)',
    },
    messageType: {
      type: DataTypes.ENUM('TEXT', 'TEMPLATE', 'BUTTONS', 'IMAGE'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
    messageBody: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Message text with {name}, {destination} placeholders',
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to MessageTemplate if messageType=TEMPLATE',
    },
    buttons: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Button options if messageType=BUTTONS',
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
  }, {
    tableName: 'drip_steps',
    indexes: [
      { fields: ['sequence_id', 'order'] },
    ],
  });

  return DripStep;
};
