// FILE: /backend/src/models/Attendance.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Attendance — one row per (agency, agent, date). Records punches and the
 * resolved day status used by payroll.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    punchInAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    punchOutAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    punchInLat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: 'Latitude captured at punch-in',
    },
    punchInLng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: 'Longitude captured at punch-in',
    },
    punchInAccuracy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'GPS accuracy radius in metres at punch-in',
    },
    punchOutLat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: 'Latitude captured at punch-out',
    },
    punchOutLng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: 'Longitude captured at punch-out',
    },
    punchOutAccuracy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'GPS accuracy radius in metres at punch-out',
    },
    status: {
      type: DataTypes.ENUM('PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'),
      defaultValue: 'PRESENT',
    },
    isLate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    workedMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'punchOut - punchIn in minutes; null until punched out',
    },
    source: {
      type: DataTypes.ENUM('SELF', 'ADMIN'),
      defaultValue: 'SELF',
    },
    notes: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'attendances',
    indexes: [
      { unique: true, fields: ['agency_id', 'agent_id', 'date'] },
      { fields: ['agency_id', 'date'] },
    ],
  });

  return Attendance;
};
