// FILE: /backend/src/models/LeaveType.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * LeaveType — agency-configurable category of leave (e.g. Casual, Sick, Unpaid).
 * isPaid controls whether days deduct from payroll.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const LeaveType = sequelize.define('LeaveType', {
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
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Short code e.g. CL, SL, LWP',
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    annualQuota: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
      comment: 'Days per year; 0 = unlimited/unpaid',
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '#6366f1',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'leave_types',
    indexes: [
      { unique: true, fields: ['agency_id', 'code'] },
      { fields: ['agency_id'] },
    ],
  });

  return LeaveType;
};
