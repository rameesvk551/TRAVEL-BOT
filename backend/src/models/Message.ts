// FILE: /backend/src/models/Message.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Message model — every WhatsApp message sent or received.
 * Direction IN = customer to agency, OUT = agency/bot to customer.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
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
      comment: 'Set if message was sent by agent',
    },
    direction: {
      type: DataTypes.ENUM('IN', 'OUT'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('TEXT', 'TEMPLATE', 'IMAGE', 'DOCUMENT', 'AUDIO'),
      defaultValue: 'TEXT',
    },
    templateName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    waMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'WhatsApp message ID for status tracking',
    },
    status: {
      type: DataTypes.ENUM('SENT', 'DELIVERED', 'READ', 'FAILED'),
      defaultValue: 'SENT',
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'messages',
    timestamps: false,
    indexes: [
      { fields: ['customer_id', 'agency_id'] },
      { fields: ['agency_id', 'timestamp'] },
      { fields: ['wa_message_id'] },
      { fields: ['customer_id', 'timestamp'] },
    ],
  });

  return Message;
};
