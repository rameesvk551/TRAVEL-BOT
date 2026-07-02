// FILE: /backend/src/models/HrmSetting.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * HrmSetting — one row per agency. Attendance/payroll rules for the HRM module.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const HrmSetting = sequelize.define('HrmSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    workdayStartTime: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: '09:30',
      comment: 'HH:MM 24h, agency-local start time',
    },
    graceMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    fullDayMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 480,
      comment: 'Minutes worked to count a full present day',
    },
    halfDayMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 240,
      comment: 'Minutes worked to count at least a half day',
    },
    defaultWeeklyOffDays: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [0],
      comment: 'Array of weekday numbers 0=Sun..6=Sat',
    },
    payrollDaysBasis: {
      type: DataTypes.ENUM('CALENDAR', 'WORKING', 'FIXED_30'),
      allowNull: false,
      defaultValue: 'WORKING',
      comment: 'Denominator for per-day salary',
    },
    forcePunchIn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'When true, employees must punch in before using the app',
    },
  }, {
    tableName: 'hrm_settings',
    indexes: [
      { unique: true, fields: ['agency_id'] },
    ],
  });

  return HrmSetting;
};
