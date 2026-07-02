// FILE: /backend/src/models/LeaveRequest.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * LeaveRequest — an employee's request for time off, approved/rejected by an admin.
 * dayCount supports half-days (e.g. 0.5, 2.5).
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const LeaveRequest = sequelize.define('LeaveRequest', {
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
    leaveTypeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    isHalfDay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    dayCount: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: false,
      defaultValue: 1,
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
      defaultValue: 'PENDING',
    },
    reviewedByAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewNote: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'leave_requests',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'agent_id'] },
      { fields: ['agency_id', 'start_date'] },
    ],
  });

  return LeaveRequest;
};
