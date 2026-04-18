const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FollowUp = sequelize.define('FollowUp', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Agent scheduled for this follow-up',
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Scheduled', 'Done', 'Cancelled'),
      defaultValue: 'Scheduled',
    },
    notificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Has the Whatsapp reminder been sent to the agent?',
    },
  }, {
    tableName: 'follow_ups',
    indexes: [
      { fields: ['lead_id'] },
      { fields: ['agency_id', 'agent_id'] },
      { fields: ['scheduled_at', 'status', 'notification_sent'] }, // for cron queries
    ],
  });

  return FollowUp;
};
