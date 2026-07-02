// FILE: /backend/src/models/Payslip.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Payslip — a generated monthly pay statement for an employee.
 * earnings/deductions are JSONB arrays of { label, amount } so the simple model
 * can grow into full salary components without a migration. Amounts in RUPEES.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Payslip = sequelize.define('Payslip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    periodMonth: {
      type: DataTypes.STRING(7),
      allowNull: false,
      comment: 'YYYY-MM',
    },
    baseSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    earnings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of { label, amount } in rupees',
    },
    deductions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of { label, amount } in rupees',
    },
    workingDays: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    },
    paidDays: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    },
    unpaidDays: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    },
    lossOfPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    grossPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    netPay: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'FINALIZED', 'PAID'),
      defaultValue: 'DRAFT',
    },
    notes: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    generatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'payslips',
    indexes: [
      { unique: true, fields: ['agency_id', 'agent_id', 'period_month'] },
      { fields: ['agency_id', 'period_month'] },
    ],
  });

  return Payslip;
};
