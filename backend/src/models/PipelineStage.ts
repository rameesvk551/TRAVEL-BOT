// FILE: /backend/src/models/PipelineStage.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * PipelineStage model — an agency-configurable column of the CRM sales funnel.
 * Each stage maps one or more Lead.status values into a named, ordered bucket.
 * `kind` marks terminal stages so conversion/won/lost can be computed generically:
 *   OPEN = still in pipeline, WON = closed-won, LOST = closed-lost.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const PipelineStage = sequelize.define('PipelineStage', {
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
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Sort order of the stage in the funnel (ascending)',
    },
    color: {
      type: DataTypes.STRING(9),
      allowNull: false,
      defaultValue: '#5b7c99',
      comment: 'Hex color used for the funnel bar / chart',
    },
    leadStatuses: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Lead.status values that roll up into this stage',
    },
    kind: {
      type: DataTypes.ENUM('OPEN', 'WON', 'LOST'),
      allowNull: false,
      defaultValue: 'OPEN',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'pipeline_stages',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'position'] },
    ],
  });

  return PipelineStage;
};
