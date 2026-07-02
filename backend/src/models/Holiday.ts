// FILE: /backend/src/models/Holiday.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Holiday — an agency's non-working calendar day, excluded from absence/payroll deductions.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Holiday = sequelize.define('Holiday', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
  }, {
    tableName: 'holidays',
    indexes: [
      { unique: true, fields: ['agency_id', 'date'] },
      { fields: ['agency_id'] },
    ],
  });

  return Holiday;
};
