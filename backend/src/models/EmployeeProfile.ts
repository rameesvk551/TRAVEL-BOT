// FILE: /backend/src/models/EmployeeProfile.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * EmployeeProfile — HR attributes for a dashboard user (Agent).
 * One-to-one with Agent. Keeps the Agent model untouched so the HRM module
 * is fully self-contained and removable.
 * monthlySalary is stored in RUPEES (DECIMAL), unlike the rest of the system (paise).
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const EmployeeProfile = sequelize.define('EmployeeProfile', {
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
    employeeCode: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: 'Human-readable staff ID, e.g. EMP-0007',
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    employmentType: {
      type: DataTypes.ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'),
      defaultValue: 'FULL_TIME',
    },
    joiningDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    monthlySalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'In rupees',
    },
    weeklyOffDays: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [0],
      comment: 'Array of weekday numbers 0=Sun..6=Sat. Empty = use agency default.',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'employee_profiles',
    indexes: [
      { unique: true, fields: ['agency_id', 'agent_id'] },
      { fields: ['agency_id'] },
    ],
  });

  return EmployeeProfile;
};
